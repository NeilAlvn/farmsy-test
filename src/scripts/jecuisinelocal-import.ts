/**
 * JeCuisineLocal.be farm import script
 *
 * The site embeds all 1,343 producer records as HTML-entity-encoded JSON
 * in a `data-markers` attribute on the `/producteurs-artisans/` listing page —
 * there is no separate API endpoint.
 *
 * Usage:
 *   npm run import:jcl          → fetch & save output/jecuisinelocal-farms.json
 *   npm run import:jcl:save     → load JSON → upsert into Supabase
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Category = 'Eggs' | 'Dairy' | 'Meat' | 'Fish' | 'Produce' | 'Cheese' | 'Wine' | 'Markets';

export interface FarmRecord {
  name: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string;
  latitude: number;
  longitude: number;
  location: string;
  farm_type: Category[];
  website: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  image: string | null;
  source: string;
  osm_id: string;
  is_published: boolean;
  primary_tag: string | null;
}

// ---------------------------------------------------------------------------
// Raw shape returned by JCL's data-markers JSON
// ---------------------------------------------------------------------------

interface JclContact {
  label: string;
  url: string;
}

interface JclProducer {
  id: number;
  title: string;
  type: string;
  address: string;
  url_page: string;
  picture?: { src?: string };
  bio?: boolean;
  map: { lat: string; long: string };
  categories: Array<{ label: string }>;
  contacts: JclContact[];
}

// ---------------------------------------------------------------------------
// Category mapping — exact French labels used by JeCuisineLocal
// ---------------------------------------------------------------------------

const CATEGORY_RULES: Array<{ pattern: RegExp; category: Category }> = [
  // Eggs & poultry
  { pattern: /oeufs?|volaille|poulet|dinde|canard|oie/i,                           category: 'Eggs'    },
  // Dairy (non-cheese)
  { pattern: /lait\b|produits laitiers|beurre|cr[eè]me|yaourt|glace|bufflonne|autres produits laitiers/i, category: 'Dairy' },
  // Cheese
  { pattern: /fromage|ch[eè]vre|brebis|vache\b/i,                                  category: 'Cheese'  },
  // Meat & charcuterie
  { pattern: /viande|charcuterie|boeuf|veau|porc|agneau|mouton|escargot|foie gras|salaison/i, category: 'Meat' },
  // Fish & seafood
  { pattern: /poisson|saumon|truite|crustac|fruits de mer/i,                       category: 'Fish'    },
  // Wine, beer, cider, spirits — "Boissons" covers breweries/vineyards
  { pattern: /vin\b|vins\b|vignoble|viticole|bi[eè]re|cidre|spiritueux|boissons?/i, category: 'Wine'   },
  // Produce — plant-based, artisan food, potatoes (plural), horticulture
  { pattern: /l[eé]gume|fruit|pommes? de terre|c[eé]r[eé]ale|l[eé]gumineuse|farine|pains?\b|boulangerie|p[aâ]tisserie|confiture|compote|sirop|huile|miel|ruche|chocolat|confiserie|jus|limonade|sauce|[eé]pice|tapenade|p[aâ]tes|chips|frites|soupe|conserve|quinoa|lentille|sarasin|viennoiserie|biscuit|horticole|p[eé]pini[eè]re/i, category: 'Produce' },
];

// Producer types that override or supplement categories
const TYPE_CATEGORY: Record<string, Category[]> = {
  'Boucher':             ['Meat'],
  'Fromager':            ['Cheese'],
  'Boulanger-Pâtissier': ['Produce'],
  'Table de terroir':    ['Markets'],
  'Magasin de proximité':['Markets'],
  'E-commerce':          ['Markets'],
};

function mapCategories(frenchLabels: string[], producerType: string): Category[] {
  const result = new Set<Category>();

  // From category labels
  for (const label of frenchLabels) {
    for (const { pattern, category } of CATEGORY_RULES) {
      if (pattern.test(label)) result.add(category);
    }
  }

  // From producer type
  for (const [type, cats] of Object.entries(TYPE_CATEGORY)) {
    if (producerType.includes(type)) cats.forEach(c => result.add(c));
  }

  return Array.from(result);
}

// ---------------------------------------------------------------------------
// HTML entity decoder — handles the attribute-encoded JSON
// ---------------------------------------------------------------------------

function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&quot;/g,  '"')
    .replace(/&#x5B;/g,  '[')
    .replace(/&#x5D;/g,  ']')
    .replace(/&#x7B;/g,  '{')
    .replace(/&#x7D;/g,  '}')
    .replace(/&#x3A;/g,  ':')
    .replace(/&#x2C;/g,  ',')
    .replace(/&#x5C;/g,  '\\')   // preserve backslash — needed for é etc.
    .replace(/&#x2F;/g,  '/')
    .replace(/&#x20;/g,  ' ')
    .replace(/&#x40;/g,  '@')
    .replace(/&amp;/g,   '&')
    .replace(/&lt;/g,    '<')
    .replace(/&gt;/g,    '>')
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g,           (_, n) => String.fromCharCode(parseInt(n, 10)));
}

// ---------------------------------------------------------------------------
// Address parser
// Format: "Street Number</br>City PostalCode"   (Belgian 4-digit postal code)
// ---------------------------------------------------------------------------

function parseAddress(raw: string): { address: string | null; city: string | null; postal_code: string | null } {
  const parts = raw.replace(/<\/br>/g, '\n').replace(/<[^>]+>/g, '').trim().split('\n');
  const street = parts[0]?.trim() || null;

  let city: string | null = null;
  let postal_code: string | null = null;

  if (parts[1]) {
    const line2 = parts[1].trim();
    // Belgian postal codes are 4 digits at the end: "Saint-Sauveur 7912"
    const m = line2.match(/^(.*?)\s+(\d{4})\s*$/);
    if (m) {
      city = m[1].trim();
      postal_code = m[2];
    } else {
      city = line2;
    }
  }

  return { address: street, city, postal_code };
}

// ---------------------------------------------------------------------------
// Contact extractor
// ---------------------------------------------------------------------------

function parseContacts(contacts: JclContact[]): { website: string | null; phone: string | null; email: string | null } {
  let website: string | null = null;
  let phone: string | null = null;
  let email: string | null = null;

  for (const c of contacts) {
    if (c.url.startsWith('mailto:') && !email) email = c.url.replace('mailto:', '');
    else if (c.url.startsWith('tel:') && !phone) phone = c.url.replace('tel:', '');
    else if (c.url.startsWith('http') && !website) website = c.url;
  }

  return { website, phone, email };
}

// ---------------------------------------------------------------------------
// Logger / sleep
// ---------------------------------------------------------------------------

function log(msg: string, level: 'info' | 'warn' | 'error' | 'success' = 'info') {
  const prefix = { info: '[INFO]', warn: '[WARN]', error: '[ERROR]', success: '[OK  ]' }[level];
  console.log(`${new Date().toISOString()} ${prefix} ${msg}`);
}

// ---------------------------------------------------------------------------
// Fetch & extract data-markers from the listing page
// ---------------------------------------------------------------------------

const LISTING_URL = 'https://www.jecuisinelocal.be/producteurs-artisans/';

async function fetchProducers(): Promise<JclProducer[]> {
  log(`Fetching ${LISTING_URL} …`);
  const res = await fetch(LISTING_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Farmsy Bot)',
      'Accept': 'text/html',
    },
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} fetching listing page`);

  const html = await res.text();
  log(`  Page size: ${(html.length / 1e6).toFixed(1)} MB`);

  const marker = 'data-markers="';
  const idx = html.indexOf(marker);
  if (idx === -1) throw new Error('data-markers attribute not found on page');

  const start = idx + marker.length;
  const end = html.indexOf('"', start);
  const raw = html.slice(start, end);

  log(`  data-markers length: ${(raw.length / 1e3).toFixed(0)} KB`);

  const decoded = decodeHtmlEntities(raw);
  const data: JclProducer[] = JSON.parse(decoded);
  log(`  Parsed ${data.length} producers`, 'success');
  return data;
}

// ---------------------------------------------------------------------------
// Transform one JCL producer → FarmRecord
// ---------------------------------------------------------------------------

// Only direct farm sales — excludes restaurants, shops, bakeries, e-commerce.
const ALLOWED_TYPES = new Set([
  'Magasin à la ferme',  // 574 — farm shop
  'Producteur',          //  46 — direct producer
]);

function transformProducer(p: JclProducer): FarmRecord | null {
  if (!ALLOWED_TYPES.has(p.type)) return null;

  const lat = parseFloat(p.map.lat);
  const lng = parseFloat(p.map.long);
  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;

  // Basic Belgium bounding box sanity check
  if (lat < 49.0 || lat > 51.8 || lng < 2.3 || lng > 6.7) return null;

  const { address, city, postal_code } = parseAddress(p.address);
  const { website, phone, email } = parseContacts(p.contacts);

  const frenchLabels = p.categories.map(c => c.label);
  const farmType = mapCategories(frenchLabels, p.type);

  return {
    name: p.title,
    address,
    city,
    postal_code,
    country: 'BE',
    latitude: lat,
    longitude: lng,
    location: `POINT(${lng} ${lat})`,
    farm_type: farmType,
    website,
    phone,
    email,
    description: `Type: ${p.type}${p.bio ? ' · Bio' : ''}`,
    image: p.picture?.src ?? null,
    source: 'jecuisinelocal',
    osm_id: `jecuisinelocal/${p.id}`,
    is_published: true,
    primary_tag: p.type || null,
  };
}

// ---------------------------------------------------------------------------
// JSON output
// ---------------------------------------------------------------------------

function saveFarmsToJSON(farms: FarmRecord[]): string {
  const outputDir = join(process.cwd(), 'output');
  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, 'jecuisinelocal-farms.json');

  const byCategory: Record<string, number> = {};
  for (const f of farms) {
    for (const c of f.farm_type) byCategory[c] = (byCategory[c] ?? 0) + 1;
    if (f.farm_type.length === 0) byCategory['(none)'] = (byCategory['(none)'] ?? 0) + 1;
  }

  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        metadata: {
          source: 'jecuisinelocal',
          listingUrl: LISTING_URL,
          fetchedAt: new Date().toISOString(),
          totalRecords: farms.length,
          byCategory,
          note: 'farm_type is an array. Current DB column is text — the --save mode writes farm_type[0].',
        },
        farms,
      },
      null,
      2,
    ),
  );

  log(`Saved ${farms.length} records → ${outputPath}`, 'success');
  return outputPath;
}

// ---------------------------------------------------------------------------
// Supabase import (--save mode)
// ---------------------------------------------------------------------------

interface ExistingFarm { lat: number; lng: number; name: string | null; city: string | null; osm_id: string }

/** Fetch ALL existing farms (paginated, bypasses RPC 1k row limit). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllExisting(supabase: any): Promise<ExistingFarm[]> {
  const PAGE = 1000;
  const all: ExistingFarm[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('farms')
      .select('name, city, osm_id, location')
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`Fetching existing farms: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data as Array<{ name: string | null; city: string | null; osm_id: string }>) {
      all.push({ lat: 0, lng: 0, name: row.name, city: row.city, osm_id: row.osm_id });
    }

    if (data.length < PAGE) break;
    from += PAGE;
  }

  return all;
}

/** Fetch farms WITH parsed coordinates from the RPC (paginated). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchExistingWithCoords(supabase: any): Promise<ExistingFarm[]> {
  const { data, error } = await supabase.rpc('get_farms_with_coords');
  if (error) throw new Error(`RPC error: ${error.message}`);
  return (data ?? []).map((r: { lat: number; lng: number; name: string; city: string; osm_id: string }) => ({
    lat: r.lat, lng: r.lng, name: r.name, city: r.city, osm_id: r.osm_id,
  }));
}

/** ~100 m bounding box check at Belgium's latitude (fast pre-filter). */
function withinBbox(lat1: number, lng1: number, lat2: number, lng2: number): boolean {
  return Math.abs(lat1 - lat2) < 0.0009 && Math.abs(lng1 - lng2) < 0.00135;
}

