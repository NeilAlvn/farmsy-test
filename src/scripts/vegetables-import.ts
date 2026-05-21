/**
 * Specialty vegetable / produce / berry / herb farm import — OSM targeted search
 *
 * Searches NL+BE bbox using 3 focused queries:
 *   A – Specific OSM tags (vending, farm-indicator greengrocers, shop=farm_shop)
 *   B – shop=farm scoped name search: vegetables & berries/herbs
 *   C – OSM produce= tag search
 *
 * Duplicate handling:
 *   osm_id match  → merge farm_type (no replace)
 *   name+city     → merge farm_type (no replace)
 *   new           → INSERT
 *
 * Usage:
 *   npx ts-node -P tsconfig.scripts.json src/scripts/vegetables-import.ts
 *   npx ts-node -P tsconfig.scripts.json src/scripts/vegetables-import.ts --save
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const BBOX = '50.5,3.0,53.7,7.3';

// ── Patterns ───────────────────────────────────────────────────────────────────

const CHAIN_RE = /albert heijn|\bah\b|jumbo|lidl|aldi|\bspar\b|\bcoop\b|dirk|delhaize|carrefour|colruyt|hoogvliet/i;
const FARM_RE  = /hoeve|hoef|boerderij|\bboer\b|\bhof\b|\berf\b|erve|landgoed|ferme|domaine|exploitation|kwekerij|tuinderij|tuinder|akker|pluk|oogst/i;

const SPECIALTIES = [
  { name: 'asparagus',    re: /asperge|asparagus/i,                            farmType: 'vegetables' },
  { name: 'potatoes',     re: /aardappel|potato|patate/i,                      farmType: 'vegetables' },
  { name: 'tomatoes',     re: /tomaat|tomaten|tomate\b/i,                      farmType: 'vegetables' },
  { name: 'pumpkins',     re: /pompoen|pumpkin|citrouille/i,                   farmType: 'vegetables' },
  { name: 'cucumbers',    re: /komkommer|cucumber|concombre/i,                 farmType: 'vegetables' },
  { name: 'lettuce',      re: /\bsla\b|lettuce|salade\b/i,                     farmType: 'vegetables' },
  { name: 'onions',       re: /\bui\b|uien|onion|oignon/i,                     farmType: 'vegetables' },
  { name: 'carrots',      re: /wortel|carrot|carotte/i,                        farmType: 'vegetables' },
  { name: 'cabbage',      re: /\bkool\b|cabbage|\bchou\b|savooikool/i,          farmType: 'vegetables' },
  { name: 'sprouts',      re: /spruit|spruitjes/i,                             farmType: 'vegetables' },
  { name: 'leeks',        re: /\bprei\b|\bleek\b|poireau/i,                    farmType: 'vegetables' },
  { name: 'beets',        re: /\bbiet\b|betterave/i,                           farmType: 'vegetables' },
  { name: 'corn',         re: /\bmais\b|\bmaïs\b|\bcorn\b/i,                   farmType: 'vegetables' },
  { name: 'zucchini',     re: /courgette|zucchini/i,                           farmType: 'vegetables' },
  { name: 'peppers',      re: /\bpaprika\b|\bpepper\b|poivron/i,               farmType: 'vegetables' },
  { name: 'strawberries', re: /aardbei|strawberry|fraise/i,                    farmType: 'produce'    },
  { name: 'raspberries',  re: /framboos|raspberry|framboise/i,                 farmType: 'produce'    },
  { name: 'blueberries',  re: /bosbes|blueberry|myrtille/i,                    farmType: 'produce'    },
  { name: 'blackberries', re: /\bbraam\b|blackberry|mûre/i,                    farmType: 'produce'    },
  { name: 'herbs',        re: /kruiden|\bherb\b|herbes\b/i,                    farmType: 'produce'    },
] as const;

type SpecialtyName = typeof SPECIALTIES[number]['name'];

const SPECIALTY_RE = new RegExp(
  SPECIALTIES.map(s => s.re.source).join('|'),
  'i',
);

function log(msg: string) { console.log(`${new Date().toISOString()} ${msg}`); }

// ── Overpass queries ────────────────────────────────────────────────────────────
// Split into 3 lightweight queries to stay well under the 90 s timeout each.

// Query A: explicit farm-selling tags (no name scan → very fast)
function buildQueryA(): string {
  return `[out:json][timeout:90][bbox:${BBOX}];
(
  node["vending"="vegetables"];
  way["vending"="vegetables"];
  node["vending"="fruit"];
  way["vending"="fruit"];
  node["shop"="farm_shop"];
  way["shop"="farm_shop"];
  node["shop"="greengrocer"]["direct_sale"="yes"];
  way["shop"="greengrocer"]["direct_sale"="yes"];
  node["shop"="greengrocer"]["farm_shop"="yes"];
  way["shop"="greengrocer"]["farm_shop"="yes"];
  node["shop"="greengrocer"]["organic"="yes"];
  way["shop"="greengrocer"]["organic"="yes"];
);
out center;`;
}

// Query B1: shop=farm scoped to vegetable keywords
function buildQueryB1(): string {
  return `[out:json][timeout:90][bbox:${BBOX}];
(
  node["shop"="farm"]["name"~"asperge|asparagus|aardappel|potato|patate|tomaat|tomaten|pompoen|pumpkin|komkommer|cucumber|sla|uien|wortel|carrot|kool|cabbage|spruit|prei|leek|biet|mais|maïs|courgette|zucchini|paprika|poivron",i];
  way["shop"="farm"]["name"~"asperge|asparagus|aardappel|potato|patate|tomaat|tomaten|pompoen|pumpkin|komkommer|cucumber|sla|uien|wortel|carrot|kool|cabbage|spruit|prei|leek|biet|mais|maïs|courgette|zucchini|paprika|poivron",i];
);
out center;`;
}

// Query B2: shop=farm scoped to berry/herb keywords
function buildQueryB2(): string {
  return `[out:json][timeout:90][bbox:${BBOX}];
(
  node["shop"="farm"]["name"~"aardbei|strawberry|fraise|framboos|raspberry|framboise|bosbes|blueberry|myrtille|braam|blackberry|mûre|kruiden|herbes",i];
  way["shop"="farm"]["name"~"aardbei|strawberry|fraise|framboos|raspberry|framboise|bosbes|blueberry|myrtille|braam|blackberry|mûre|kruiden|herbes",i];
);
out center;`;
}

// Query C: produce= tag (many NL/BE farm stands tag their produce type)
function buildQueryC(): string {
  return `[out:json][timeout:60][bbox:${BBOX}];
(
  node["produce"~"asperge|aardappel|tomaat|pompoen|aardbei|strawberry|framboos|raspberry|bosbes|braam|kruiden",i];
  way["produce"~"asperge|aardappel|tomaat|pompoen|aardbei|strawberry|framboos|raspberry|bosbes|braam|kruiden",i];
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

function normalizeFarmTypes(raw: unknown): string[] {
  if (Array.isArray(raw)) return (raw as string[]).map(v => String(v).toLowerCase()).filter(Boolean);
  if (typeof raw === 'string' && raw) {
    if (raw.startsWith('{') && raw.endsWith('}'))
      return raw.slice(1, -1).split(',').map(v => v.trim().replace(/^"(.*)"$/, '$1').toLowerCase()).filter(Boolean);
    if (raw.startsWith('[')) {
      try {
        const p = JSON.parse(raw);
        if (Array.isArray(p)) return (p as unknown[]).map(v => String(v).toLowerCase()).filter(Boolean);
      } catch { /* ignore */ }
    }
    return [raw.toLowerCase()];
  }
  return [];
}

