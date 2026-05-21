#!/usr/bin/env python3
"""
enrich_database_google.py

Enriches the De Lokale Boer farm database using the Google Places API.

TWO-STEP WORKFLOW (like osm-import.ts):

  Step 1 — Fetch & enrich, save results to JSON:
      python enrich_database_google.py

  Step 2 — Review JSON, then apply to Supabase:
      python enrich_database_google.py --save

Other options:
  --skip-image-check   Skip broken-image detection
  --skip-google        Skip Google Places enrichment
  --validate-only      Report only, no writes
  --resume             Continue from checkpoint (step 1 only)
  --max-farms N        Limit to N farms (useful for testing)
  --output-dir PATH    Where to write files (default: ./output/enrichment)
  --google-api-key KEY Override GOOGLE_PLACES_API_KEY env var
"""

import os
import sys
import json
import csv
import time
import logging
import argparse
import requests
from datetime import datetime
from pathlib import Path
from typing import Optional

# ─── Load .env.local ─────────────────────────────────────────────────────────

def _load_env():
    for candidate in [
        Path(__file__).parent.parent.parent / ".env.local",
        Path(__file__).parent.parent.parent / ".env",
        Path.cwd() / ".env.local",
        Path.cwd() / ".env",
    ]:
        if candidate.exists():
            with open(candidate, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, _, v = line.partition("=")
                        os.environ.setdefault(k.strip(), v.strip())
            break

_load_env()

# ─── Configuration ────────────────────────────────────────────────────────────

SUPABASE_URL   = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY   = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
GOOGLE_API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")

BATCH_SIZE          = 50
BATCH_DELAY_S       = 2
FARM_DELAY_S        = 0.12    # per-farm delay → stays under 60 QPM
IMAGE_TIMEOUT       = 10
PLACES_BASE         = "https://maps.googleapis.com/maps/api/place"
MAX_QUOTA_PER_RUN   = 4500
DESCRIPTION_MIN_LEN = 40


# ─── Logging ─────────────────────────────────────────────────────────────────

def setup_logging(log_file: Path) -> logging.Logger:
    log_file.parent.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("enrichment")
    logger.setLevel(logging.DEBUG)
    if logger.handlers:
        return logger
    fmt = logging.Formatter("%(asctime)s [%(levelname)-7s] %(message)s")
    fh = logging.FileHandler(log_file, encoding="utf-8", mode="a")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(fmt)
    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(logging.INFO)
    ch.setFormatter(fmt)
    ch.stream = open(sys.stdout.fileno(), mode="w", encoding="utf-8", errors="replace", closefd=False)
    logger.addHandler(fh)
    logger.addHandler(ch)
    return logger


# ─── Supabase REST client ─────────────────────────────────────────────────────

class SupabaseClient:
    def __init__(self, url: str, key: str):
        self.url = url
        self._h = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

    def select_all(self, table: str, columns: str = "*",
                   extra: Optional[dict] = None) -> list:
        PAGE, rows, offset = 1000, [], 0
        while True:
            params = {"select": columns, "limit": PAGE, "offset": offset}
            if extra:
                params.update(extra)
            r = requests.get(f"{self.url}/rest/v1/{table}",
                             headers=self._h, params=params, timeout=30)
            r.raise_for_status()
            batch = r.json()
            rows.extend(batch)
            if len(batch) < PAGE:
                break
            offset += PAGE
        return rows

    def rpc(self, fn: str, body: Optional[dict] = None) -> list:
        r = requests.post(f"{self.url}/rest/v1/rpc/{fn}",
                          headers=self._h, json=body or {}, timeout=60)
        r.raise_for_status()
        return r.json()

    def update(self, table: str, record_id: int, data: dict) -> None:
        h = {**self._h, "Prefer": "return=minimal"}
        r = requests.patch(
            f"{self.url}/rest/v1/{table}",
            headers=h, params={"id": f"eq.{record_id}"}, json=data, timeout=30,
        )
        if r.status_code not in (200, 204):
            raise RuntimeError(f"Supabase PATCH failed ({r.status_code}): {r.text[:300]}")


# ─── Checkpoint ───────────────────────────────────────────────────────────────

def load_checkpoint(path: Path) -> dict:
    if path.exists():
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return {
        "started_at": datetime.utcnow().isoformat() + "Z",
        "processed_ids": [],
        "api_calls_text_search": 0,
        "api_calls_details": 0,
        "last_batch": 0,
    }

def save_checkpoint(path: Path, cp: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    cp["updated_at"] = datetime.utcnow().isoformat() + "Z"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cp, f, indent=2, ensure_ascii=False)


# ─── Image validation ─────────────────────────────────────────────────────────

def is_image_broken(url: str) -> bool:
    if not url or not url.startswith(("http://", "https://")):
        return True
    if url.startswith("google_photo:"):
        return False
    try:
        r = requests.head(url, timeout=IMAGE_TIMEOUT, allow_redirects=True,
                          headers={"User-Agent": "Mozilla/5.0 DeLokaleBoerenBot/1.0"})
        if r.status_code == 405:
            r = requests.get(url, timeout=IMAGE_TIMEOUT, stream=True,
                             headers={"User-Agent": "Mozilla/5.0 DeLokaleBoerenBot/1.0"})
        return r.status_code >= 400
    except Exception:
        return True


# ─── Google Places ────────────────────────────────────────────────────────────

class GooglePlacesClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.calls_text_search = 0
        self.calls_details = 0

    @property
    def total_calls(self) -> int:
        return self.calls_text_search + self.calls_details

    def _get(self, endpoint: str, params: dict) -> dict:
        params["key"] = self.api_key
        r = requests.get(f"{PLACES_BASE}/{endpoint}", params=params, timeout=15)
        r.raise_for_status()
        return r.json()

    def text_search(self, name: str, city: Optional[str],
                    lat: Optional[float], lng: Optional[float]) -> Optional[str]:
        query = f"{name} {city}".strip() if city else name
        params: dict = {"query": query, "language": "nl", "type": "establishment"}
        if lat is not None and lng is not None:
            params["location"] = f"{lat},{lng}"
            params["radius"] = 2000
        self.calls_text_search += 1
        data = self._get("textsearch/json", params)
        results = data.get("results", [])
        return results[0]["place_id"] if results else None

    def place_details(self, place_id: str) -> Optional[dict]:
        fields = (
            "name,formatted_address,formatted_phone_number,website,"
            "opening_hours,editorial_summary,rating,user_ratings_total,photos"
        )
        self.calls_details += 1
        data = self._get("details/json", {
            "place_id": place_id, "fields": fields, "language": "nl"
        })
        return data.get("result") if data.get("status") == "OK" else None

    def resolve_photo_url(self, photo_reference: str, max_width: int = 800) -> Optional[str]:
        """Convert a photo_reference into a real googleusercontent.com URL."""
        try:
            r = requests.get(
                f"{PLACES_BASE}/photo",
                params={"maxwidth": max_width, "photoreference": photo_reference, "key": self.api_key},
                timeout=15,
                allow_redirects=False,
            )
            # Google returns 302 → actual image URL (no API key needed)
            if r.status_code in (301, 302, 303):
                return r.headers.get("Location")
            # Some clients get 200 with the image directly — return the final URL
            if r.status_code == 200:
                return r.url
        except Exception:
            pass
        return None

    def find_farm(self, name: str, city: Optional[str],
                  lat: Optional[float], lng: Optional[float]) -> Optional[dict]:
        place_id = self.text_search(name, city, lat, lng)
        return self.place_details(place_id) if place_id else None


# ─── Fallback description ─────────────────────────────────────────────────────

_TYPE_NL = {
    "produce": "verse groenten en fruit",
    "dairy":   "zuivelproducten",
    "meat":    "vlees en vleeswaren",
    "fish":    "vis en zeevruchten",
    "eggs":    "eieren",
    "cheese":  "kaas",
    "wine":    "wijn",
    "markets": "boerenmarktproducten",
}

def generate_fallback_description(farm: dict) -> str:
    name     = farm.get("name") or "Deze boerderij"
    city     = farm.get("city")
    products = [_TYPE_NL[t] for t in (farm.get("farm_type") or []) if t in _TYPE_NL]
    if products and city:
        desc = f"{name} is een lokale boerderij in {city} die {', '.join(products)} verkoopt."
    elif products:
        desc = f"{name} verkoopt {', '.join(products)} rechtstreeks van de boerderij."
    elif city:
        desc = f"{name} is een lokale boerderij in {city}."
    else:
        desc = f"{name} is een lokale boerderij."
    if str(farm.get("organic", "")).lower() in ("yes", "1", "true"):
        desc += " De producten zijn biologisch geteeld."
    return desc


# ─── Build enrichment payload ─────────────────────────────────────────────────

def build_enrichment(farm: dict, place: dict,
                     places_client: Optional["GooglePlacesClient"] = None) -> dict:
    updates: dict = {}

    if len((farm.get("description") or "").strip()) < DESCRIPTION_MIN_LEN:
        summary = (place.get("editorial_summary") or {}).get("overview", "")
        if summary:
            updates["description"] = summary

    if not farm.get("phone"):
        ph = place.get("formatted_phone_number")
        if ph:
            updates["phone"] = ph

    if not farm.get("website"):
        ws = place.get("website")
        if ws:
            updates["website"] = ws

    if not farm.get("address"):
        addr = place.get("formatted_address")
        if addr:
            updates["address"] = addr

    if not farm.get("opening_hours"):
        weekday = (place.get("opening_hours") or {}).get("weekday_text") or []
        if weekday:
            updates["opening_hours"] = "; ".join(weekday)

    if not farm.get("image"):
        photos = place.get("photos") or []
        if photos:
            ref = photos[0].get("photo_reference", "")
            if ref:
                # Resolve to a real googleusercontent.com URL
                resolved = places_client.resolve_photo_url(ref) if places_client else None
                updates["image"] = resolved if resolved else f"google_photo:{ref}"

    if updates:
        updates["google_rating"]       = place.get("rating")
        updates["google_review_count"] = place.get("user_ratings_total")
        updates["source"] = f"{(farm.get('source') or 'unknown')}|google_places"

    return updates


# ─── Stats helpers ────────────────────────────────────────────────────────────

def snapshot(farms: list) -> dict:
    def filled(f: dict) -> int:
        return sum(1 for k in ["description", "phone", "website", "opening_hours", "image"]
                   if f.get(k))
    total = len(farms)
    return {
        "total":            total,
        "with_description": sum(1 for f in farms if (f.get("description") or "").strip()),
        "with_phone":       sum(1 for f in farms if f.get("phone")),
        "with_website":     sum(1 for f in farms if f.get("website")),
        "with_hours":       sum(1 for f in farms if f.get("opening_hours")),
        "with_image":       sum(1 for f in farms if f.get("image")),
        "avg_completeness": round(sum(filled(f) / 5 for f in farms) / max(total, 1), 3),
    }

def find_duplicates(farms: list) -> list:
    seen: dict = {}
    for farm in farms:
        key = (
            (farm.get("name") or "").strip().lower(),
            (farm.get("city") or "").strip().lower(),
        )
        seen.setdefault(key, []).append(farm)
    return [{"key": k, "farms": v} for k, v in seen.items() if len(v) > 1]


# ─── CLI ──────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Enrich farms via Google Places → JSON → Supabase")
    p.add_argument("--save", action="store_true",
                   help="Step 2: read enrichment JSON and apply to Supabase")
    p.add_argument("--skip-image-check", action="store_true")
    p.add_argument("--skip-google", action="store_true")
    p.add_argument("--validate-only", action="store_true",
                   help="Phase 3 only (validation report, no writes)")
    p.add_argument("--resume", action="store_true",
                   help="Continue step 1 from existing checkpoint")
    p.add_argument("--max-farms", type=int, default=0)
    p.add_argument("--output-dir", default="./output/enrichment")
    p.add_argument("--google-api-key", default="")
    return p.parse_args()


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1 — Fetch, enrich, save to JSON
# ═══════════════════════════════════════════════════════════════════════════════

def run_step1(args, out_dir: Path, log):
    log_file        = out_dir / "enrichment_log.txt"
    results_file    = out_dir / "enrichment_results.json"
    checkpoint_file = out_dir / "enrichment_checkpoint.json"
    not_found_csv   = out_dir / "farms_not_in_google.csv"

    google_key = args.google_api_key or GOOGLE_API_KEY
    if not google_key and not args.skip_google and not args.validate_only:
        log.error("GOOGLE_PLACES_API_KEY must be set (or pass --google-api-key / --skip-google).")
        sys.exit(1)

    db     = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
    places = GooglePlacesClient(google_key) if google_key else None

    cp = (load_checkpoint(checkpoint_file)
          if args.resume and checkpoint_file.exists()
          else load_checkpoint(Path("/nonexistent_placeholder")))
    already_done: set[int] = set(cp["processed_ids"])
    if args.resume and already_done:
        log.info(f"Resuming — {len(already_done):,} farms already processed")

    # Load existing results JSON when resuming so we can append
    existing_updates: dict[int, dict] = {}   # id → record
    existing_broken:  list[dict]      = []
    existing_not_found: list[dict]    = []
    if args.resume and results_file.exists():
        with open(results_file, encoding="utf-8") as f:
            prev = json.load(f)
        for rec in prev.get("updates", []):
            existing_updates[rec["id"]] = rec
        existing_broken     = prev.get("broken_images", [])
        existing_not_found  = prev.get("not_found", [])
        log.info(f"Loaded {len(existing_updates):,} previous updates from {results_file.name}")

    # ── Fetch farms ──────────────────────────────────────────────────────────
    log.info("Fetching all farms from database…")
    farms = db.select_all(
        "farms",
        "id,name,address,city,postal_code,country,website,phone,email,"
        "opening_hours,description,image,farm_type,organic,is_published,osm_id,source",
        {"is_published": "eq.true"},
    )
    log.info(f"Loaded {len(farms):,} published farms")

    before = snapshot(farms)
    log.info(
        f"BEFORE — desc:{before['with_description']} phone:{before['with_phone']} "
        f"web:{before['with_website']} img:{before['with_image']} "
        f"completeness:{before['avg_completeness']:.1%}"
    )

    # ── Coordinate map via RPC ───────────────────────────────────────────────
    log.info("Fetching coordinates via get_farms_with_coords()…")
    try:
        coord_map: dict[str, dict] = {}
        for row in db.rpc("get_farms_with_coords"):
            if row.get("osm_id") and row.get("lat") is not None:
                coord_map[row["osm_id"]] = {"lat": row["lat"], "lng": row["lng"]}
        log.info(f"Coordinate map: {len(coord_map):,} entries")
    except Exception as exc:
        log.warning(f"Could not fetch coordinates ({exc}); no location bias will be used")
        coord_map = {}

    # Accumulators
    broken_images: list[dict] = list(existing_broken)
    updates_map: dict[int, dict] = dict(existing_updates)   # id → {id, name, osm_id, changes}
    not_found_rows: list[dict] = list(existing_not_found)

    if not args.validate_only:

        # ════════════════════════════════════════════════════════════════════
        # PHASE 1 — Broken image detection
        # ════════════════════════════════════════════════════════════════════
        if not args.skip_image_check:
            log.info("")
            log.info("─" * 70)
            log.info("PHASE 1: Broken image detection")
            log.info("─" * 70)

            with_img = [f for f in farms if f.get("image")]
            already_broken_ids = {r["id"] for r in broken_images}
            to_check = [f for f in with_img if f["id"] not in already_broken_ids]
            log.info(f"Image URLs to check: {len(to_check):,} (skipping {len(already_broken_ids)} already found)")

            for i, farm in enumerate(to_check, 1):
                url = farm["image"]
                if is_image_broken(url):
                    log.warning(f"  [{i:>4}/{len(to_check)}] BROKEN  id={farm['id']} "
                                f"{farm.get('name','')!r}  {url[:80]}")
                    broken_images.append({
                        "id":      farm["id"],
                        "name":    farm.get("name", ""),
                        "city":    farm.get("city", ""),
                        "old_url": url,
                    })
                    # Mark in local copy so phase 2 knows image is gone
                    farm["image"] = None
                    # Also record as a change in the updates map
                    rec = updates_map.setdefault(farm["id"], {
                        "id": farm["id"], "name": farm.get("name", ""),
                        "osm_id": farm.get("osm_id", ""), "changes": {},
                    })
                    rec["changes"]["image"] = None
                else:
                    if i % 100 == 0:
                        log.info(f"  [{i:>4}/{len(to_check)}] Checked…")

            log.info(f"Phase 1 done — broken images found: {len(broken_images):,}")

        # ════════════════════════════════════════════════════════════════════
        # PHASE 2 — Google Places enrichment
        # ════════════════════════════════════════════════════════════════════
        if not args.skip_google and places is not None:
            log.info("")
            log.info("─" * 70)
            log.info("PHASE 2: Google Places enrichment")
            log.info("─" * 70)

            to_process = [f for f in farms if f["id"] not in already_done]
            if args.max_farms:
                to_process = to_process[: args.max_farms]

            log.info(f"Farms to process : {len(to_process):,}")
            log.info(f"Already done     : {len(already_done):,}")
            log.info(f"Batch size       : {BATCH_SIZE}  |  delay: {BATCH_DELAY_S}s between batches")

            batches = [to_process[i: i + BATCH_SIZE] for i in range(0, len(to_process), BATCH_SIZE)]
            not_found_ids = {r["id"] for r in not_found_rows}

            for batch_num, batch in enumerate(batches, 1):
                if places.total_calls >= MAX_QUOTA_PER_RUN:
                    log.warning(f"Quota guard: {MAX_QUOTA_PER_RUN} calls reached. "
                                "Run again tomorrow with --resume.")
                    break

                log.info(f"\n── Batch {batch_num}/{len(batches)} "
                         f"({len(batch)} farms, API calls: {places.total_calls}) ──")

                for farm in batch:
                    farm_id   = farm["id"]
                    farm_name = farm.get("name", f"id={farm_id}")
                    osm_id    = farm.get("osm_id", "")
                    coords    = coord_map.get(osm_id, {})

                    try:
                        place = places.find_farm(
                            name=farm.get("name", ""),
                            city=farm.get("city"),
                            lat=coords.get("lat"),
                            lng=coords.get("lng"),
                        )

                        if place:
                            enrichment = build_enrichment(farm, place, places)
                            if enrichment:
                                rec = updates_map.setdefault(farm_id, {
                                    "id": farm_id, "name": farm_name,
                                    "osm_id": osm_id, "changes": {},
                                })
                                rec["changes"].update(enrichment)
                                # Keep local copy current for snapshot
                                farm.update(enrichment)
                                log.debug(f"  ENRICHED  id={farm_id} {farm_name!r} "
                                          f"fields={list(enrichment.keys())}")
                            else:
                                log.debug(f"  COMPLETE  id={farm_id} {farm_name!r} (nothing to add)")
                        else:
                            if farm_id not in not_found_ids:
                                not_found_rows.append({
                                    "id":      farm_id,
                                    "name":    farm.get("name", ""),
                                    "city":    farm.get("city", ""),
                                    "address": farm.get("address", ""),
                                    "osm_id":  osm_id,
                                    "website": farm.get("website", ""),
                                })
                                not_found_ids.add(farm_id)

                            current_desc = (farm.get("description") or "").strip()
                            if len(current_desc) < DESCRIPTION_MIN_LEN:
                                fallback = generate_fallback_description(farm)
                                rec = updates_map.setdefault(farm_id, {
                                    "id": farm_id, "name": farm_name,
                                    "osm_id": osm_id, "changes": {},
                                })
                                rec["changes"]["description"] = fallback
                                farm["description"] = fallback
                                log.debug(f"  FALLBACK  id={farm_id} {farm_name!r}")
                            else:
                                log.debug(f"  NOT FOUND id={farm_id} {farm_name!r}")

                    except Exception as exc:
                        log.error(f"  ERROR     id={farm_id} {farm_name!r}: {exc}")

                    cp["processed_ids"].append(farm_id)
                    already_done.add(farm_id)
                    time.sleep(FARM_DELAY_S)

                cp["api_calls_text_search"] = places.calls_text_search
                cp["api_calls_details"]     = places.calls_details
                cp["last_batch"]            = batch_num
                save_checkpoint(checkpoint_file, cp)

                enriched_so_far = sum(1 for r in updates_map.values()
                                      if any(k != "image" for k in r["changes"]))
                log.info(f"  Batch {batch_num} done — "
                         f"updates_queued:{len(updates_map)} "
                         f"not_found:{len(not_found_rows)} "
                         f"api_calls:{places.total_calls}")

                if batch_num < len(batches):
                    time.sleep(BATCH_DELAY_S)

    # ── Validation snapshot ──────────────────────────────────────────────────
    log.info("")
    log.info("─" * 70)
    log.info("PHASE 3: Validation")
    log.info("─" * 70)

    # Apply changes to local farm list for projected stats
    id_to_farm = {f["id"]: f for f in farms}
    for rec in updates_map.values():
        farm = id_to_farm.get(rec["id"])
        if farm:
            farm.update(rec["changes"])

    after = snapshot(farms)
    dupes = find_duplicates(farms)
    total_dupe_farms = sum(len(g["farms"]) for g in dupes)
    no_description = [f for f in farms if not (f.get("description") or "").strip()]
    no_image       = [f for f in farms if not f.get("image")]
    no_contact     = [f for f in farms if not f.get("phone") and not f.get("website")]

    log.info(f"Projected completeness after applying JSON: {after['avg_completeness']:.1%}")
    log.info(f"Farms without description : {len(no_description):,}")
    log.info(f"Farms without image       : {len(no_image):,}")
    log.info(f"Farms without any contact : {len(no_contact):,}")
    log.info(f"Duplicate groups (name+city): {len(dupes)}, farms in groups: {total_dupe_farms}")

    # ── Write enrichment_results.json ────────────────────────────────────────
    updates_list = sorted(updates_map.values(), key=lambda r: r["id"])

    broken_count    = len(broken_images)
    enriched_count  = sum(1 for r in updates_list
                          if any(k not in ("image",) for k in r["changes"]))
    fallback_count  = sum(1 for r in updates_list
                          if "description" in r["changes"]
                          and not any(k in r["changes"]
                                      for k in ("phone", "website", "opening_hours")))
    total_api_calls = cp.get("api_calls_text_search", 0) + cp.get("api_calls_details", 0)

    results = {
        "metadata": {
            "created_at":           datetime.utcnow().isoformat() + "Z",
            "total_farms_in_db":    len(farms),
            "farms_to_update":      len(updates_list),
            "broken_images_found":  broken_count,
            "enriched_from_google": enriched_count,
            "fallback_descriptions": fallback_count,
            "not_found_in_google":  len(not_found_rows),
            "api_calls_text_search": cp.get("api_calls_text_search", 0),
            "api_calls_details":    cp.get("api_calls_details", 0),
            "total_api_calls":      total_api_calls,
            "before": before,
            "after_projected": after,
        },
        "updates": updates_list,
        "broken_images": broken_images,
        "not_found": not_found_rows,
        "duplicates": [
            {"name": g["key"][0], "city": g["key"][1],
             "ids": [f["id"] for f in g["farms"]]}
            for g in sorted(dupes, key=lambda x: -len(x["farms"]))
        ],
    }

    out_dir.mkdir(parents=True, exist_ok=True)
    with open(results_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    log.info(f"Results saved → {results_file}")

    # ── Write farms_not_in_google.csv ─────────────────────────────────────────
    with open(not_found_csv, "w", newline="", encoding="utf-8") as csvf:
        writer = csv.DictWriter(csvf,
                                fieldnames=["id","name","city","address","osm_id","website"])
        writer.writeheader()
        writer.writerows(not_found_rows)
    log.info(f"Not-found CSV → {not_found_csv}")

    # ── Print summary ─────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("Step 1 complete — results NOT yet written to database.")
    print(f"Results file : {results_file}")
    print(f"  farms to update   : {len(updates_list):,}")
    print(f"  broken images     : {broken_count:,}")
    print(f"  google enriched   : {enriched_count:,}")
    print(f"  fallback descs    : {fallback_count:,}")
    print(f"  not found         : {len(not_found_rows):,}")
    print(f"  duplicate groups  : {len(dupes):,}")
    print(f"  total API calls   : {total_api_calls:,}")
    print(f"\nProjected completeness: {before['avg_completeness']:.1%} → {after['avg_completeness']:.1%}")
    print(f"\nReview {results_file.name}, then run:")
    print(f"  python {Path(__file__).name} --save --output-dir {out_dir}")
    print("=" * 70)


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Apply JSON to Supabase
# ═══════════════════════════════════════════════════════════════════════════════

def run_step2(args, out_dir: Path, log):
    results_file = out_dir / "enrichment_results.json"
    report_file  = out_dir / "enrichment_report.txt"

    if not results_file.exists():
        log.error(f"Results file not found: {results_file}")
        log.error("Run without --save first to generate it.")
        sys.exit(1)

    log.info(f"Loading results from {results_file}…")
    with open(results_file, encoding="utf-8") as f:
        results = json.load(f)

    meta    = results.get("metadata", {})
    updates = results.get("updates", [])
    log.info(f"  {len(updates):,} farms to update")
    log.info(f"  Created at: {meta.get('created_at', 'unknown')}")

    db = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)

    saved = 0
    errors = 0
    batches = [updates[i: i + BATCH_SIZE] for i in range(0, len(updates), BATCH_SIZE)]

    for batch_num, batch in enumerate(batches, 1):
        log.info(f"Batch {batch_num}/{len(batches)} ({len(batch)} records)…")
        for rec in batch:
            farm_id = rec["id"]
            changes = rec.get("changes", {})
            if not changes:
                continue
            # Only update real DB columns — drop reporting-only and constrained fields
            SKIP_COLS = {"google_rating", "google_review_count", "source"}
            db_changes = {k: v for k, v in changes.items() if k not in SKIP_COLS}
            if not db_changes:
                continue
            try:
                db.update("farms", farm_id, db_changes)
                saved += 1
            except Exception as exc:
                log.error(f"  id={farm_id} {rec.get('name','')!r}: {exc}")
                errors += 1

        log.info(f"  Batch {batch_num} done — saved:{saved} errors:{errors}")

    # ── Write report ─────────────────────────────────────────────────────────
    before = meta.get("before", {})
    after  = meta.get("after_projected", {})

    lines = [
        "=" * 70,
        "De Lokale Boer — Google Places Enrichment Report",
        f"Applied: {datetime.utcnow().isoformat()}Z",
        "=" * 70,
        "",
        "── Before / After (projected from JSON) ────────────────────────────",
        f"{'Metric':<30} {'Before':>10} {'After':>10} {'Delta':>10}",
        "-" * 62,
    ]
    for key, label in [
        ("total",            "Total farms"),
        ("with_description", "Has description"),
        ("with_phone",       "Has phone"),
        ("with_website",     "Has website"),
        ("with_hours",       "Has opening hours"),
        ("with_image",       "Has image"),
    ]:
        b = before.get(key, 0)
        a = after.get(key, 0)
        d = a - b
        lines.append(f"  {label:<28} {b:>10,} {a:>10,} {'+'if d>0 else ''}{d:>9,}")

    lines += [
        f"  {'Avg completeness':<28} "
        f"{before.get('avg_completeness',0):>10.1%} {after.get('avg_completeness',0):>10.1%}",
        "",
        "── Enrichment Summary ───────────────────────────────────────────────",
        f"  Broken images removed   : {meta.get('broken_images_found', 0):,}",
        f"  Enriched from Google    : {meta.get('enriched_from_google', 0):,}",
        f"  Fallback descriptions   : {meta.get('fallback_descriptions', 0):,}",
        f"  Not found in Google     : {meta.get('not_found_in_google', 0):,}",
        f"  Duplicate groups        : {len(results.get('duplicates', [])):,}",
        "",
        "── API Usage ────────────────────────────────────────────────────────",
        f"  Text Search calls  : {meta.get('api_calls_text_search', 0):,}",
        f"  Place Details calls: {meta.get('api_calls_details', 0):,}",
        f"  Total API calls    : {meta.get('total_api_calls', 0):,}",
        "",
        "── Database Write ───────────────────────────────────────────────────",
        f"  Records updated : {saved:,}",
        f"  Errors          : {errors:,}",
        "",
        "── Output Files ─────────────────────────────────────────────────────",
        f"  Results JSON  : {out_dir / 'enrichment_results.json'}",
        f"  Log           : {out_dir / 'enrichment_log.txt'}",
        f"  Report        : {report_file}",
        f"  Not in Google : {out_dir / 'farms_not_in_google.csv'}",
        f"  Checkpoint    : {out_dir / 'enrichment_checkpoint.json'}",
        "",
        "=" * 70,
    ]

    report_text = "\n".join(lines)
    with open(report_file, "w", encoding="utf-8") as f:
        f.write(report_text)

    print("\n" + report_text)
    log.info(f"Report → {report_file}")
    log.info(f"Step 2 complete. Updated: {saved:,}  Errors: {errors}")
    return 0 if errors == 0 else 1


# ─── Entry point ──────────────────────────────────────────────────────────────

def main():
    args    = parse_args()
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    log     = setup_logging(out_dir / "enrichment_log.txt")

    log.info("=" * 70)
    log.info("De Lokale Boer — Google Places Enrichment")
    log.info(f"Mode       : {'--save (apply JSON → DB)' if args.save else 'fetch & enrich → JSON'}")
    log.info(f"Output dir : {out_dir}")
    log.info(f"Started    : {datetime.utcnow().isoformat()}Z")
    log.info("=" * 70)

    if not SUPABASE_URL or not SUPABASE_KEY:
        log.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
        sys.exit(1)

    if args.save:
        sys.exit(run_step2(args, out_dir, log))
    else:
        run_step1(args, out_dir, log)


if __name__ == "__main__":
    main()
