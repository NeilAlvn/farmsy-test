"""
overture_extract.py  —  Overture Maps 2026-04-15.0

Extracts farm/agriculture places for NL+BE from sources other than
Foursquare and OpenStreetMap (which we already have).

Sources in NL+BE (from pre-analysis):
  meta        1,467,619  (Facebook)   ← KEEP
  Foursquare    314,386               ← SKIP (already imported)
  Microsoft     221,900  (Bing)       ← KEEP
  AllThePlaces   43,579               ← KEEP
  PinMeTo         9,544               ← KEEP
  DAC             2,094               ← KEEP
  Krick             452               ← KEEP

Outputs:
  data/overture_unique_sources.json       — new farms not in our DB
  data/overture_duplicates.json           — matches to existing farms
  data/overture_extraction_report.json    — full stats
"""

import json
import math
import os
import sys
from pathlib import Path
from datetime import datetime
from collections import Counter

os.environ.setdefault("PYTHONIOENCODING", "utf-8")

# ── Paths ─────────────────────────────────────────────────────────────────────

ROOT     = Path(__file__).parent.parent.parent
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

NEW_FARMS_FILE = DATA_DIR / "overture_unique_sources.json"
DUPES_FILE     = DATA_DIR / "overture_duplicates.json"
REPORT_FILE    = DATA_DIR / "overture_extraction_report.json"

OVERTURE_URL = (
    "s3://overturemaps-us-west-2/release/2026-04-15.0/theme=places/type=place/*.parquet"
)

# Sources to skip (we already have their data)
SKIP_SOURCES = {"Foursquare", "openstreetmap"}

# NL+BE bounding box (used for fast parquet row-group pruning)
# NL: lng 3.0-7.3 / lat 50.75-53.6   BE: lng 2.4-6.4 / lat 49.4-51.6
BBOX_LNG_MIN, BBOX_LNG_MAX = 2.4,  7.4
BBOX_LAT_MIN, BBOX_LAT_MAX = 49.4, 53.8

# Exact farm/agriculture category values confirmed in Overture NL+BE data
FARM_CATEGORIES = [
    # Core farms
    "farm", "dairy_farm", "urban_farm", "fish_farm", "poultry_farm",
    "pig_farm", "b2b_farms", "attraction_farm", "pick_your_own_farm",
    "fish_farms_and_hatcheries", "poultry_farming",
    # Agriculture
    "agriculture", "agricultural_service", "agricultural_cooperatives",
    "agricultural_production", "agricultural_seed_store",
    "agriculture_association", "b2b_agriculture_and_food",
    "livestock_breeder", "livestock_dealers", "farming_services",
    # Farm shops & markets
    "farmers_market", "butcher_shop", "fishmonger", "cheese_shop",
    "organic_grocery_store", "dairy_stores", "honey_farm_shop",
    "seafood_market", "seafood_wholesaler", "meat_wholesaler",
    "produce_wholesaler", "public_market",
    # Wine / distillery
    "winery", "distillery",
    # Other direct-to-consumer
    "greenhouses", "orchard", "community_gardens",
]

# ── Load .env.local ───────────────────────────────────────────────────────────

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

# ── DuckDB ────────────────────────────────────────────────────────────────────

import duckdb

def get_db():
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute("INSTALL spatial; LOAD spatial;")
    con.execute("SET memory_limit='3GB';")
    con.execute("SET threads=4;")
    con.execute("SET s3_region='us-west-2';")
    con.execute("SET s3_access_key_id='';")
    con.execute("SET s3_secret_access_key='';")
    return con

# ── Supabase: load existing farms for dedup ───────────────────────────────────

def load_existing_farms():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("  WARNING: No Supabase credentials — dedup will be skipped")
        return [], []

    import urllib.request

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }

    def get_json(url, params=None):
        if params:
            qs = "&".join(f"{k}={v}" for k, v in params.items())
            url = f"{url}?{qs}"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())

    def post_json(url, body):
        data = json.dumps(body).encode()
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())

    # Name + city pairs
    farms, offset, PAGE = [], 0, 1000
    while True:
        batch = get_json(
            f"{SUPABASE_URL}/rest/v1/farms",
            {"select": "name,city", "is_published": "eq.true",
             "limit": str(PAGE), "offset": str(offset)},
        )
        if not batch:
            break
        farms.extend(batch)
        if len(batch) < PAGE:
            break
        offset += PAGE
    print(f"  Loaded {len(farms):,} existing farms (name/city)")

    # Coordinates via slim RPC
    try:
        coords = post_json(f"{SUPABASE_URL}/rest/v1/rpc/get_farms_slim", {})
        if not isinstance(coords, list):
            coords = []
    except Exception as e:
        print(f"  WARNING: Could not load coords: {e}")
        coords = []
    print(f"  Loaded {len(coords):,} farm coordinates")

    return farms, coords

# ── Haversine ─────────────────────────────────────────────────────────────────

