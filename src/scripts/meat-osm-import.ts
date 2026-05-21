/**
 * Meat farms — targeted OSM search + Supabase import
 *
 * Queries Overpass with bbox covering NL+BE using multiple tag combinations
 * and name-keyword filters to find farm-based meat sellers.
 *
 * Usage:
 *   npx ts-node -P tsconfig.scripts.json src/scripts/meat-osm-import.ts          # fetch + save JSON
 *   npx ts-node -P tsconfig.scripts.json src/scripts/meat-osm-import.ts --save   # also import to Supabase
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const BBOX = '50.5,3.0,53.7,7.3'; // covers NL + BE

// Name patterns that indicate a farm-based operation
const FARM_NAME_RE = /hoeve|hoef|boerderij|\bboer\b|hof\b|erve\b|\berf\b|landgoed|ferme|domaine|exploitation|haras|hoekje|landerijen|\bhoeve\b/i;

// Known chains / supermarkets — skip these
const CHAIN_RE = /albert heijn|\bah\b|jumbo|lidl|aldi|\bspar\b|\bcoop\b|dirk|hoogvliet|picnic|crispy/i;

function log(msg: string) {
  console.log(`${new Date().toISOString()} ${msg}`);
}

// ── Overpass query ─────────────────────────────────────────────────────────────
// Uses bbox header so every query is automatically filtered to NL+BE.
// Searches:
//  • shop=butcher with direct_sale=yes or farm_shop=yes  (explicitly farm-direct)
//  • shop=poultry                                         (almost always farm-based)
//  • craft=butcher                                        (artisan; filtered by name below)
//  • vending=meat / vending=sausage                      (roadside / farm vending)
//  • shop=butcher with farm keyword in name               (name-based farm detection)

function buildQuery(): string {
  return `[out:json][timeout:180][bbox:${BBOX}];
(
  node["shop"="butcher"]["direct_sale"="yes"];
  way["shop"="butcher"]["direct_sale"="yes"];
  node["shop"="butcher"]["farm_shop"="yes"];
  way["shop"="butcher"]["farm_shop"="yes"];
  node["shop"="poultry"];
  way["shop"="poultry"];
  node["craft"="butcher"];
  way["craft"="butcher"];
  node["vending"="meat"];
  way["vending"="meat"];
  node["vending"="sausage"];
  way["vending"="sausage"];
  node["shop"="butcher"]["name"~"hoeve|boerderij|hof|ferme|boer|erf|erve|landgoed",i];
  way["shop"="butcher"]["name"~"hoeve|boerderij|hof|ferme|boer|erf|erve|landgoed",i];
  node["craft"="butcher"]["name"~"hoeve|boerderij|hof|ferme|boer|erf|erve|landgoed",i];
  way["craft"="butcher"]["name"~"hoeve|boerderij|hof|ferme|boer|erf|erve|landgoed",i];
);
out center;`;
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface OSMElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getCoords(el: OSMElement): { lat: number; lon: number } | null {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  return lat && lon ? { lat, lon } : null;
}

function getCountry(tags: Record<string, string>, lat: number, lon: number): 'NL' | 'BE' {
  const addr = tags['addr:country']?.toUpperCase();
  if (addr === 'NL' || addr === 'BE') return addr;
  // Rough geographic split: NL is mostly above ~51.5° or in the bulge above 51° east of 3.3°
  if (lat > 51.47 && lon > 3.35) return 'NL';
  if (lat >= 49.5 && lat <= 51.5 && lon >= 2.5 && lon <= 6.5) return 'BE';
  return lat > 51.3 ? 'NL' : 'BE';
}

function getPrimaryTag(tags: Record<string, string>): string {
  if (tags['shop'] === 'butcher' && tags['direct_sale'] === 'yes') return 'shop=butcher (direct_sale)';
  if (tags['shop'] === 'butcher' && tags['farm_shop']   === 'yes') return 'shop=butcher (farm)';
  if (tags['shop'] === 'butcher')  return 'shop=butcher';
  if (tags['craft'] === 'butcher') return 'craft=butcher';
  if (tags['shop'] === 'poultry')  return 'shop=poultry';
  if (tags['vending'] === 'meat')    return 'vending=meat';
  if (tags['vending'] === 'sausage') return 'vending=sausage';
  return Object.entries(tags).map(([k, v]) => `${k}=${v}`)[0] ?? 'unknown';
}

// Returns true if the OSM element looks like a farm-based meat seller.
function isFarmBased(tags: Record<string, string>): boolean {
  const name = tags['name'] ?? '';

  if (CHAIN_RE.test(name)) return false;       // hard exclude chains

  // Explicit OSM tags marking it as farm/direct
  if (tags['direct_sale'] === 'yes') return true;
  if (tags['farm_shop']   === 'yes') return true;
  if (tags['organic']     === 'yes') return true;

  // These tag types are almost always farm-based in NL/BE
  if (tags['shop'] === 'poultry') return true;
  if (tags['vending'] === 'meat' || tags['vending'] === 'sausage') return true;

  // craft=butcher or shop=butcher — keep only if name contains farm keyword
  return FARM_NAME_RE.test(name);
}

function transformElement(el: OSMElement): Record<string, unknown> | null {
  const coords = getCoords(el);
  if (!coords) return null;

  const tags = el.tags ?? {};
  const name = tags['name'];
  if (!name) return null;

  if (!isFarmBased(tags)) return null;

  const { lat, lon } = coords;
  const country = getCountry(tags, lat, lon);

  const street = tags['addr:street']      ?? '';
  const number = tags['addr:housenumber'] ?? '';
  const address = [street, number].filter(Boolean).join(' ') || null;

  return {
    name,
    address,
    city:          tags['addr:city'] ?? tags['addr:town'] ?? tags['addr:village'] ?? null,
    postal_code:   tags['addr:postcode'] ?? null,
    country,
    location:      `POINT(${lon} ${lat})`,
    farm_type:     ['meat'],
    website:       tags['website'] ?? tags['contact:website'] ?? null,
    phone:         tags['phone']   ?? tags['contact:phone']   ?? null,
    email:         tags['email']   ?? tags['contact:email']   ?? null,
    opening_hours: tags['opening_hours'] ?? null,
    description:   tags['description']   ?? null,
    organic:       tags['organic']       ?? null,
    produce:       tags['produce'] ?? tags['product'] ?? null,
    image:         tags['image']   ?? null,
    source:        'osm',
    osm_id:        `${el.type}/${el.id}`,
    is_published:  true,
    primary_tag:   getPrimaryTag(tags),
  };
}

// ── Fetch ──────────────────────────────────────────────────────────────────────

async function fetchElements(): Promise<OSMElement[]> {
  const query = buildQuery();
  log(`Querying Overpass API (bbox ${BBOX})…`);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'De Lokale Boer Farm Import Script',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(200_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`);
      const data = await res.json() as { elements: OSMElement[] };
      log(`Received ${data.elements.length} raw elements`);
      return data.elements;
    } catch (err) {
      log(`Attempt ${attempt}/3 failed: ${err instanceof Error ? err.message : err}`);
      if (attempt === 3) throw err;
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  return [];
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const saveMode = process.argv.includes('--save');

  // 1. Fetch from Overpass
  const elements = await fetchElements();

  // 2. Transform + deduplicate + filter
  const farms: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let skippedNoCoords = 0;
  let skippedNotFarm  = 0;
  let skippedDupe     = 0;

  for (const el of elements) {
    const osmId = `${el.type}/${el.id}`;
    if (seen.has(osmId)) { skippedDupe++; continue; }
    seen.add(osmId);

    const farm = transformElement(el);
    if (!farm) {
      const coords = getCoords(el);
      if (!coords) skippedNoCoords++;
      else skippedNotFarm++;
    } else {
      farms.push(farm);
    }
  }

  // 3. Stats
  const byCountry = { NL: 0, BE: 0 };
  const byTag: Record<string, number> = {};
  for (const f of farms) {
    byCountry[f.country as 'NL' | 'BE']++;
    const t = f.primary_tag as string;
    byTag[t] = (byTag[t] ?? 0) + 1;
  }

  log('');
  log('── Fetch results ─────────────────────────────────────────────────');
  log(`  Raw elements:           ${elements.length}`);
  log(`  Duplicates removed:     ${skippedDupe}`);
  log(`  Skipped (no coords):    ${skippedNoCoords}`);
  log(`  Skipped (not farm):     ${skippedNotFarm}`);
  log(`  Farm meat sellers kept: ${farms.length}`);
  log(`  NL: ${byCountry.NL}  |  BE: ${byCountry.BE}`);
  log('  By tag:');
  for (const [tag, count] of Object.entries(byTag).sort((a, b) => b[1] - a[1])) {
    log(`    ${tag}: ${count}`);
  }
  log('─────────────────────────────────────────────────────────────────');

  // 4. Save JSON
  const outDir  = join(process.cwd(), 'output');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'meat_farms_osm.json');
  writeFileSync(outPath, JSON.stringify({
    metadata: {
      source: 'osm',
      bbox: BBOX,
      fetchedAt: new Date().toISOString(),
      totalRecords: farms.length,
      byCountry,
      byTag,
    },
    farms,
  }, null, 2));
  log(`Saved → output/meat_farms_osm.json`);

  if (!saveMode) {
    log('Run with --save to import into Supabase.');
    return;
  }

  // 5. Import to Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('Missing env vars');
  const supabase = createClient(supabaseUrl, serviceKey);

  // Meat count before
  const { data: rowsBefore } = await supabase.from('farms').select('farm_type').eq('is_published', true);
  let meatBefore = 0;
  for (const r of rowsBefore ?? []) {
    if ((Array.isArray(r.farm_type) ? r.farm_type : []).includes('meat')) meatBefore++;
  }
  log(`Meat farms currently in DB: ${meatBefore}`);

  // Upsert in batches
  const BATCH = 50;
  let upserted = 0;
  for (let i = 0; i < farms.length; i += BATCH) {
    const batch = farms.slice(i, i + BATCH);
    const { error } = await supabase
      .from('farms')
      .upsert(batch, { onConflict: 'osm_id', ignoreDuplicates: false });
    if (error) throw new Error(`Batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
    upserted += batch.length;
    log(`  Upserted ${upserted}/${farms.length}`);
    await new Promise(r => setTimeout(r, 100));
  }

  // Meat count after
  const { data: rowsAfter } = await supabase.from('farms').select('farm_type').eq('is_published', true);
  let meatAfter = 0;
  for (const r of rowsAfter ?? []) {
    if ((Array.isArray(r.farm_type) ? r.farm_type : []).includes('meat')) meatAfter++;
  }
  const { count: total } = await supabase
    .from('farms').select('*', { count: 'exact', head: true }).eq('is_published', true);

  log('');
  log('── Import complete ───────────────────────────────────────────────');
  log(`  OSM elements fetched:   ${elements.length}`);
  log(`  Farm meat sellers kept: ${farms.length}`);
  log(`  Upserted to Supabase:   ${upserted}`);
  log(`  Meat farms before:      ${meatBefore}`);
  log(`  Meat farms after:       ${meatAfter}`);
  log(`  New meat farms added:   ${meatAfter - meatBefore}`);
  log(`  Total farms in DB:      ${total ?? '?'}`);
  log('─────────────────────────────────────────────────────────────────');
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