function merge(existing: string[], adding: string[]): string[] {
  return [...new Set([...existing, ...adding])];
}

function getCoords(el: OSMElement): { lat: number; lon: number } | null {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  return lat && lon ? { lat, lon } : null;
}

function getCountry(tags: Record<string, string>, lat: number, lon: number): 'NL' | 'BE' {
  const addr = tags['addr:country']?.toUpperCase();
  if (addr === 'NL' || addr === 'BE') return addr;
  if (lat > 51.47 && lon > 3.35) return 'NL';
  if (lat >= 49.5 && lat <= 51.5 && lon >= 2.5 && lon <= 6.5) return 'BE';
  return lat > 51.3 ? 'NL' : 'BE';
}

// Search text: name + produce tag
function searchText(tags: Record<string, string>): string {
  return `${tags['name'] ?? ''} ${tags['produce'] ?? ''}`.trim();
}

function detectSpecialties(tags: Record<string, string>): SpecialtyName[] {
  const text = searchText(tags);
  return SPECIALTIES.filter(s => s.re.test(text)).map(s => s.name);
}

function getFarmTypes(tags: Record<string, string>): string[] {
  const text = searchText(tags);
  const types = new Set<string>();
  for (const s of SPECIALTIES) {
    if (s.re.test(text)) types.add(s.farmType);
  }
  // Fallback defaults
  if (types.size === 0) {
    if (tags['vending'] === 'vegetables' || tags['shop'] === 'greengrocer') types.add('vegetables');
    else types.add('produce');
  }
  return [...types];
}

