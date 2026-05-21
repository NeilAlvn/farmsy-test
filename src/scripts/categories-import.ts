/**
 * Missing categories import — OSM targeted search + meat subcategory enrichment
 *
 * Phase 1 – Overpass bbox search (NL+BE) for:
 *   honey/bees, orchards/fruit, vegetables, mushrooms, nuts
 *
 * Phase 2 – Meat subcategory enrichment:
 *   Analyzes names of existing meat farms and adds beef/pork/poultry/lamb/game
 *
 * Duplicate handling:
 *   - osm_id match  → merge farm_type (no duplicate inserted)
 *   - name+city match → merge farm_type (no duplicate inserted)
 *   - new → insert
 *
 * Usage:
 *   npx ts-node -P tsconfig.scripts.json src/scripts/categories-import.ts
 *   npx ts-node -P tsconfig.scripts.json src/scripts/categories-import.ts --save
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const BBOX = '50.5,3.0,53.7,7.3';

// ── Regex patterns ─────────────────────────────────────────────────────────────

const CHAIN_RE     = /albert heijn|\bah\b|jumbo|lidl|aldi|\bspar\b|\bcoop\b|dirk|delhaize|carrefour|colruyt|hoogvliet/i;
const FARM_RE      = /hoeve|hoef|boerderij|\bboer\b|hof\b|\berf\b|erve|landgoed|ferme|domaine|exploitation|kwekerij|tuinderij|tuinder/i;

const HONEY_RE     = /imkerij|imkerbedrijf|\bimker\b|honingboer|honingkwekerij|apiculteur|apiculture|rucher/i;
const FRUIT_RE     = /boomgaard|fruitboer|fruitteelt|fruitkwekerij|fruitbedrijf|verger|fruithoeve/i;
const VEG_RE       = /aspergeboer|aspergehoeve|aspergeteelt|groentekwekerij|groentehoeve|tuinderij\b|maraîcher|maraîchage|légumes/i;
const MUSHROOM_RE  = /paddenstoel|champignonnière|champignonkwekerij|zwammenkwekerij/i;
const NUT_RE       = /\bnoten\b|hazelnotenboer|walnootboer|noix\b/i;

// Meat subcategory patterns
const BEEF_RE     = /\brund\b|rundvee|rundvlees|beef\b|cattle|\bkalf\b|kalfs|veau\b|angus\b|hereford|galloway|charolais|limousin|witblauw|blanc.bleu|aberdeen/i;
const PORK_RE     = /\bvarken\b|varkensvlees|varkenshouderij|\bzwijn\b|\bpig\b|porc\b|berkshire|duroc|pietrain/i;
const POULTRY_RE  = /\bkip\b|kippen|kippenboer|chicken|pluimvee|poulet|volaille|\bkalkoen\b|turkey|\beend\b|canard|\bgans\b|ganzen/i;
const LAMB_RE     = /\blam\b|lammeren|lamsvlees|\bschaap\b|schapen|mouton|agneau/i;
const GAME_RE     = /\bwild\b|wildfarm|wildvlees|gibier|\bhert\b|edelhert|\bree\b|everzwijn|sanglier|fazant|jachtwild/i;

function log(msg: string) {
  console.log(`${new Date().toISOString()} ${msg}`);
}

// ── Overpass queries ───────────────────────────────────────────────────────────
// Split into two queries to avoid the 180 s timeout.
//
// Query A — specific OSM tags (fast: small result sets)
// Query B — name-based searches scoped to shop=farm (much cheaper than
//            scanning all shop=* nodes by regex)

function buildQueryA(): string {
  return `[out:json][timeout:90][bbox:${BBOX}];
(
  node["craft"="beekeeper"];
  way["craft"="beekeeper"];
  node["shop"="honey"];
  way["shop"="honey"];
  node["shop"="fruit"];
  way["shop"="fruit"];
  node["shop"="greengrocer"]["direct_sale"="yes"];
  way["shop"="greengrocer"]["direct_sale"="yes"];
  node["shop"="greengrocer"]["farm_shop"="yes"];
  way["shop"="greengrocer"]["farm_shop"="yes"];
  node["shop"="greengrocer"]["organic"="yes"];
  way["shop"="greengrocer"]["organic"="yes"];
);
out center;`;
}

function buildQueryB(): string {
  // Scoped to shop=farm — OSM already tags these as farm shops so the result
  // set is small and the regex scan is cheap.
  return `[out:json][timeout:90][bbox:${BBOX}];
(
  node["shop"="farm"]["name"~"imkerij|honingboer|rucher|apiculteur|bijenhouder",i];
  way["shop"="farm"]["name"~"imkerij|honingboer|rucher|apiculteur|bijenhouder",i];
  node["shop"="farm"]["name"~"boomgaard|fruitboer|fruitkwekerij|fruitteelt|verger",i];
  way["shop"="farm"]["name"~"boomgaard|fruitboer|fruitkwekerij|fruitteelt|verger",i];
  node["shop"="farm"]["name"~"aspergeboer|asperge|groentekwekerij|tuinderij|maraîcher",i];
  way["shop"="farm"]["name"~"aspergeboer|asperge|groentekwekerij|tuinderij|maraîcher",i];
  node["shop"="farm"]["name"~"paddenstoel|champignon|zwammen",i];
  way["shop"="farm"]["name"~"paddenstoel|champignon|zwammen",i];
  node["shop"="farm"]["name"~"noten|hazelnoot|walnoot|noix",i];
  way["shop"="farm"]["name"~"noten|hazelnoot|walnoot|noix",i];
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

type SubLabel = 'honey' | 'fruit' | 'vegetables' | 'mushrooms' | 'nuts';

interface Categorized {
  farm_type: string[];
  subLabel: SubLabel;
  primaryTag: string;
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
  if (tags['craft'] === 'beekeeper') return 'craft=beekeeper';
  if (tags['shop'] === 'honey')      return 'shop=honey';
  if (tags['shop'] === 'fruit')      return 'shop=fruit';
  if (tags['landuse'] === 'orchard') return 'landuse=orchard';
  if (tags['shop'] === 'greengrocer') return 'shop=greengrocer';
  const shopVal = tags['shop'];
  const craftVal = tags['craft'];
  if (shopVal)  return `shop=${shopVal}`;
  if (craftVal) return `craft=${craftVal}`;
  return Object.entries(tags).map(([k, v]) => `${k}=${v}`)[0] ?? 'unknown';
}

function categorize(tags: Record<string, string>): Categorized | null {
  const name = (tags['name'] ?? '').toLowerCase();
  const primaryTag = getPrimaryTag(tags);

  // Honey
  if (tags['craft'] === 'beekeeper' || tags['shop'] === 'honey' || HONEY_RE.test(name))
    return { farm_type: ['honey'], subLabel: 'honey', primaryTag };

  // Fruit / Orchards
  if (tags['landuse'] === 'orchard' || tags['shop'] === 'fruit' || FRUIT_RE.test(name))
    return { farm_type: ['produce'], subLabel: 'fruit', primaryTag };

  // Vegetables
  if (tags['shop'] === 'greengrocer' || VEG_RE.test(name))
    return { farm_type: ['produce'], subLabel: 'vegetables', primaryTag };

  // Mushrooms
  if (MUSHROOM_RE.test(name))
    return { farm_type: ['produce'], subLabel: 'mushrooms', primaryTag };

  // Nuts
  if (NUT_RE.test(name))
    return { farm_type: ['produce'], subLabel: 'nuts', primaryTag };

  return null;
}

function isFarmBased(tags: Record<string, string>, subLabel: SubLabel): boolean {
  const name = tags['name'] ?? '';
  if (CHAIN_RE.test(name)) return false;

  // Always farm-based
  if (tags['craft'] === 'beekeeper' || tags['shop'] === 'honey') return true;
  if (tags['landuse'] === 'orchard') return !!tags['name'];
  if (tags['direct_sale'] === 'yes' || tags['farm_shop'] === 'yes' || tags['organic'] === 'yes') return true;
  if (FARM_RE.test(name)) return true;

  // Strong category-specific keywords imply farm context
  if (subLabel === 'honey'      && HONEY_RE.test(name))    return true;
  if (subLabel === 'fruit'      && FRUIT_RE.test(name))    return true;
  if (subLabel === 'vegetables' && VEG_RE.test(name))      return true;
  if (subLabel === 'mushrooms'  && MUSHROOM_RE.test(name)) return true;
  if (subLabel === 'nuts'       && NUT_RE.test(name))      return true;

  // shop=fruit without strong farm indicator: keep (specialty shops, rarely chains)
  if (tags['shop'] === 'fruit') return true;

  return false;
}

function transformElement(el: OSMElement): (Record<string, unknown> & { _subLabel: SubLabel }) | null {
  const coords = getCoords(el);
  if (!coords) return null;
  const tags = el.tags ?? {};
  const name = tags['name'];
  if (!name) return null;

  const cat = categorize(tags);
  if (!cat) return null;
  if (!isFarmBased(tags, cat.subLabel)) return null;

  const { lat, lon } = coords;
  const country = getCountry(tags, lat, lon);
  const street = tags['addr:street'] ?? '';
  const number = tags['addr:housenumber'] ?? '';

  return {
    _subLabel:     cat.subLabel,
    name,
    address:       [street, number].filter(Boolean).join(' ') || null,
    city:          tags['addr:city'] ?? tags['addr:town'] ?? tags['addr:village'] ?? null,
    postal_code:   tags['addr:postcode'] ?? null,
    country,
    location:      `POINT(${lon} ${lat})`,
    farm_type:     cat.farm_type,
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
    primary_tag:   cat.primaryTag,
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
          'User-Agent': 'Farmsy Categories Import',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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

async function fetchElements(): Promise<OSMElement[]> {
  const a = await runQuery('Query-A (tags)', buildQueryA());
  // Brief pause between requests to be polite to Overpass
  await new Promise(r => setTimeout(r, 3000));
  const b = await runQuery('Query-B (farm names)', buildQueryB());
  return [...a, ...b];
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const saveMode = process.argv.includes('--save');

  // ── Phase 1: OSM fetch ──────────────────────────────────────────────────────
  log('');
  log('═══ Phase 1: OSM search ═══════════════════════════════════════════');
  const elements = await fetchElements();

  // Transform + deduplicate OSM results
  const farms: Array<Record<string, unknown> & { _subLabel: SubLabel }> = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const el of elements) {
    const osmId = `${el.type}/${el.id}`;
    if (seen.has(osmId)) continue;
    seen.add(osmId);
    const farm = transformElement(el);
    if (farm) farms.push(farm);
    else skipped++;
  }

  // Stats by sub-label
  const byLabel: Record<SubLabel, { total: number; NL: number; BE: number }> = {
    honey:      { total: 0, NL: 0, BE: 0 },
    fruit:      { total: 0, NL: 0, BE: 0 },
    vegetables: { total: 0, NL: 0, BE: 0 },
    mushrooms:  { total: 0, NL: 0, BE: 0 },
    nuts:       { total: 0, NL: 0, BE: 0 },
  };
  for (const f of farms) {
    byLabel[f._subLabel].total++;
    byLabel[f._subLabel][f.country as 'NL' | 'BE']++;
  }

  log('');
  log('── OSM results by category ───────────────────────────────────────');
  for (const [label, s] of Object.entries(byLabel)) {
    log(`  ${label.padEnd(12)} ${String(s.total).padStart(3)} (NL: ${s.NL}, BE: ${s.BE})`);
  }
  log(`  Total kept: ${farms.length}  |  Filtered out: ${skipped}`);
  log('─────────────────────────────────────────────────────────────────');

  // Save JSON
  const outDir = join(process.cwd(), 'output');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'categories_osm.json'), JSON.stringify({ metadata: { bbox: BBOX, fetchedAt: new Date().toISOString(), byLabel }, farms }, null, 2));
  log('Saved → output/categories_osm.json');

  if (!saveMode) {
    log('Run with --save to import into Supabase.');
    return;
  }

  // ── Supabase: load existing farms ──────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('Missing env vars');
  const supabase = createClient(supabaseUrl, serviceKey);

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

  // Build lookup maps
  const byOsmId  = new Map<string, { farm_type: string[] }>();
  const byNameCity = new Map<string, { osm_id: string; farm_type: string[] }>();
  for (const f of existing) {
    const types = normalizeFarmTypes(f.farm_type);
    byOsmId.set(f.osm_id, { farm_type: types });
    if (f.name && f.city) {
      const key = `${f.name.toLowerCase().trim()}|${f.city.toLowerCase().trim()}`;
      if (!byNameCity.has(key)) byNameCity.set(key, { osm_id: f.osm_id, farm_type: types });
    }
  }

  // ── Categorise each farm: insert / update-osm_id / update-name_city ────────
  const toInsert:         Array<Record<string, unknown>> = [];
  const toUpdateByOsmId:  Array<{ osm_id: string; farm_type: string[]; subLabel: SubLabel }> = [];
  const toUpdateByName:   Array<{ osm_id: string; farm_type: string[]; subLabel: SubLabel }> = [];

  const insertByLabel:    Record<SubLabel, number> = { honey: 0, fruit: 0, vegetables: 0, mushrooms: 0, nuts: 0 };
  const updOsmByLabel:    Record<SubLabel, number> = { honey: 0, fruit: 0, vegetables: 0, mushrooms: 0, nuts: 0 };
  const updNameByLabel:   Record<SubLabel, number> = { honey: 0, fruit: 0, vegetables: 0, mushrooms: 0, nuts: 0 };

  for (const farm of farms) {
    const { _subLabel, ...record } = farm;
    const newTypes = (record.farm_type as string[]);
    const osmId    = record.osm_id as string;

    // 1. osm_id match
    if (byOsmId.has(osmId)) {
      const ex = byOsmId.get(osmId)!;
      const merged = mergeFarmTypes(ex.farm_type, newTypes);
      if (merged.length > ex.farm_type.length) {
        toUpdateByOsmId.push({ osm_id: osmId, farm_type: merged, subLabel: _subLabel });
        updOsmByLabel[_subLabel]++;
      }
      continue;
    }

    // 2. name+city match
    const nameKey = farm.name && farm.city
      ? `${String(farm.name).toLowerCase().trim()}|${String(farm.city).toLowerCase().trim()}`
      : null;
    if (nameKey && byNameCity.has(nameKey)) {
      const ex = byNameCity.get(nameKey)!;
      const merged = mergeFarmTypes(ex.farm_type, newTypes);
      if (merged.length > ex.farm_type.length) {
        toUpdateByName.push({ osm_id: ex.osm_id, farm_type: merged, subLabel: _subLabel });
        updNameByLabel[_subLabel]++;
      }
      continue;
    }

    // 3. New farm
    toInsert.push(record);
    insertByLabel[_subLabel]++;
  }

  log('');
  log('── Deduplication result ─────────────────────────────────────────');
  log(`  New farms to insert:         ${toInsert.length}`);
  log(`  Existing farms to update (osm_id match):    ${toUpdateByOsmId.length}`);
  log(`  Existing farms to update (name+city match): ${toUpdateByName.length}`);
  log('─────────────────────────────────────────────────────────────────');

  // ── Execute updates ────────────────────────────────────────────────────────
  const allUpdates = [...toUpdateByOsmId, ...toUpdateByName];
  let updatesDone = 0;
  for (const u of allUpdates) {
    const { error } = await supabase.from('farms').update({ farm_type: u.farm_type }).eq('osm_id', u.osm_id);
    if (error) log(`  [WARN] update failed for ${u.osm_id}: ${error.message}`);
    else updatesDone++;
    await new Promise(r => setTimeout(r, 50));
  }
  log(`Updated ${updatesDone} existing farms`);

  // ── Execute inserts ────────────────────────────────────────────────────────
  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { error } = await supabase.from('farms').upsert(batch, { onConflict: 'osm_id', ignoreDuplicates: false });
    if (error) throw new Error(`Insert batch error: ${error.message}`);
    inserted += batch.length;
    await new Promise(r => setTimeout(r, 100));
  }
  log(`Inserted ${inserted} new farms`);

  // ── Phase 2: Meat subcategories ─────────────────────────────────────────────
  log('');
  log('═══ Phase 2: Meat subcategory enrichment ══════════════════════════');
  log('Loading all meat farms from DB…');

  const { data: allFarms } = await supabase.from('farms').select('osm_id, name, farm_type').eq('is_published', true);
  const meatFarms = (allFarms ?? []).filter(f => normalizeFarmTypes(f.farm_type).includes('meat'));
  log(`Found ${meatFarms.length} meat farms`);

  const meatStats = { beef: 0, pork: 0, poultry: 0, lamb: 0, game: 0, unchanged: 0 };
  let meatUpdated = 0;

  for (const farm of meatFarms) {
    const name     = (farm.name ?? '').toLowerCase();
    const existing = normalizeFarmTypes(farm.farm_type);
    const toAdd: string[] = [];

    if (BEEF_RE.test(name)    && !existing.includes('beef'))    toAdd.push('beef');
    if (PORK_RE.test(name)    && !existing.includes('pork'))    toAdd.push('pork');
    if (POULTRY_RE.test(name) && !existing.includes('poultry')) toAdd.push('poultry');
    if (LAMB_RE.test(name)    && !existing.includes('lamb'))    toAdd.push('lamb');
    if (GAME_RE.test(name)    && !existing.includes('game'))    toAdd.push('game');

    if (toAdd.length === 0) { meatStats.unchanged++; continue; }

    const merged = mergeFarmTypes(existing, toAdd);
    const { error } = await supabase.from('farms').update({ farm_type: merged }).eq('osm_id', farm.osm_id);
    if (error) { log(`  [WARN] meat update failed for ${farm.osm_id}: ${error.message}`); continue; }

    for (const sub of toAdd) meatStats[sub as keyof typeof meatStats]++;
    meatUpdated++;
    await new Promise(r => setTimeout(r, 50));
  }

  log(`  Subcategories added to ${meatUpdated} meat farms:`);
  log(`    beef: ${meatStats.beef}  pork: ${meatStats.pork}  poultry: ${meatStats.poultry}  lamb: ${meatStats.lamb}  game: ${meatStats.game}`);
  log(`    Unchanged (no keyword match): ${meatStats.unchanged}`);

  // ── Final counts ────────────────────────────────────────────────────────────
  log('');
  log('═══ Final report ══════════════════════════════════════════════════');

  const { data: finalRows } = await supabase.from('farms').select('farm_type').eq('is_published', true);
  const catCounts: Record<string, number> = {};
  for (const row of finalRows ?? []) {
    for (const t of normalizeFarmTypes(row.farm_type)) {
      catCounts[t] = (catCounts[t] ?? 0) + 1;
    }
  }
  const { count: totalCount } = await supabase.from('farms').select('*', { count: 'exact', head: true }).eq('is_published', true);

  log('');
  log('── OSM Phase 1 by sub-category ──────────────────────────────────');
  const labels: SubLabel[] = ['honey', 'fruit', 'vegetables', 'mushrooms', 'nuts'];
  for (const label of labels) {
    const s = byLabel[label];
    const ins = insertByLabel[label];
    const upd = updOsmByLabel[label] + updNameByLabel[label];
    log(`  ${label.padEnd(12)} found: ${String(s.total).padStart(3)}  |  new: ${ins}  |  updated: ${upd}`);
  }
  log('');
  log('── Meat subcategories added ──────────────────────────────────────');
  log(`  beef: ${meatStats.beef}  pork: ${meatStats.pork}  poultry: ${meatStats.poultry}  lamb: ${meatStats.lamb}  game: ${meatStats.game}`);
  log('');
  log('── Updated category totals (farms per category) ─────────────────');
  const catOrder = ['produce', 'meat', 'dairy', 'eggs', 'cheese', 'wine', 'markets', 'fish'];
  for (const cat of catOrder) {
    if (catCounts[cat]) log(`  ${cat.padEnd(10)}: ${catCounts[cat]}`);
  }
  log('');
  log(`  Total farms in DB: ${totalCount ?? '?'}`);
  log('═══════════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