def haversine_m(lat1, lon1, lat2, lon2):
    R = 6_371_000
    p = math.pi / 180
    a = (math.sin((lat2 - lat1) * p / 2) ** 2 +
         math.cos(lat1 * p) * math.cos(lat2 * p) *
         math.sin((lon2 - lon1) * p / 2) ** 2)
    return 2 * R * math.asin(min(1.0, math.sqrt(a)))

# ── Stage 1: extract from Overture ───────────────────────────────────────────

def stage1_extract(con):
    print("\n" + "="*60)
    print("STAGE 1: Extracting NL+BE farm places from Overture")
    print("="*60)

    cat_list = ", ".join(f"'{c}'" for c in FARM_CATEGORIES)

    print(f"Categories: {len(FARM_CATEGORIES)} farm/agriculture types")
    print(f"Bbox: lng [{BBOX_LNG_MIN}, {BBOX_LNG_MAX}] lat [{BBOX_LAT_MIN}, {BBOX_LAT_MAX}]")
    print("Running query (this takes ~5-10 min)...")

    rows = con.execute(f"""
        SELECT
            id,
            names.primary                                       AS name,
            ST_Y(geometry)                                      AS lat,
            ST_X(geometry)                                      AS lng,
            addresses[1].freeform                               AS address,
            addresses[1].locality                               AS city,
            addresses[1].region                                 AS region,
            addresses[1].postcode                               AS postal_code,
            addresses[1].country                                AS country,
            categories.primary                                  AS category,
            phones[1]                                           AS phone,
            websites[1]                                         AS website,
            socials                                             AS socials,
            sources[1].dataset                                  AS src1,
            sources[2].dataset                                  AS src2,
            sources[3].dataset                                  AS src3
        FROM read_parquet('{OVERTURE_URL}', hive_partitioning=false)
        WHERE bbox.xmin >= {BBOX_LNG_MIN}
          AND bbox.xmax <= {BBOX_LNG_MAX}
          AND bbox.ymin >= {BBOX_LAT_MIN}
          AND bbox.ymax <= {BBOX_LAT_MAX}
          AND categories.primary IN ({cat_list})
    """).fetchall()

    print(f"Raw matches from Overture: {len(rows):,}")

    col_names = ["id","name","lat","lng","address","city","region",
                 "postal_code","country","category","phone","website",
                 "socials","src1","src2","src3"]

    places = []
    for row in rows:
        d = dict(zip(col_names, row))
        # Collect all datasets for this place
        datasets = set()
        for s in [d.pop("src1"), d.pop("src2"), d.pop("src3")]:
            if s:
                datasets.add(s)
        d["datasets"] = sorted(datasets)
        # Flatten socials
        d["socials"] = list(d["socials"]) if d["socials"] else []
        places.append(d)

    return places

# ── Stage 2: source filter ────────────────────────────────────────────────────

def stage2_source_filter(places):
    print("\n" + "="*60)
    print("STAGE 2: Filter — skip Foursquare & OSM")
    print("="*60)

    # Dataset breakdown
    ds_counts = Counter()
    for p in places:
        for ds in p["datasets"]:
            if ds != "Overture":
                ds_counts[ds] += 1

    print("Dataset breakdown (all matches):")
    for ds, cnt in ds_counts.most_common():
        status = "SKIP" if ds in SKIP_SOURCES else "KEEP"
        print(f"  {status}  {cnt:6,}  {ds}")

    kept, skipped = [], []
    for p in places:
        has_skip = any(ds in SKIP_SOURCES for ds in p["datasets"])
        if has_skip:
            skipped.append(p)
        else:
            kept.append(p)

    # Quality filter: must have name + valid coordinates
    quality = [
        p for p in kept
        if p.get("name")
        and p.get("lat") is not None
        and p.get("lng") is not None
        and BBOX_LAT_MIN <= p["lat"] <= BBOX_LAT_MAX
        and BBOX_LNG_MIN <= p["lng"] <= BBOX_LNG_MAX
    ]

    print(f"\nKept (unique sources)    : {len(kept):,}")
    print(f"Skipped (FSQ/OSM)        : {len(skipped):,}")
    print(f"After quality filter     : {len(quality):,}")

    kept_ds = Counter()
    for p in quality:
        for ds in p["datasets"]:
            if ds != "Overture":
                kept_ds[ds] += 1
    print("\nKept farms by dataset:")
    for ds, cnt in kept_ds.most_common():
        print(f"  {cnt:6,}  {ds}")

    return quality, skipped, ds_counts, kept_ds

# ── Stage 3: deduplication ────────────────────────────────────────────────────

