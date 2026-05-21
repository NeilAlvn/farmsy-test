"""
foursquare_extract.py (DuckDB edition)

Queries Foursquare OS Places parquet files directly via DuckDB.
Only fetches NL+BE rows — no need to download the full 50-100 GB dataset.
"""

import json
import math
import os
import sys
from pathlib import Path
from datetime import datetime

os.environ.setdefault("PYTHONIOENCODING", "utf-8")

# ── Paths ─────────────────────────────────────────────────────────────────────

ROOT     = Path(__file__).parent.parent.parent
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

REPORT_FILE    = DATA_DIR / "foursquare_analysis_report.json"
NEW_FARMS_FILE = DATA_DIR / "foursquare_new_farms.json"
DUPES_FILE     = DATA_DIR / "foursquare_duplicates.json"
UPDATES_FILE   = DATA_DIR / "foursquare_potential_updates.json"

# ── Load env ──────────────────────────────────────────────────────────────────

def _load_env():
    for candidate in [ROOT / ".env.local", ROOT / ".env"]:
        if candidate.exists():
            with open(candidate, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, _, v = line.partition("=")
                        os.environ.setdefault(k.strip(), v.strip())
            break

_load_env()

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
HF_TOKEN     = os.environ.get("HF_TOKEN", "")

if not HF_TOKEN:
    print("ERROR: HF_TOKEN not set in .env.local")
    sys.exit(1)

# ── DuckDB setup ──────────────────────────────────────────────────────────────

import duckdb

def get_db():
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")
    # Cap memory and threads so the parquet scan doesn't freeze the machine
    con.execute("SET memory_limit='2GB';")
    con.execute("SET threads=2;")
    con.execute(f"""
        SET s3_region = 'us-east-1';
        CREATE SECRET hf_secret (
            TYPE HUGGINGFACE,
            TOKEN '{HF_TOKEN}'
        );
    """)
    return con

# ── Supabase helpers ──────────────────────────────────────────────────────────

def load_existing_farms():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("No Supabase credentials — skipping dedup")
        return [], []

    import requests
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }

    # Name + city for text dedup
    farms, offset, PAGE = [], 0, 1000
    while True:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/farms",
            headers=headers,
            params={"select": "id,name,city", "is_published": "eq.true",
                    "limit": PAGE, "offset": offset},
            timeout=30,
        )
        batch = r.json()
        if not batch:
            break
        farms.extend(batch)
        if len(batch) < PAGE:
            break
        offset += PAGE
    print(f"Loaded {len(farms):,} existing farms (name/city)")

    # Coordinates for geo dedup
    r2 = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/get_farms_with_coords",
        headers=headers, json={}, timeout=60,
    )
    coords = r2.json() if isinstance(r2.json(), list) else []
    print(f"Loaded {len(coords):,} farm coordinates")

    return farms, coords

# ── Haversine ─────────────────────────────────────────────────────────────────

