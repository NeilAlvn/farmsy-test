import json
import csv
import os

# ─── Configuration ────────────────────────────────────────────────────────────

INPUT_CSV = "data/traces_import_ready.csv"
ENRICHED_JSON = "data/traces_all_enriched.json"
OUTPUT_CSV = "data/traces_verified_import_ready.csv"

def main():
    if not os.path.exists(ENRICHED_JSON):
        print(f"Error: {ENRICHED_JSON} not found.")
        return
    if not os.path.exists(INPUT_CSV):
        print(f"Error: {INPUT_CSV} not found.")
        return

    # Load Enriched Data
    print(f"Loading enriched data from {ENRICHED_JSON}...")
    with open(ENRICHED_JSON, "r", encoding="utf-8") as f:
        enriched_data = json.load(f)
    
    # Create a map for quick lookup
    enrich_map = {item["osm_id"]: item for item in enriched_data.get("results", [])}
    print(f"Loaded {len(enrich_map)} enriched records.")

    # Load Original Metadata
    print(f"Reading original farms from {INPUT_CSV}...")
    final_rows = []
    stats = {
        "total_source": 0,
        "verified_consumer": 0,
        "skipped_wholesale": 0,
        "not_found": 0,
        "has_phone": 0,
        "has_website": 0,
        "has_hours": 0,
        "has_image": 0
    }

    with open(INPUT_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        # Add our new columns
        new_cols = ["phone", "website_google", "opening_hours", "google_rating", "google_reviews", "image_url"]
        output_fieldnames = fieldnames + new_cols

        for row in reader:
            stats["total_source"] += 1
            osm_id = row["osm_id"]
            
            enrich_info = enrich_map.get(osm_id)
            
            if not enrich_info or enrich_info.get("status") == "NOT_FOUND":
                stats["not_found"] += 1
                stats["skipped_wholesale"] += 1
                continue
            
            # Filter: SUCCESS or PARTIAL
            # But the user's Phase 3 requirement: "Has phone OR website OR opening_hours"
            g_data = enrich_info.get("google_data", {})
            phone = g_data.get("phone")
            website = g_data.get("website")
            hours_list = g_data.get("opening_hours")
            hours = "; ".join(hours_list) if isinstance(hours_list, list) else ""
            rating = g_data.get("rating")
            reviews = g_data.get("reviews")
            image_url = g_data.get("image_url")

            if not (phone or website or hours):
                stats["skipped_wholesale"] += 1
                continue
            
            # Verified consumer-facing!
            stats["verified_consumer"] += 1
            if phone: stats["has_phone"] += 1
            if website: stats["has_website"] += 1
            if hours: stats["has_hours"] += 1
            if image_url: stats["has_image"] += 1

            # Update row with enriched data
            # website_google to avoid conflict with original 'website' column if it existed
            row.update({
                "phone": phone or "",
                "website_google": website or "",
                "opening_hours": hours or "",
                "google_rating": rating or "",
                "google_reviews": reviews or "",
                "image_url": image_url or ""
            })
            final_rows.append(row)

    # Write Final CSV
    print(f"Writing {len(final_rows)} verified farms to {OUTPUT_CSV}...")
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=output_fieldnames)
        writer.writeheader()
        writer.writerows(final_rows)

    print("\n" + "="*40)
    print("PHASE 3: PREPARE IMPORT COMPLETE")
    print("="*40)
    print(f"Total Organic Farms (Source): {stats['total_source']}")
    print(f"Verified Consumer-Facing:      {stats['verified_consumer']}")
    print(f"Skipped (No Google Presence):  {stats['skipped_wholesale']}")
    print("\nData Richness for Verified Farms:")
    print(f" - Phone Numbers:   {stats['has_phone']}")
    print(f" - Websites:        {stats['has_website']}")
    print(f" - Opening Hours:   {stats['has_hours']}")
    print(f" - Quality Images:  {stats['has_image']}")
    print("="*40)

if __name__ == "__main__":
    main()
