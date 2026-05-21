import os
import csv
import json
import random
import time
import requests
from pathlib import Path
from datetime import datetime

# ─── Configuration ────────────────────────────────────────────────────────────

PLACES_BASE = "https://maps.googleapis.com/maps/api/place"
INPUT_CSV = "data/traces_import_ready.csv"
OUTPUT_JSON = "data/traces_test_batch_results.json"
BATCH_SIZE = 100

def get_api_key():
    # Try environment variable first
    key = os.environ.get("GOOGLE_PLACES_API_KEY")
    if key:
        return key
    
    # Fallback: Parse .env.local (including commented out keys as per user hint)
    env_path = Path(".env.local")
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                if "GOOGLE_PLACES_API_KEY" in line:
                    parts = line.split("=")
                    if len(parts) > 1:
                        # Strip #, whitespace, and any quotes
                        val = parts[1].strip().lstrip("#").strip().strip("'").strip('"')
                        if val:
                            return val
    return None

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

    def text_search(self, name, address, city):
        query = f"{name}, {address}, {city}, Netherlands"
        params = {"query": query, "language": "nl", "type": "establishment"}
        self.calls_text_search += 1
        data = self._get("textsearch/json", params)
        results = data.get("results", [])
        return results[0]["place_id"] if results else None

    def place_details(self, place_id):
        fields = (
            "name,formatted_address,formatted_phone_number,website,"
            "opening_hours,editorial_summary,rating,user_ratings_total,photos,types"
        )
        self.calls_details += 1
        data = self._get("details/json", {
            "place_id": place_id, "fields": fields, "language": "nl"
        })
        return data.get("result") if data.get("status") == "OK" else None

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

def main():
    api_key = get_api_key()
    if not api_key:
        print("Error: GOOGLE_PLACES_API_KEY not found in environment or .env.local")
        return

    print(f"Using API Key: {api_key[:8]}...{api_key[-4:]}")
    client = GooglePlacesClient(api_key)

    if not os.path.exists(INPUT_CSV):
        print(f"Error: Input file {INPUT_CSV} not found.")
        return

    # Load and sample farms
    with open(INPUT_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        all_farms = list(reader)

    print(f"Loaded {len(all_farms)} farms from {INPUT_CSV}")
    test_batch = random.sample(all_farms, min(BATCH_SIZE, len(all_farms)))
    print(f"Selected {len(test_batch)} random farms for Phase 1 test.")

    results = []
    stats = {
        "SUCCESS": 0,
        "PARTIAL": 0,
        "NOT_FOUND": 0,
        "total_tested": 0,
        "data_points": 0
    }

    for i, farm in enumerate(test_batch, 1):
        name = farm["name"]
        address = farm["address"]
        city = farm["city"]
        osm_id = farm["osm_id"]

        print(f"[{i}/{BATCH_SIZE}] Searching: {name} in {city}...", end="", flush=True)
        
        try:
            place_id = client.text_search(name, address, city)
            if not place_id:
                print(" NOT FOUND")
                results.append({"osm_id": osm_id, "name": name, "status": "NOT_FOUND"})
                stats["NOT_FOUND"] += 1
            else:
                details = client.place_details(place_id)
                if not details:
                    print(" NO DETAILS")
                    results.append({"osm_id": osm_id, "name": name, "status": "NOT_FOUND"})
                    stats["NOT_FOUND"] += 1
                    continue

                # Extract fields
                phone = details.get("formatted_phone_number")
                website = details.get("website")
                hours = (details.get("opening_hours") or {}).get("weekday_text")
                rating = details.get("rating")
                reviews = details.get("user_ratings_total")
                types = details.get("types", [])
                
                # Image resolution
                image_url = None
                photos = details.get("photos", [])
                if photos:
                    image_url = client.resolve_photo_url(photos[0]["photo_reference"])

                # Determine status
                has_contact = bool(phone or website or hours)
                status = "SUCCESS" if has_contact else "PARTIAL"
                
                print(f" {status}")
                
                enriched_data = {
                    "osm_id": osm_id,
                    "name": name,
                    "status": status,
                    "google_data": {
                        "phone": phone,
                        "website": website,
                        "opening_hours": hours,
                        "rating": rating,
                        "reviews": reviews,
                        "place_types": types,
                        "image_url": image_url
                    }
                }
                results.append(enriched_data)
                stats[status] += 1
                
                # Increment completeness counter
                for val in [phone, website, hours, rating, image_url]:
                    if val: stats["data_points"] += 1

        except Exception as e:
            print(f" ERROR: {e}")
            results.append({"osm_id": osm_id, "name": name, "status": "ERROR", "error": str(e)})

        stats["total_tested"] += 1
        time.sleep(0.2) # Small delay to be polite

    # Generate Report
    success_rate = (stats["SUCCESS"] / stats["total_tested"]) * 100 if stats["total_tested"] > 0 else 0
    avg_completeness = (stats["data_points"] / (stats["total_tested"] * 5)) * 100 if stats["total_tested"] > 0 else 0

    report = {
        "metadata": {
            "timestamp": datetime.now().isoformat(),
            "total_tested": stats["total_tested"],
            "success_rate": f"{success_rate:.1f}%",
            "avg_completeness": f"{avg_completeness:.1f}%",
            "breakdown": {
                "SUCCESS": stats["SUCCESS"],
                "PARTIAL": stats["PARTIAL"],
                "NOT_FOUND": stats["NOT_FOUND"]
            }
        },
        "results": results
    }

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print("\n" + "="*40)
    print("PHASE 1 REPORT")
    print("="*40)
    print(f"Total tested:     {stats['total_tested']}")
    print(f"Success rate:     {success_rate:.1f}%")
    print(f"Avg completeness: {avg_completeness:.1f}%")
    print(f"Breakdown:")
    print(f"  - SUCCESS:   {stats['SUCCESS']} (Found with contact info)")
    print(f"  - PARTIAL:   {stats['PARTIAL']} (Found but missing contact)")
    print(f"  - NOT_FOUND: {stats['NOT_FOUND']}")
    print(f"Results saved to: {OUTPUT_JSON}")
    print("="*40)

if __name__ == "__main__":
    main()
