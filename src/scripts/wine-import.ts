/**
 * Task 1 — Merge "vegetables" → "produce" across all farms in DB
 * Task 2 — Wine / vineyard OSM import for NL+BE
 *
 * Queries:
 *   A – craft=winery, tourism=wine_cellar, amenity=winery, shop=wine (farm tags)
 *   B – shop=farm scoped to wine/cider name keywords
 *   C – named landuse=vineyard (ways)
 *
 * Usage:
 *   npx ts-node -P tsconfig.scripts.json src/scripts/wine-import.ts
 *   npx ts-node -P tsconfig.scripts.json src/scripts/wine-import.ts --save
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const BBOX = '50.5,3.0,53.7,7.3';

// ── Patterns ──────────────────────────────────────────────────────────────────

const CHAIN_RE = /albert heijn|\bah\b|jumbo|lidl|aldi|\bspar\b|\bcoop\b|dirk|delhaize|carrefour|colruyt|gall\s*&\s*gall|slijterij\s+[a-z]/i;

// Names that confirm a production / estate site
const WINE_FARM_RE = /wijnmakerij|wijngaard|wijngaarden|winery|vignoble|vigne|château|domaine|clos\b|cru\b|estate|hoeve|boerderij|ferme|fruitwijn|cider|cidre|appelwijn|hoevecider|mousseux|cave\s+\w/i;

// Any wine-related keyword (for looser matching)
const WINE_RE = /wijn|wine|wijngaard|vignoble|château|domaine|fruitwijn|cider|cidre|appelwijn/i;

function log(msg: string) { console.log(`${new Date().toISOString()} ${msg}`); }

// ── Queries ────────────────────────────────────────────────────────────────────

function buildQueryA(): string {
  return `[out:json][timeout:90][bbox:${BBOX}];
(
  node["craft"="winery"];
  way["craft"="winery"];
  node["amenity"="winery"];
  way["amenity"="winery"];
  node["tourism"="wine_cellar"];
  way["tourism"="wine_cellar"];
  node["shop"="wine"]["direct_sale"="yes"];
  way["shop"="wine"]["direct_sale"="yes"];
  node["shop"="wine"]["farm_shop"="yes"];
  way["shop"="wine"]["farm_shop"="yes"];
  node["shop"="wine"]["organic"="yes"];
  way["shop"="wine"]["organic"="yes"];
);
out center;`;
}

function buildQueryB(): string {
  return `[out:json][timeout:90][bbox:${BBOX}];
(
  node["shop"="farm"]["name"~"wijn|wine|wijngaard|vignoble|château|domaine|cider|cidre|fruitwijn|appelwijn",i];
  way["shop"="farm"]["name"~"wijn|wine|wijngaard|vignoble|château|domaine|cider|cidre|fruitwijn|appelwijn",i];
);
out center;`;
}

// Named vineyards — ways only (nodes with landuse=vineyard are rare)
function buildQueryC(): string {
  return `[out:json][timeout:60][bbox:${BBOX}];
(
  node["landuse"="vineyard"]["name"];
  way["landuse"="vineyard"]["name"];
);
out center;`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface OSMElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function mergeFarmTypes(existing: string[], adding: string[]): string[] {
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

function getPrimaryTag(tags: Record<string, string>): string {
  if (tags['craft'] === 'winery')        return 'craft=winery';
  if (tags['amenity'] === 'winery')      return 'amenity=winery';
  if (tags['tourism'] === 'wine_cellar') return 'tourism=wine_cellar';
  if (tags['landuse'] === 'vineyard')    return 'landuse=vineyard';
  if (tags['shop'] === 'wine')           return 'shop=wine';
  if (tags['shop'] === 'farm')           return 'shop=farm (wine)';
  return Object.entries(tags).map(([k, v]) => `${k}=${v}`)[0] ?? 'unknown';
}

function isFarmBased(tags: Record<string, string>): boolean {
  const name = tags['name'] ?? '';
  if (CHAIN_RE.test(name)) return false;

  // Production / winery tags: always a production site
  if (tags['craft']    === 'winery')       return true;
  if (tags['amenity']  === 'winery')       return true;
  if (tags['tourism']  === 'wine_cellar')  return true;
  if (tags['landuse']  === 'vineyard')     return !!name;

  // shop=wine: only with explicit farm-direct tags AND estate/winery keyword in name
  if (tags['shop'] === 'wine') {
    const hasFarmTag = tags['direct_sale'] === 'yes' || tags['farm_shop'] === 'yes' || tags['organic'] === 'yes';
    return hasFarmTag && WINE_FARM_RE.test(name);
  }

  // shop=farm: Query B already scopes by name, but verify
  if (tags['shop'] === 'farm') return WINE_RE.test(name);

  return false;
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
  const street = tags['addr:street'] ?? '';
  const number = tags['addr:housenumber'] ?? '';

  return {
    name,
    address:       [street, number].filter(Boolean).join(' ') || null,
    city:          tags['addr:city'] ?? tags['addr:town'] ?? tags['addr:village'] ?? null,
    postal_code:   tags['addr:postcode'] ?? null,
    country,
    location:      `POINT(${lon} ${lat})`,
    farm_type:     ['wine'],
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

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function runQuery(label: string, query: string): Promise<OSMElement[]> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      log(`[${label}] attempt ${attempt}/3…`);
      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'Farmsy Wine Import',
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
  const a = await runQuery('A (craft/tourism/shop)', buildQueryA()); await pause();
  const b = await runQuery('B (shop=farm names)',    buildQueryB()); await pause();
  const c = await runQuery('C (vineyards)',           buildQueryC());
  return [...a, ...b, ...c];
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const saveMode = process.argv.includes('--save');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('Missing env vars');
  const supabase = createClient(supabaseUrl, serviceKey);

  // ── Task 1: Merge vegetables → produce ─────────────────────────────────────
  log('');
  log('═══ Task 1: vegetables → produce merge ════════════════════════════');

  // Load all farms paginated
  const PAGE = 1000;
  const allFarms: Array<{ osm_id: string; farm_type: unknown }> = [];
  let fromPage = 0;
  while (true) {
    const { data, error } = await supabase
      .from('farms')
      .select('osm_id, farm_type')
      .range(fromPage, fromPage + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    allFarms.push(...data);
    if (data.length < PAGE) break;
    fromPage += PAGE;
  }
  log(`  Loaded ${allFarms.length} farms`);

  const vegFarms = allFarms.filter(f => normalizeFarmTypes(f.farm_type).includes('vegetables'));
  log(`  Farms with 'vegetables': ${vegFarms.length}`);

  let mergeCount = 0;
  let alreadyHadProduce = 0;

  if (saveMode) {
    for (const farm of vegFarms) {
      const types = normalizeFarmTypes(farm.farm_type);
      const hadProduce = types.includes('produce');
      if (hadProduce) alreadyHadProduce++;
      const newTypes = [...new Set(types.filter(t => t !== 'vegetables').concat('produce'))];
      const { error } = await supabase
        .from('farms')
        .update({ farm_type: newTypes })
        .eq('osm_id', farm.osm_id);
      if (error) log(`  [WARN] ${farm.osm_id}: ${error.message}`);
      else mergeCount++;
      await new Promise(r => setTimeout(r, 30));
    }
    log(`  Merged: ${mergeCount}  (${alreadyHadProduce} already had produce, duplicates removed)`);
  } else {
    log(`  Dry-run: would merge ${vegFarms.length} farms (use --save to apply)`);
  }

  // ── Task 2: Wine OSM fetch ──────────────────────────────────────────────────
  log('');
  log('═══ Task 2: Wine / vineyard OSM import ════════════════════════════');

  const raw = await fetchAll();

  // Deduplicate + transform
  const farms: Record<string, unknown>[] = [];
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

  // Stats by primary_tag
  const byTag: Record<string, number> = {};
  const byCountry = { NL: 0, BE: 0 };
  for (const f of farms) {
    const t = f.primary_tag as string;
    byTag[t] = (byTag[t] ?? 0) + 1;
    byCountry[f.country as 'NL' | 'BE']++;
  }

  log('');
  log('── OSM results ───────────────────────────────────────────────────');
  log(`  Raw elements:      ${raw.length}`);
  log(`  Kept (wine farms): ${farms.length}  (NL: ${byCountry.NL}, BE: ${byCountry.BE})`);
  log(`  Filtered out:      ${skipped}`);
  log('  By tag:');
  for (const [tag, cnt] of Object.entries(byTag).sort((a, b) => b[1] - a[1])) {
    log(`    ${tag.padEnd(26)} ${cnt}`);
  }
  log('─────────────────────────────────────────────────────────────────');

  // Save JSON
  const outDir = join(process.cwd(), 'output');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'wine_osm.json'), JSON.stringify({
    metadata: { bbox: BBOX, fetchedAt: new Date().toISOString(), total: farms.length, byCountry, byTag },
    farms,
  }, null, 2));
  log('Saved → output/wine_osm.json');

  if (!saveMode) { log('Run with --save to import into Supabase.'); return; }

  // ── Supabase deduplication ──────────────────────────────────────────────────
  log('Loading existing farms for duplicate check…');
  // Reload (vegetables might have been updated above)
  const existingFarms: Array<{ osm_id: string; name: string | null; city: string | null; farm_type: unknown }> = [];
  fromPage = 0;
  while (true) {
    const { data, error } = await supabase.from('farms').select('osm_id, name, city, farm_type').range(fromPage, fromPage + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    existingFarms.push(...data);
    if (data.length < PAGE) break;
    fromPage += PAGE;
  }
  log(`  Loaded ${existingFarms.length} farms`);

  const byOsmId   = new Map<string, { farm_type: string[] }>();
  const byNameCity = new Map<string, { osm_id: string; farm_type: string[] }>();
  for (const f of existingFarms) {
    const types = normalizeFarmTypes(f.farm_type);
    byOsmId.set(f.osm_id, { farm_type: types });
    if (f.name && f.city) {
      const key = `${f.name.toLowerCase().trim()}|${f.city.toLowerCase().trim()}`;
      if (!byNameCity.has(key)) byNameCity.set(key, { osm_id: f.osm_id, farm_type: types });
    }
  }

  const toInsert:        Record<string, unknown>[]              = [];
  const toUpdateOsmId:   { osm_id: string; farm_type: string[] }[] = [];
  const toUpdateNameCity: { osm_id: string; farm_type: string[] }[] = [];

  for (const farm of farms) {
    const newTypes = farm.farm_type as string[];
    const osmId    = farm.osm_id as string;

    if (byOsmId.has(osmId)) {
      const ex = byOsmId.get(osmId)!;
      const merged = mergeFarmTypes(ex.farm_type, newTypes);
      if (merged.length > ex.farm_type.length) toUpdateOsmId.push({ osm_id: osmId, farm_type: merged });
      continue;
    }

    const nameKey = farm.name && farm.city
      ? `${String(farm.name).toLowerCase().trim()}|${String(farm.city).toLowerCase().trim()}`
      : null;
    if (nameKey && byNameCity.has(nameKey)) {
      const ex = byNameCity.get(nameKey)!;
      const merged = mergeFarmTypes(ex.farm_type, newTypes);
      if (merged.length > ex.farm_type.length) toUpdateNameCity.push({ osm_id: ex.osm_id, farm_type: merged });
      continue;
    }

    toInsert.push(farm);
  }

  log('');
  log('── Deduplication ─────────────────────────────────────────────────');
  log(`  New farms to insert:            ${toInsert.length}`);
  log(`  Existing to update (osm_id):    ${toUpdateOsmId.length}`);
  log(`  Existing to update (name+city): ${toUpdateNameCity.length}`);
  log('─────────────────────────────────────────────────────────────────');

  // Updates
  let updatesDone = 0;
  for (const u of [...toUpdateOsmId, ...toUpdateNameCity]) {
    const { error } = await supabase.from('farms').update({ farm_type: u.farm_type }).eq('osm_id', u.osm_id);
    if (error) log(`  [WARN] ${u.osm_id}: ${error.message}`);
    else updatesDone++;
    await new Promise(r => setTimeout(r, 50));
  }
  log(`Updated ${updatesDone} existing farms`);

  // Inserts
  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const { error } = await supabase.from('farms').upsert(toInsert.slice(i, i + BATCH), { onConflict: 'osm_id', ignoreDuplicates: false });
    if (error) throw new Error(`Insert batch: ${error.message}`);
    inserted += Math.min(BATCH, toInsert.length - i);
    await new Promise(r => setTimeout(r, 100));
  }
  log(`Inserted ${inserted} new wine farms`);

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
  log('── Task 1: vegetables → produce ─────────────────────────────────');
  log(`  Farms merged:              ${mergeCount}`);
  log(`  (already had produce):     ${alreadyHadProduce}`);
  log(`  Remaining vegetables:      ${catCounts['vegetables'] ?? 0}`);
  log('');
  log('── Task 2: wine import ──────────────────────────────────────────');
  log(`  OSM wine farms found:      ${farms.length}`);
  log(`  New farms inserted:        ${inserted}`);
  log(`  Existing farms updated:    ${updatesDone}`);
  log('');
  log('── Category totals ──────────────────────────────────────────────');
  const catOrder = ['produce', 'vegetables', 'wine', 'meat', 'dairy', 'eggs', 'cheese', 'markets', 'fish', 'honey'];
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
