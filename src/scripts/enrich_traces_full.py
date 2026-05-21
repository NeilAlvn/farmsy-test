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
OUTPUT_JSON = "data/traces_all_enriched.json"
CHECKPOINT_FILE = "data/traces_enrichment_checkpoint.json"
BATCH_SAVE_SIZE = 100

def get_api_key():
    key = os.environ.get("GOOGLE_PLACES_API_KEY")
    if key: return key
    env_path = Path(".env.local")
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                if "GOOGLE_PLACES_API_KEY" in line:
                    parts = line.split("=")
                    if len(parts) > 1:
                        val = parts[1].strip().lstrip("#").strip().strip("'").strip('"')
                        if val: return val
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
        try:
            data = self._get("textsearch/json", params)
            results = data.get("results", [])
            return results[0]["place_id"] if results else None
        except Exception as e:
            print(f" Search Error: {e}")
            return None

    def place_details(self, place_id):
        fields = (
            "name,formatted_address,formatted_phone_number,website,"
            "opening_hours,editorial_summary,rating,user_ratings_total,photos,types"
        )
        self.calls_details += 1
        try:
            data = self._get("details/json", {
                "place_id": place_id, "fields": fields, "language": "nl"
            })
            return data.get("result") if data.get("status") == "OK" else None
        except Exception as e:
            print(f" Details Error: {e}")
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

def save_progress(results, stats, processed_ids):
    data = {
        "metadata": {
            "timestamp": datetime.now().isoformat(),
            "stats": stats,
            "processed_count": len(processed_ids)
        },
        "processed_ids": list(processed_ids),
        "results": results
    }
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
        json.dump({"processed_ids": list(processed_ids), "stats": stats}, f)

def main():
    api_key = get_api_key()
    if not api_key:
        print("Error: GOOGLE_PLACES_API_KEY not found")
        return

    client = GooglePlacesClient(api_key)
    
    if not os.path.exists(INPUT_CSV):
        print(f"Error: {INPUT_CSV} not found")
        return

    # Load All
    with open(INPUT_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        all_farms = list(reader)

    # Resume Logic
    results = []
    processed_ids = set()
    stats = {"SUCCESS": 0, "PARTIAL": 0, "NOT_FOUND": 0, "total_tested": 0, "data_points": 0}

    if os.path.exists(OUTPUT_JSON):
        with open(OUTPUT_JSON, "r", encoding="utf-8") as f:
            existing_data = json.load(f)
            results = existing_data.get("results", [])
            processed_ids = set(existing_data.get("processed_ids", []))
            stats = existing_data["metadata"]["stats"]
            print(f"Resuming from {len(processed_ids)} processed farms.")

    to_process = [f for f in all_farms if f["osm_id"] not in processed_ids]
    total_to_process = len(to_process)
    print(f"Starting full enrichment of {total_to_process} remaining farms.")

    try:
        for i, farm in enumerate(to_process, 1):
            name, address, city, osm_id = farm["name"], farm["address"], farm["city"], farm["osm_id"]
            
            print(f"[{i}/{total_to_process}] {name} ({city})...", end="", flush=True)
            
            place_id = client.text_search(name, address, city)
            if not place_id:
                print(" NOT_FOUND")
                results.append({"osm_id": osm_id, "name": name, "status": "NOT_FOUND"})
                stats["NOT_FOUND"] += 1
            else:
                details = client.place_details(place_id)
                if not details:
                    print(" NO_DETAILS")
                    results.append({"osm_id": osm_id, "name": name, "status": "NOT_FOUND"})
                    stats["NOT_FOUND"] += 1
                else:
                    phone = details.get("formatted_phone_number")
                    website = details.get("website")
                    hours = (details.get("opening_hours") or {}).get("weekday_text")
                    rating = details.get("rating")
                    reviews = details.get("user_ratings_total")
                    
                    image_url = None
                    photos = details.get("photos", [])
                    if photos:
                        image_url = client.resolve_photo_url(photos[0]["photo_reference"])

                    status = "SUCCESS" if (phone or website or hours) else "PARTIAL"
                    print(f" {status}")
                    
                    results.append({
                        "osm_id": osm_id, "name": name, "status": status,
                        "google_data": {
                            "phone": phone, "website": website, "opening_hours": hours,
                            "rating": rating, "reviews": reviews, "image_url": image_url,
                            "place_types": details.get("types", [])
                        }
                    })
                    stats[status] += 1
                    for val in [phone, website, hours, rating, image_url]:
                        if val: stats["data_points"] += 1

            processed_ids.add(osm_id)
            stats["total_tested"] += 1
            
            if i % BATCH_SAVE_SIZE == 0:
                print(f"\n--- Autosaving progress at {i} farms ---")
                save_progress(results, stats, processed_ids)
            
            time.sleep(0.1) # Respect quotas

    except KeyboardInterrupt:
        print("\nInterrupted by user. Saving progress...")
    finally:
        save_progress(results, stats, processed_ids)
        print("\nFull enrichment run complete or paused.")

if __name__ == "__main__":
    main()
