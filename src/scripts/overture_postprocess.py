"""
overture_postprocess.py

Post-processes data/overture_unique_sources.json:
  1. Filters to NL+BE only (removes DE/FR/LU entries from wide bbox)
  2. Re-runs dedup against ALL 6,848 farms with proper coord pagination
  3. Saves cleaned output to data/overture_nlbe_new.json

Run after overture_extract.py.
"""

import json
import math
import os
import urllib.request
from pathlib import Path
from datetime import datetime
from collections import Counter

os.environ.setdefault("PYTHONIOENCODING", "utf-8")

ROOT     = Path(__file__).parent.parent.parent
DATA_DIR = ROOT / "data"

IN_FILE      = DATA_DIR / "overture_unique_sources.json"
OUT_NEW      = DATA_DIR / "overture_nlbe_new.json"
OUT_DUPES    = DATA_DIR / "overture_nlbe_duplicates.json"
OUT_REPORT   = DATA_DIR / "overture_nlbe_report.json"

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

# ── Supabase helpers ──────────────────────────────────────────────────────────

def supabase_get(path, params=None):
    url = f"{SUPABASE_URL}{path}"
    if params:
        url += "?" + "&".join(f"{k}={v}" for k, v in params.items())
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def supabase_rpc(fn, body, limit=1000, offset=0):
    url = f"{SUPABASE_URL}/rest/v1/rpc/{fn}?limit={limit}&offset={offset}"
    data = json.dumps(body).encode()
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())

def load_all_farms():
    """Load name+city for text dedup, and lat/lng for geo dedup."""
    print("Loading existing farms from Supabase...")

    # Text dedup: name + city
    name_city = set()
    offset, PAGE = 0, 1000
    while True:
        batch = supabase_get(
            "/rest/v1/farms",
            {"select": "name,city", "is_published": "eq.true",
             "limit": str(PAGE), "offset": str(offset)},
        )
        for f in batch:
            name = (f.get("name") or "").strip().lower()
            city = (f.get("city") or "").strip().lower()
            if name and city:
                name_city.add((name, city))
        if len(batch) < PAGE:
            break
        offset += PAGE
    print(f"  Name+city pairs: {len(name_city):,}")

    # Geo dedup: paginate get_farms_slim via offset query param
    coords = []
    PAGE = 1000
    offset = 0
    while True:
        batch = supabase_rpc("get_farms_slim", {}, limit=PAGE, offset=offset)
        if not isinstance(batch, list) or not batch:
            break
        coords.extend(batch)
        if len(batch) < PAGE:
            break
        offset += PAGE
    print(f"  Coordinates   : {len(coords):,}")

    return name_city, coords

# ── Haversine ─────────────────────────────────────────────────────────────────

def haversine_m(lat1, lon1, lat2, lon2):
    R = 6_371_000
    p = math.pi / 180
    a = (math.sin((lat2 - lat1) * p / 2) ** 2 +
         math.cos(lat1 * p) * math.cos(lat2 * p) *
         math.sin((lon2 - lon1) * p / 2) ** 2)
    return 2 * R * math.asin(min(1.0, math.sqrt(a)))

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Overture Post-Processor — NL+BE filter + full dedup")
    print(f"Started: {datetime.now().isoformat()}")

    # Load extraction output
    print(f"\nLoading {IN_FILE.name}...")
    farms = json.loads(IN_FILE.read_text(encoding="utf-8"))
    print(f"  Loaded {len(farms):,} records")

    # ── Step 1: country filter ────────────────────────────────────────────────
    print("\nStep 1: Filter to NL+BE")
    country_counts = Counter(f.get("country") for f in farms)
    print("  Country breakdown before filter:")
    for cc, cnt in country_counts.most_common():
        keep = "KEEP" if cc in ("NL", "BE") else ("KEEP?" if cc is None else "DROP")
        print(f"    {keep}  {cnt:6,}  {cc or 'NULL'}")

    # Keep NL, BE, and NULL-country entries within strict NL/BE coordinate bounds
    NL_BE_LNG = (2.5, 7.3)
    NL_BE_LAT = (49.5, 53.6)

    nlbe = []
    dropped_country = []
    for f in farms:
        cc = f.get("country")
        if cc in ("NL", "BE"):
            nlbe.append(f)
        elif cc is None:
            lat, lng = f.get("lat"), f.get("lng")
            if (lat and lng and
                NL_BE_LAT[0] <= lat <= NL_BE_LAT[1] and
                NL_BE_LNG[0] <= lng <= NL_BE_LNG[1]):
                nlbe.append(f)
            else:
                dropped_country.append(f)
        else:
            dropped_country.append(f)

    print(f"  NL+BE (kept) : {len(nlbe):,}")
    print(f"  Other (dropped): {len(dropped_country):,}  ({Counter(f.get('country') for f in dropped_country).most_common()})")

    # ── Step 2: full dedup ────────────────────────────────────────────────────
    print("\nStep 2: Full deduplication against all 6,848 farms")
    name_city, existing_coords = load_all_farms()

    new_farms, duplicates = [], []
    LAT_D, LON_D = 0.001, 0.002

    for f in nlbe:
        name = (f.get("name") or "").strip().lower()
        city = (f.get("city") or "").strip().lower()
        lat  = f.get("lat")
        lon  = f.get("lng")

        name_match = (name, city) in name_city

        coord_match = False
        if not name_match and lat is not None and lon is not None:
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

    # ── Step 3: breakdowns ───────────────────────────────────────────────────
    cat_breakdown     = Counter(f.get("category") for f in new_farms)
    country_breakdown = Counter(f.get("country") for f in new_farms)
    source_breakdown  = Counter()
    for f in new_farms:
        for ds in f.get("datasets", []):
            if ds != "Overture":
                source_breakdown[ds] += 1

    # ── Save ─────────────────────────────────────────────────────────────────
    OUT_NEW.write_text(
        json.dumps(new_farms, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    OUT_DUPES.write_text(
        json.dumps(duplicates, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    report = {
        "generated_at":           datetime.now().isoformat(),
        "input_file":             IN_FILE.name,
        "input_records":          len(farms),
        "after_country_filter":   len(nlbe),
        "dropped_non_nlbe":       len(dropped_country),
        "existing_farms_in_db":   len(name_city),
        "coords_checked":         len(existing_coords),
        "new_farms":              len(new_farms),
        "duplicates":             len(duplicates),
        "source_breakdown":       dict(source_breakdown.most_common()),
        "category_breakdown":     dict(cat_breakdown.most_common()),
        "country_breakdown":      dict(country_breakdown.most_common()),
        "sample_new_farms":       new_farms[:15],
    }
    OUT_REPORT.write_text(
        json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    print(f"\n{'='*60}")
    print("FINAL SUMMARY")
    print(f"{'='*60}")
    print(f"Input (all countries)   : {len(farms):,}")
    print(f"After NL+BE filter      : {len(nlbe):,}")
    print(f"  Dropped (DE/FR/LU/..) : {len(dropped_country):,}")
    print(f"Coords checked against  : {len(existing_coords):,} existing farms")
    print(f"New farms (NL+BE only)  : {len(new_farms):,}")
    print(f"Duplicates found        : {len(duplicates):,}")
    print(f"\nOutputs:")
    print(f"  {OUT_NEW.name}  ({len(new_farms):,} records)")
    print(f"  {OUT_DUPES.name}  ({len(duplicates):,} records)")
    print(f"  {OUT_REPORT.name}")
    print(f"\nDone: {datetime.now().isoformat()}")


if __name__ == "__main__":
    main()