function isFarmBased(tags: Record<string, string>): boolean {
  const name = tags['name'] ?? '';
  if (CHAIN_RE.test(name)) return false;

  // Explicit vending / farm-shop tags — always direct sale
  if (tags['vending'] === 'vegetables' || tags['vending'] === 'fruit') return true;
  if (tags['shop'] === 'farm_shop') return true;

  // shop=farm — check specialty keyword present (Query B already filters by name, but safety check)
  if (tags['shop'] === 'farm') return SPECIALTY_RE.test(searchText(tags));

  // Greengrocer needs a farm indicator AND at least one specialty or farm keyword
  if (tags['shop'] === 'greengrocer') {
    const hasFarmTag = tags['direct_sale'] === 'yes' || tags['farm_shop'] === 'yes' || tags['organic'] === 'yes';
    return hasFarmTag && (SPECIALTY_RE.test(name) || FARM_RE.test(name));
  }

  // produce= tag items
  if (tags['produce']) return SPECIALTY_RE.test(tags['produce']);

  return false;
}

function getPrimaryTag(tags: Record<string, string>): string {
  if (tags['vending'])  return `vending=${tags['vending']}`;
  if (tags['shop'])     return `shop=${tags['shop']}`;
  if (tags['craft'])    return `craft=${tags['craft']}`;
  return Object.entries(tags).map(([k, v]) => `${k}=${v}`)[0] ?? 'unknown';
}