def haversine_m(lat1, lon1, lat2, lon2):
    R = 6_371_000
    p = math.pi / 180
    a = (math.sin((lat2 - lat1) * p / 2) ** 2 +
         math.cos(lat1 * p) * math.cos(lat2 * p) *
         math.sin((lon2 - lon1) * p / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(a))

# ── Stage 1: inspect categories ───────────────────────────────────────────────

def stage1_categories(con):
    print("\n" + "="*60)
    print("STAGE 1: Inspecting categories")
    print("="*60)

    CATS_URL = "hf://datasets/foursquare/fsq-os-places/release/dt=2026-04-14/categories/parquet/*.parquet"

    # Schema
    schema = con.execute(f"DESCRIBE SELECT * FROM '{CATS_URL}' LIMIT 1").fetchall()
    print("Columns:", [r[0] for r in schema])

    total = con.execute(f"SELECT COUNT(*) FROM '{CATS_URL}'").fetchone()[0]
    print(f"Total categories: {total:,}")

    # Find agriculture-related
    keywords = ["farm", "agri", "dairy", "ranch", "orchard", "vineyard",
                "winery", "market", "organic", "harvest", "livestock",
                "poultry", "greenhouse", "nursery", "produce", "garden",
                "boer", "ferme", "boerderij", "landbouw", "crop"]

    kw_filter = " OR ".join(
        f"LOWER(CAST(category_name AS VARCHAR)) LIKE '%{kw}%' OR LOWER(CAST(category_label AS VARCHAR)) LIKE '%{kw}%'"
        for kw in keywords
    )

    ag_cats = con.execute(f"""
        SELECT category_id, category_name, category_label
        FROM '{CATS_URL}'
        WHERE {kw_filter}
        ORDER BY category_name
    """).fetchall()

    print(f"\nAgriculture-related categories ({len(ag_cats)}):")
    for row in ag_cats:
        print(f"  id={row[0]}  name={row[1]}  label={row[2]}")

    ag_ids = [str(row[0]) for row in ag_cats if row[0]]
    return ag_ids

# ── Stage 2: extract NL+BE farms ─────────────────────────────────────────────

def stage2_extract(con, ag_ids):
    print("\n" + "="*60)
    print("STAGE 2: Querying NL+BE places")
    print("="*60)

    PLACES_URL = "hf://datasets/foursquare/fsq-os-places/release/dt=2026-04-14/places/parquet/*.parquet"

    # First get schema
    schema = con.execute(f"DESCRIBE SELECT * FROM '{PLACES_URL}' LIMIT 1").fetchall()
    col_names = [r[0] for r in schema]
    print(f"Columns: {col_names}")

    # Count NL+BE total
    print("\nCounting NL+BE POIs (this may take a few minutes)...")
    nlbe_count = con.execute(f"""
        SELECT country, COUNT(*) as cnt
        FROM '{PLACES_URL}'
        WHERE country IN ('NL', 'BE')
        GROUP BY country
        ORDER BY country
    """).fetchall()
    print("NL+BE breakdown:")
    for row in nlbe_count:
        print(f"  {row[0]}: {row[1]:,}")

    # Build category filter — fsq_category_ids is an array
    # Use array_to_string or list_contains depending on DuckDB version
    print(f"\nFiltering for {len(ag_ids)} agriculture category IDs...")
    ag_ids_list = ", ".join(f"'{i}'" for i in ag_ids)

    farms_raw = con.execute(f"""
        SELECT
            fsq_place_id,
            name,
            latitude,
            longitude,
            address,
            locality,
            region,
            postcode,
            country,
            fsq_category_ids,
            tel      AS phone,
            website
        FROM '{PLACES_URL}'
        WHERE country IN ('NL', 'BE')
          AND EXISTS (
              SELECT 1 FROM UNNEST(fsq_category_ids) AS t(cat_id)
              WHERE CAST(cat_id AS VARCHAR) IN ({ag_ids_list})
          )
    """).fetchall()

    print(f"Raw matches: {len(farms_raw):,}")

    cols = ["fsq_place_id","name","latitude","longitude","address",
            "locality","region","postcode","country","categories","phone","website"]

    farms = []
    for row in farms_raw:
        farms.append({
            "fsq_place_id": row[0],
            "name":         row[1],
            "latitude":     row[2],
            "longitude":    row[3],
            "address":      row[4],
            "locality":     row[5],
            "region":       row[6],
            "postcode":     row[7],
            "country":      row[8],
            "categories":   list(row[9]) if row[9] else [],
            "phone":        row[10],
            "website":      row[11],
            "source":       "foursquare_os",
        })

    return farms, dict(nlbe_count)

# ── Stage 3: quality filter + dedup ──────────────────────────────────────────

def stage3_dedup(farms):
    print("\n" + "="*60)
    print("STAGE 3: Quality filter + deduplication")
    print("="*60)

    # Quality filter
    quality = [
        f for f in farms
        if f["name"]
        and f["latitude"] is not None
        and f["longitude"] is not None
        and (f["locality"] or f["postcode"])
    ]
    print(f"After quality filter: {len(quality):,} (removed {len(farms)-len(quality):,})")

    existing_farms, existing_coords = load_existing_farms()

    existing_name_city = set()
    for f in existing_farms:
        name = (f.get("name") or "").strip().lower()
        city = (f.get("city") or "").strip().lower()
        if name and city:
            existing_name_city.add((name, city))

    new_farms, duplicates, updates = [], [], []

    for f in quality:
        name = (f["name"] or "").strip().lower()
        city = (f["locality"] or "").strip().lower()
        lat  = f["latitude"]
        lon  = f["longitude"]

        name_match  = (name, city) in existing_name_city
        # Bounding-box pre-filter (~111m) so haversine only runs on nearby candidates
        _LAT_D = 0.001
        _LON_D = 0.002
        coord_match = any(
            ef.get("lat") is not None and
            abs(lat - ef["lat"]) <= _LAT_D and
            abs(lon - ef["lng"]) <= _LON_D and
            haversine_m(lat, lon, ef["lat"], ef["lng"]) <= 100
            for ef in existing_coords
        )

        if name_match or coord_match:
            if f.get("phone") or f.get("website"):
                updates.append(f)
            else:
                duplicates.append(f)
        else:
            new_farms.append(f)

    print(f"New farms        : {len(new_farms):,}")
    print(f"Duplicates       : {len(duplicates):,}")
    print(f"Potential updates: {len(updates):,}")

    return quality, new_farms, duplicates, updates

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Foursquare OS Places — DuckDB Farm Extractor")
    print(f"Started: {datetime.now().isoformat()}")

    con = get_db()
    print("DuckDB connected with HuggingFace credentials")

    ag_ids = stage1_categories(con)

    if not ag_ids:
        print("\nNo agriculture categories found. Exiting.")
        sys.exit(1)

    farms_raw, nlbe_breakdown = stage2_extract(con, ag_ids)

    quality, new_farms, duplicates, updates = stage3_dedup(farms_raw)

    country_breakdown = {}
    for f in quality:
        cc = f["country"]
        country_breakdown[cc] = country_breakdown.get(cc, 0) + 1

    cat_counts = {}
    for f in quality:
        for c in f["categories"]:
            cat_counts[str(c)] = cat_counts.get(str(c), 0) + 1

    report = {
        "generated_at":              datetime.now().isoformat(),
        "nl_be_total_pois":          nlbe_breakdown,
        "agriculture_category_ids":  ag_ids,
        "farms_matched_raw":         len(farms_raw),
        "after_quality_filter":      len(quality),
        "breakdown_by_country":      country_breakdown,
        "breakdown_by_category":     cat_counts,
        "new_farms":                 len(new_farms),
        "duplicates_found":          len(duplicates),
        "potential_updates":         len(updates),
        "sample_farms":              new_farms[:10],
    }

    REPORT_FILE.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    NEW_FARMS_FILE.write_text(json.dumps(new_farms, indent=2, ensure_ascii=False), encoding="utf-8")
    DUPES_FILE.write_text(json.dumps(duplicates, indent=2, ensure_ascii=False), encoding="utf-8")
    UPDATES_FILE.write_text(json.dumps(updates, indent=2, ensure_ascii=False), encoding="utf-8")

    print("\n" + "="*60)
    print("FINAL SUMMARY")
    print("="*60)
    print(f"NL+BE total POIs     : {sum(nlbe_breakdown.values()):,}")
    print(f"Farms matched (raw)  : {len(farms_raw):,}")
    print(f"After quality filter : {len(quality):,}")
    print(f"  NL                 : {country_breakdown.get('NL', 0):,}")
    print(f"  BE                 : {country_breakdown.get('BE', 0):,}")
    print(f"New farms            : {len(new_farms):,}")
    print(f"Duplicates           : {len(duplicates):,}")
    print(f"Potential updates    : {len(updates):,}")
    print(f"\nOutputs written to {DATA_DIR}/")
    print(f"Done: {datetime.now().isoformat()}")


if __name__ == "__main__":
    main()
