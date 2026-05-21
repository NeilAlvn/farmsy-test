"""
enrich_foursquare.py

Enriches data/foursquare_clean.json with Google Places data.
Adapted from enrich_traces_full.py — same approach, same cost model.

- Phone, website, opening hours, rating, 1 photo per farm
- Checkpoint/resume support (safe to Ctrl+C and restart)
- Saves every 100 records
"""

import os
import sys
import json
import time
import requests
from pathlib import Path
from datetime import datetime

# Force UTF-8 output so special characters in business names don't crash on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ── Config ─────────────────────────────────────────────────────────────────────

INPUT_FILE      = "data/foursquare_clean.json"
OUTPUT_FILE     = "data/foursquare_enriched.json"
CHECKPOINT_FILE = "data/foursquare_enrichment_checkpoint.json"
BATCH_SAVE_SIZE = 100
PLACES_BASE     = "https://maps.googleapis.com/maps/api/place"

COUNTRY_NAMES = {"NL": "Netherlands", "BE": "Belgium"}

# ── API key ────────────────────────────────────────────────────────────────────

def get_api_key():
    key = os.environ.get("GOOGLE_PLACES_API_KEY")
    if key:
        return key
    for candidate in [".env.local", ".env"]:
        env_path = Path(candidate)
        if env_path.exists():
            with open(env_path, encoding="utf-8") as f:
                for line in f:
                    if "GOOGLE_PLACES_API_KEY" in line and "=" in line:
                        val = line.split("=", 1)[1].strip().strip("'\"")
                        if val and not val.startswith("#"):
                            return val
    return None

# ── Google Places client ────────────────────────────────────────────────────────

class GooglePlacesClient:
    def __init__(self, api_key):
        self.api_key = api_key
        self.calls_text_search = 0
        self.calls_details = 0

    def _get(self, endpoint, params):
        params["key"] = self.api_key
        r = requests.get(f"{PLACES_BASE}/{endpoint}", params=params, timeout=15)
        r.raise_for_status()
        return r.json()

    def text_search(self, name, address, locality, country_code):
        country = COUNTRY_NAMES.get(country_code, country_code)
        parts = [p for p in [name, address, locality, country] if p]
        query = ", ".join(parts)
        self.calls_text_search += 1
        try:
            data = self._get("textsearch/json", {
                "query": query,
                "language": "nl",
                "type": "establishment",
            })
            results = data.get("results", [])
            return results[0]["place_id"] if results else None
        except Exception as e:
            print(f" search-error: {e}")
            return None

    def place_details(self, place_id):
        fields = (
            "name,formatted_address,formatted_phone_number,website,"
            "opening_hours,rating,user_ratings_total,photos,types"
        )
        self.calls_details += 1
        try:
            data = self._get("details/json", {
                "place_id": place_id,
                "fields": fields,
                "language": "nl",
            })
            return data.get("result") if data.get("status") == "OK" else None
        except Exception as e:
            print(f" details-error: {e}")
            return None

    def resolve_photo_url(self, photo_reference, max_width=800):
        try:
            r = requests.get(
                f"{PLACES_BASE}/photo",
                params={"maxwidth": max_width, "photoreference": photo_reference, "key": self.api_key},
                timeout=15,
                allow_redirects=False,
            )
            if r.status_code in (301, 302, 303):
                return r.headers.get("Location")
            if r.status_code == 200:
                return r.url
        except Exception:
            pass
        return None

# ── Persistence ────────────────────────────────────────────────────────────────

def save_progress(results, stats, processed_ids):
    data = {
        "metadata": {
            "timestamp": datetime.now().isoformat(),
            "stats": stats,
            "processed_count": len(processed_ids),
        },
        "processed_ids": list(processed_ids),
        "results": results,
    }
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
        json.dump({"processed_ids": list(processed_ids), "stats": stats}, f)

# ── Main ────────────────────────────────────────────────────────────────────────