def stage3_dedup(farms):
    print("\n" + "="*60)
    print("STAGE 3: Deduplication against existing farms")
    print("="*60)

    existing_farms, existing_coords = load_existing_farms()

    existing_name_city = set()
    for f in existing_farms:
        name = (f.get("name") or "").strip().lower()
        city = (f.get("city") or "").strip().lower()
        if name and city:
            existing_name_city.add((name, city))

    new_farms, duplicates = [], []
    LAT_D, LON_D = 0.001, 0.002  # ~100m bounding box pre-filter

    for f in farms:
        name = (f.get("name") or "").strip().lower()
        city = (f.get("city") or "").strip().lower()
        lat  = f["lat"]
        lon  = f["lng"]

        # Text match
        name_match = (name, city) in existing_name_city

        # Geo match: bbox pre-filter → haversine
        coord_match = False
        if not name_match and existing_coords:
            for ef in existing_coords:
                ef_lat = ef.get("lat")
                ef_lng = ef.get("lng")
                if ef_lat is None or ef_lng is None:
                    continue
                if abs(lat - ef_lat) <= LAT_D and abs(lon - ef_lng) <= LON_D:
                    if haversine_m(lat, lon, ef_lat, ef_lng) <= 100:
                        coord_match = True
                        break

        if name_match or coord_match:
            duplicates.append(f)
        else:
            new_farms.append(f)

    print(f"  New farms  : {len(new_farms):,}")
    print(f"  Duplicates : {len(duplicates):,}")

    return new_farms, duplicates

# ── Helpers ───────────────────────────────────────────────────────────────────

def clean_for_json(obj):
    if obj is None or isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, (list, tuple)):
        return [clean_for_json(x) for x in obj]
    if isinstance(obj, dict):
        return {k: clean_for_json(v) for k, v in obj.items()}
    return str(obj)

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Overture Maps — Unique Sources Farm Extractor")
    print(f"Release  : 2026-04-15.0")
    print(f"Started  : {datetime.now().isoformat()}")
    print(f"Target   : NL+BE farms from Meta, Microsoft, AllThePlaces, PinMeTo, DAC, Krick")
    print("="*60)

    con = get_db()
    print("DuckDB ready (httpfs + spatial, anonymous S3)")

    # Stage 1: extract
    places_raw = stage1_extract(con)

    if not places_raw:
        print("\nNo places extracted — check query or network.")
        sys.exit(1)

    # Stage 2: source filter
    quality, skipped_fsq_osm, all_ds_counts, kept_ds_counts = stage2_source_filter(places_raw)

    # Stage 3: dedup
    new_farms, duplicates = stage3_dedup(quality)

    # Category breakdown in new farms
    cat_breakdown = Counter(f.get("category") for f in new_farms)

    # Country breakdown
    country_breakdown = Counter(f.get("country") for f in new_farms)

    # Serialize
    new_farms_clean  = [clean_for_json(f) for f in new_farms]
    duplicates_clean = [clean_for_json(f) for f in duplicates]

    # Write
    NEW_FARMS_FILE.write_text(
        json.dumps(new_farms_clean, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    DUPES_FILE.write_text(
        json.dumps(duplicates_clean, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    report = {
        "generated_at":           datetime.now().isoformat(),
        "overture_release":       "2026-04-15.0",
        "target_countries":       ["NL", "BE"],
        "farm_categories_queried": FARM_CATEGORIES,
        "total_raw_matches":      len(places_raw),
        "source_breakdown_all":   dict(all_ds_counts.most_common()),
        "after_source_filter":    len(quality),
        "skipped_fsq_osm":        len(skipped_fsq_osm),
        "source_breakdown_kept":  dict(kept_ds_counts.most_common()),
        "new_farms":              len(new_farms),
        "duplicates":             len(duplicates),
        "country_breakdown_new":  dict(country_breakdown.most_common()),
        "category_breakdown_new": dict(cat_breakdown.most_common()),
        "sample_new_farms":       new_farms_clean[:15],
    }

    REPORT_FILE.write_text(
        json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    # ── Final summary ─────────────────────────────────────────────────────────
    print("\n" + "="*60)
    print("FINAL SUMMARY")
    print("="*60)
    print(f"Overture release        : 2026-04-15.0")
    print(f"Raw matches (NL+BE)     : {len(places_raw):,}")
    print(f"After source filter     : {len(quality):,}  (skipped {len(skipped_fsq_osm):,} FSQ/OSM)")
    print(f"New farms (not in DB)   : {len(new_farms):,}")
    print(f"Duplicates              : {len(duplicates):,}")
    print(f"\nNew farms by source:")
    for ds, cnt in kept_ds_counts.most_common():
        print(f"  {cnt:6,}  {ds}")
    print(f"\nNew farms by category (top 15):")
    for cat, cnt in cat_breakdown.most_common(15):
        print(f"  {cnt:5,}  {cat}")
    print(f"\nNew farms by country:")
    for cc, cnt in country_breakdown.most_common():
        print(f"  {cnt:6,}  {cc}")
    print(f"\nOutputs written:")
    print(f"  {NEW_FARMS_FILE.name}  ({len(new_farms):,} records)")
    print(f"  {DUPES_FILE.name}  ({len(duplicates):,} records)")
    print(f"  {REPORT_FILE.name}")
    print(f"\nDone: {datetime.now().isoformat()}")


if __name__ == "__main__":
    main()