async function saveToSupabase(farms: FarmRecord[]): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // ── 1. Load existing farms ──────────────────────────────────────────────────
  log('Loading existing farms for duplicate check…');
  const [existing, existingCoords] = await Promise.all([
    fetchAllExisting(supabase),
    fetchExistingWithCoords(supabase),
  ]);
  log(`  ${existing.length} total existing farms (${existingCoords.length} with parsed coords)`);

  // Build lookup sets for fast dedup
  const existingOsmIds  = new Set(existing.map(e => e.osm_id));
  const existingNameCity = new Set(
    existing
      .filter(e => e.name && e.city)
      .map(e => `${e.name!.toLowerCase().trim()}|${e.city!.toLowerCase().trim()}`)
  );

  // ── 2. Categorise each JCL farm ─────────────────────────────────────────────
  let skipOsmId    = 0;   // already imported from JCL (re-run safety)
  let skipCoord    = 0;   // same physical location as existing farm
  let skipNameCity = 0;   // same name + city

  const toInsert: Array<Record<string, unknown>> = [];

  for (const farm of farms) {
    // a) Same osm_id → upsert handles it; don't count as skip
    const alreadyJcl = existingOsmIds.has(farm.osm_id);

    // b) Coordinate collision with existing non-JCL farm
    const coordDup = !alreadyJcl && existingCoords.some(
      e => withinBbox(farm.latitude, e.lat, farm.longitude, e.lng)
    );
    if (coordDup) { skipCoord++; continue; }

    // c) Name + city collision
    const ncKey = `${farm.name.toLowerCase().trim()}|${(farm.city ?? '').toLowerCase().trim()}`;
    const nameDup = !alreadyJcl && existingNameCity.has(ncKey);
    if (nameDup) { skipNameCity++; continue; }

    if (alreadyJcl) skipOsmId++;

    // farm_type: lowercase array matching the frontend's CategoryId values
    const types = farm.farm_type.map(t => t.toLowerCase()).filter(t => t.length > 0);

    toInsert.push({
      name:          farm.name,
      address:       farm.address,
      city:          farm.city,
      postal_code:   farm.postal_code,
      country:       farm.country,
      location:      farm.location,          // "POINT(lng lat)"
      farm_type:     types.length > 0 ? types : null,  // text[] e.g. ['dairy','cheese']
      website:       farm.website,
      phone:         farm.phone,
      email:         farm.email,
      description:   farm.description,
      image:         farm.image,
      source:        'jecuisinelocal',
      osm_id:        farm.osm_id,
      is_published:  true,
      primary_tag:   farm.primary_tag,
    });
  }

  log('');
  log('── Duplicate check ──────────────────────────────────────────────');
  log(`  Total JCL farms:          ${farms.length}`);
  log(`  Coord dups (≤100m):       ${skipCoord}`);
  log(`  Name+city dups:           ${skipNameCity}`);
  log(`  Already in DB (re-run):   ${skipOsmId}`);
  log(`  To insert/update:         ${toInsert.length}`);
  log('─────────────────────────────────────────────────────────────────');

  if (toInsert.length === 0) {
    log('Nothing new to insert.', 'warn');
    return;
  }

  // ── 3. Upsert in batches ────────────────────────────────────────────────────
  const BATCH = 100;
  let saved = 0;

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { error } = await supabase
      .from('farms')
      .upsert(batch, { onConflict: 'osm_id', ignoreDuplicates: false });

    if (error) throw new Error(`Batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
    saved += batch.length;
    log(`  Upserted ${saved}/${toInsert.length}…`);
    await new Promise(r => setTimeout(r, 100));
  }

  // ── 4. Final count ──────────────────────────────────────────────────────────
  const { count } = await supabase.from('farms').select('*', { count: 'exact', head: true });
  log('');
  log('── Import complete ──────────────────────────────────────────────', 'success');
  log(`  New farms inserted:       ${saved - skipOsmId}`);
  log(`  Re-runs updated:          ${skipOsmId}`);
  log(`  Total farms in database:  ${count ?? '?'}`, 'success');
  log('─────────────────────────────────────────────────────────────────');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const saveMode = process.argv.includes('--save');

  if (saveMode) {
    const jsonPath = join(process.cwd(), 'output', 'jecuisinelocal-farms.json');
    if (!existsSync(jsonPath)) throw new Error('Run without --save first to fetch data.');
    const { farms } = JSON.parse(readFileSync(jsonPath, 'utf-8')) as { farms: FarmRecord[] };
    log(`Loaded ${farms.length} farms from JSON`);
    await saveToSupabase(farms);
    return;
  }

  log('='.repeat(72));
  log('JeCuisineLocal.be — scraping /producteurs-artisans/');
  log('='.repeat(72));

  const raw = await fetchProducers();

  const farms: FarmRecord[] = [];
  let skipped = 0;
  for (const p of raw) {
    const record = transformProducer(p);
    if (record) farms.push(record);
    else skipped++;
  }

  log(`Transformed: ${farms.length} valid, ${skipped} skipped (no/invalid coords)`);
  saveFarmsToJSON(farms);
  log('');
  log('Run with --save to import into Supabase.');
}

if (require.main === module) {
  main().catch(err => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}

export { fetchProducers, mapCategories, saveFarmsToJSON };