def main():
    api_key = get_api_key()
    if not api_key:
        print("ERROR: GOOGLE_PLACES_API_KEY not found in environment or .env.local")
        return

    if not Path(INPUT_FILE).exists():
        print(f"ERROR: {INPUT_FILE} not found")
        return

    with open(INPUT_FILE, encoding="utf-8") as f:
        all_farms = json.load(f)

    print(f"Loaded {len(all_farms):,} farms from {INPUT_FILE}")

    # Resume logic
    results = []
    processed_ids = set()
    stats = {
        "SUCCESS": 0, "PARTIAL": 0, "NOT_FOUND": 0,
        "total_tested": 0, "data_points": 0,
    }

    if Path(OUTPUT_FILE).exists():
        with open(OUTPUT_FILE, encoding="utf-8") as f:
            existing = json.load(f)
        results = existing.get("results", [])
        processed_ids = set(existing.get("processed_ids", []))
        stats = existing["metadata"]["stats"]
        print(f"Resuming — {len(processed_ids):,} already processed, {len(all_farms) - len(processed_ids):,} remaining")

    to_process = [f for f in all_farms if f["fsq_place_id"] not in processed_ids]
    total = len(to_process)

    if total == 0:
        print("All farms already processed.")
        return

    print(f"Enriching {total:,} farms  (~${total * 0.024:.0f} estimated cost)")
    print()

    client = GooglePlacesClient(api_key)

    try:
        for i, farm in enumerate(to_process, 1):
            fsq_id   = farm["fsq_place_id"]
            name     = farm.get("name") or ""
            address  = farm.get("address") or ""
            locality = farm.get("locality") or ""
            country  = farm.get("country") or "NL"

            print(f"[{i}/{total}] {name} ({locality})...", end="", flush=True)

            place_id = client.text_search(name, address, locality, country)

            if not place_id:
                print(" NOT_FOUND")
                results.append({
                    "fsq_place_id": fsq_id,
                    "name": name,
                    "status": "NOT_FOUND",
                    "original": farm,
                })
                stats["NOT_FOUND"] += 1
            else:
                details = client.place_details(place_id)
                if not details:
                    print(" NO_DETAILS")
                    results.append({
                        "fsq_place_id": fsq_id,
                        "name": name,
                        "status": "NOT_FOUND",
                        "original": farm,
                    })
                    stats["NOT_FOUND"] += 1
                else:
                    phone   = details.get("formatted_phone_number")
                    website = details.get("website")
                    hours   = (details.get("opening_hours") or {}).get("weekday_text")
                    rating  = details.get("rating")
                    reviews = details.get("user_ratings_total")

                    image_url = None
                    photos = details.get("photos", [])
                    if photos:
                        image_url = client.resolve_photo_url(photos[0]["photo_reference"])

                    status = "SUCCESS" if (phone or website or hours) else "PARTIAL"
                    print(f" {status}")

                    results.append({
                        "fsq_place_id": fsq_id,
                        "name": name,
                        "status": status,
                        "original": farm,
                        "google_data": {
                            "phone":         phone,
                            "website":       website,
                            "opening_hours": hours,
                            "rating":        rating,
                            "reviews":       reviews,
                            "image_url":     image_url,
                            "place_types":   details.get("types", []),
                        },
                    })
                    stats[status] += 1
                    for val in [phone, website, hours, rating, image_url]:
                        if val:
                            stats["data_points"] += 1

            processed_ids.add(fsq_id)
            stats["total_tested"] += 1

            if i % BATCH_SAVE_SIZE == 0:
                pct = i / total * 100
                cost = stats["total_tested"] * 0.024
                print(f"\n--- Checkpoint {i}/{total} ({pct:.0f}%)  "
                      f"SUCCESS:{stats['SUCCESS']} PARTIAL:{stats['PARTIAL']} NOT_FOUND:{stats['NOT_FOUND']}  "
                      f"~${cost:.2f} spent ---\n")
                save_progress(results, stats, processed_ids)

            time.sleep(0.1)

    except KeyboardInterrupt:
        print("\n\nInterrupted — saving progress...")
    finally:
        save_progress(results, stats, processed_ids)
        total_done = stats["total_tested"]
        print(f"\n{'='*60}")
        print(f"Done: {total_done:,} processed")
        print(f"  SUCCESS:   {stats['SUCCESS']:,}")
        print(f"  PARTIAL:   {stats['PARTIAL']:,}")
        print(f"  NOT_FOUND: {stats['NOT_FOUND']:,}")
        print(f"  Data points collected: {stats['data_points']:,}")
        print(f"  Estimated cost: ~${total_done * 0.024:.2f}")
        print(f"Output: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