function transformElement(el: OSMElement): (Record<string, unknown> & { _specialties: SpecialtyName[] }) | null {
  const coords = getCoords(el);
  if (!coords) return null;
  const tags = el.tags ?? {};
  const name = tags['name'];
  if (!name) return null;
  if (!isFarmBased(tags)) return null;

  const { lat, lon } = coords;
  const country = getCountry(tags, lat, lon);
  const street = tags['addr:street'] ?? '';
  const number = tags['addr:housenumber'] ?? '';

  return {
    _specialties:  detectSpecialties(tags),
    name,
    address:       [street, number].filter(Boolean).join(' ') || null,
    city:          tags['addr:city'] ?? tags['addr:town'] ?? tags['addr:village'] ?? null,
    postal_code:   tags['addr:postcode'] ?? null,
    country,
    location:      `POINT(${lon} ${lat})`,
    farm_type:     getFarmTypes(tags),
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

async function runQuery(label: string, query: string): Promise<OSMElement[]> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      log(`[${label}] attempt ${attempt}/3…`);
      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'De Lokale Boer Vegetables Import',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`);
      const data = await res.json() as { elements: OSMElement[] };
      log(`[${label}] received ${data.elements.length} elements`);
      return data.elements;
    } catch (err) {
      log(`[${label}] attempt ${attempt} failed: ${err instanceof Error ? err.message : err}`);
      if (attempt === 3) throw err;
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  return [];
}

async function fetchAll(): Promise<OSMElement[]> {
  const pause = () => new Promise(r => setTimeout(r, 3000));
  const a   = await runQuery('A (tags)',    buildQueryA());  await pause();
  const b1  = await runQuery('B1 (veg)',   buildQueryB1()); await pause();
  const b2  = await runQuery('B2 (berry)', buildQueryB2()); await pause();
  const c   = await runQuery('C (produce)', buildQueryC());
  return [...a, ...b1, ...b2, ...c];
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const saveMode = process.argv.includes('--save');

  log('');
  log('═══ Phase 1: OSM fetch ════════════════════════════════════════════');
  const raw = await fetchAll();

  // Deduplicate + transform
  const farms: Array<Record<string, unknown> & { _specialties: SpecialtyName[] }> = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const el of raw) {
    const osmId = `${el.type}/${el.id}`;
    if (seen.has(osmId)) continue;
    seen.add(osmId);
    const farm = transformElement(el);
    if (farm) farms.push(farm);
    else skipped++;
  }

  // Specialty count stats
  const specCounts: Partial<Record<SpecialtyName, number>> = {};
  let vegFarms = 0; let prodFarms = 0;
  const byCountry = { NL: 0, BE: 0 };

  for (const f of farms) {
    for (const s of f._specialties) specCounts[s] = (specCounts[s] ?? 0) + 1;
    const types = f.farm_type as string[];
    if (types.includes('vegetables')) vegFarms++;
    if (types.includes('produce'))    prodFarms++;
    byCountry[f.country as 'NL' | 'BE']++;
  }

  log('');
  log('── OSM results ───────────────────────────────────────────────────');
  log(`  Raw elements:      ${raw.length}`);
  log(`  Kept (farm-based): ${farms.length}  (NL: ${byCountry.NL}, BE: ${byCountry.BE})`);
  log(`  Filtered out:      ${skipped}`);
  log(`  → Vegetables type: ${vegFarms}  |  Produce type: ${prodFarms}`);
  log('  By specialty:');
  for (const [sp, cnt] of Object.entries(specCounts).sort((a, b) => (b[1] as number) - (a[1] as number))) {
    log(`    ${sp.padEnd(14)} ${cnt}`);
  }
  log('─────────────────────────────────────────────────────────────────');

  // Save JSON
  const outDir = join(process.cwd(), 'output');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'vegetables_osm.json'), JSON.stringify({
    metadata: { bbox: BBOX, fetchedAt: new Date().toISOString(), total: farms.length, byCountry, specCounts },
    farms,
  }, null, 2));
  log('Saved → output/vegetables_osm.json');

  if (!saveMode) { log('Run with --save to import into Supabase.'); return; }

  // ── Supabase ──────────────────────────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('Missing env vars');
  const supabase = createClient(supabaseUrl, serviceKey);

  log('');
  log('Loading existing farms for duplicate check…');
  const PAGE = 1000;
  const existing: Array<{ osm_id: string; name: string | null; city: string | null; farm_type: unknown }> = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from('farms').select('osm_id, name, city, farm_type').range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    existing.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  log(`  Loaded ${existing.length} existing farms`);

  const byOsmId   = new Map<string, { farm_type: string[] }>();
  const byNameCity = new Map<string, { osm_id: string; farm_type: string[] }>();
  for (const f of existing) {
    const types = normalizeFarmTypes(f.farm_type);
    byOsmId.set(f.osm_id, { farm_type: types });
    if (f.name && f.city) {
      const key = `${f.name.toLowerCase().trim()}|${f.city.toLowerCase().trim()}`;
      if (!byNameCity.has(key)) byNameCity.set(key, { osm_id: f.osm_id, farm_type: types });
    }
  }

  // Categorise
  const toInsert:  Array<Record<string, unknown>> = [];
  const toUpdateByOsmId:  Array<{ osm_id: string; farm_type: string[] }> = [];
  const toUpdateByName:   Array<{ osm_id: string; farm_type: string[] }> = [];

  // Specialty tracking for report
  const insertSpec: Partial<Record<SpecialtyName, number>> = {};
  const updateSpec: Partial<Record<SpecialtyName, number>> = {};

  for (const farm of farms) {
    const { _specialties, ...record } = farm;
    const newTypes = record.farm_type as string[];
    const osmId    = record.osm_id as string;

    const trackSpec = (bucket: typeof insertSpec) => {
      for (const s of _specialties) bucket[s] = (bucket[s] ?? 0) + 1;
    };

    if (byOsmId.has(osmId)) {
      const ex = byOsmId.get(osmId)!;
      const merged = merge(ex.farm_type, newTypes);
      if (merged.length > ex.farm_type.length) {
        toUpdateByOsmId.push({ osm_id: osmId, farm_type: merged });
        trackSpec(updateSpec);
      }
      continue;
    }

    const nameKey = farm.name && farm.city
      ? `${String(farm.name).toLowerCase().trim()}|${String(farm.city).toLowerCase().trim()}`
      : null;
    if (nameKey && byNameCity.has(nameKey)) {
      const ex = byNameCity.get(nameKey)!;
      const merged = merge(ex.farm_type, newTypes);
      if (merged.length > ex.farm_type.length) {
        toUpdateByName.push({ osm_id: ex.osm_id, farm_type: merged });
        trackSpec(updateSpec);
      }
      continue;
    }

    toInsert.push(record);
    trackSpec(insertSpec);
  }

  log('');
  log('── Deduplication ─────────────────────────────────────────────────');
  log(`  New farms to insert:              ${toInsert.length}`);
  log(`  Existing to update (osm_id):      ${toUpdateByOsmId.length}`);
  log(`  Existing to update (name+city):   ${toUpdateByName.length}`);
  log('─────────────────────────────────────────────────────────────────');

  // Execute updates
  const allUpdates = [...toUpdateByOsmId, ...toUpdateByName];
  let updatesDone = 0;
  for (const u of allUpdates) {
    const { error } = await supabase.from('farms').update({ farm_type: u.farm_type }).eq('osm_id', u.osm_id);
    if (error) log(`  [WARN] update failed ${u.osm_id}: ${error.message}`);
    else updatesDone++;
    await new Promise(r => setTimeout(r, 50));
  }
  log(`Updated ${updatesDone} existing farms`);

  // Execute inserts
  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const { error } = await supabase.from('farms').upsert(toInsert.slice(i, i + BATCH), { onConflict: 'osm_id', ignoreDuplicates: false });
    if (error) throw new Error(`Insert batch: ${error.message}`);
    inserted += Math.min(BATCH, toInsert.length - i);
    await new Promise(r => setTimeout(r, 100));
  }
  log(`Inserted ${inserted} new farms`);

  // ── Final report ─────────────────────────────────────────────────────────
  const { data: finalRows } = await supabase.from('farms').select('farm_type').eq('is_published', true);
  const catCounts: Record<string, number> = {};
  for (const row of finalRows ?? []) {
    for (const t of normalizeFarmTypes(row.farm_type)) catCounts[t] = (catCounts[t] ?? 0) + 1;
  }
  const { count: totalCount } = await supabase.from('farms').select('*', { count: 'exact', head: true }).eq('is_published', true);

  log('');
  log('═══ Final report ══════════════════════════════════════════════════');
  log('');
  log('── By specialty (inserted | updated) ────────────────────────────');
  const allSpecs = new Set([...Object.keys(insertSpec), ...Object.keys(updateSpec)]) as Set<SpecialtyName>;
  for (const sp of SPECIALTIES.map(s => s.name)) {
    if (!allSpecs.has(sp)) continue;
    const ins = insertSpec[sp] ?? 0;
    const upd = updateSpec[sp] ?? 0;
    log(`  ${sp.padEnd(14)} inserted: ${String(ins).padStart(3)}  |  updated: ${String(upd).padStart(3)}`);
  }
  log('');
  log(`  Total new farms inserted:   ${inserted}`);
  log(`  Total existing updated:     ${updatesDone}`);
  log('');
  log('── Updated category totals ──────────────────────────────────────');
  const catOrder = ['produce', 'vegetables', 'meat', 'dairy', 'eggs', 'cheese', 'wine', 'markets', 'fish', 'honey'];
  for (const cat of catOrder) {
    if (catCounts[cat]) log(`  ${cat.padEnd(12)}: ${catCounts[cat]}`);
  }
  log('');
  log(`  Total farms in DB: ${totalCount ?? '?'}`);
  log('═══════════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
