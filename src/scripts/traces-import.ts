/**
 * TRACES NT — EU Organic Operator Directory extractor
 *
 * Pulls all SKAL-certified (NL-BIO-01) operators from the public EU TRACES API:
 *   GET https://webgate.ec.europa.eu/tracesnt/directory/publication/organic-operator/for/query
 *   ?max=100&offset=N&states=ISSUED&countryCode=NL
 *
 * Discovered via Playwright network interception. No authentication required —
 * this is fully public EU government data.
 *
 * Filters for primary producers (activity contains "production").
 * Geocodes addresses using PDOK (Dutch government geocoder, free).
 *
 * Usage:
 *   npm run import:traces              → fetch + geocode → output/traces/
 *   npm run import:traces:save         → deduplicate + upsert into Supabase
 *
 * Output (output/traces/):
 *   raw_operators.json      — all 5,300+ NL operators
 *   geocoded_operators.json — with PDOK lat/lng (primary producers only)
 *   extraction_report.json  — stats
 *
 * Legal: TRACES NT is an official EU public database (open government data).
 *        No scraping — this uses the public REST API the browser itself calls.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// ─── Config ───────────────────────────────────────────────────────────────────

const TRACES_API  = 'https://webgate.ec.europa.eu/tracesnt/directory/publication/organic-operator/for/query';
const TRACES_REF  = 'https://webgate.ec.europa.eu/tracesnt/directory/publication/organic-operator/index';
const PDOK_BASE   = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
const OUT_DIR     = join(process.cwd(), 'output', 'traces');
const PAGE_SIZE   = 100;
const REQUEST_DELAY_MS = 400;   // courtesy delay between TRACES requests
const PDOK_DELAY_MS    = 350;   // courtesy delay between PDOK requests
const USER_AGENT  = 'Farmsy research bot (+https://farmsy.nl)';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TracesActivity {
  id:          string;
  translation: string;
}

interface TracesAddress {
  street?:          { value: string };
  cityReference?:   { postalCode: string; name: string };
}

interface TracesRecord {
  id:              number;
  reference:       string;
  operatorIdentifier: string;
  status:          { id: string; translation: string };
  issuingBody:     { code: string; name: string };
  operator:        { name: string; address: TracesAddress };
  activities:      TracesActivity[];
  categoriesOfProduct: Array<{ id: string; translation: string }>;
  expiresOn:       string;
  issuedOn:        string;
}

interface Operator {
  reference:         string;
  name:              string;
  street:            string | null;
  postal_code:       string | null;
  city:              string | null;
  control_authority: string;
  activities:        string[];
  categories:        string[];
  issued_on:         string | null;
  expires_on:        string | null;
}

interface GeocodedOperator extends Operator {
  lat:           number | null;
  lng:           number | null;
  geocode_query: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string, level: 'info' | 'warn' | 'ok' = 'info') {
  const pfx = { info: '[INFO]', warn: '[WARN]', ok: '[OK  ]' }[level];
  console.log(`${new Date().toISOString().slice(11, 19)} ${pfx} ${msg}`);
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function saveJson(filename: string, data: unknown): string {
  mkdirSync(OUT_DIR, { recursive: true });
  const p = join(OUT_DIR, filename);
  writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
  log(`Saved → ${p}`, 'ok');
  return p;
}

// ─── Phase 1: Fetch all NL operators from TRACES API ─────────────────────────

async function fetchPage(offset: number): Promise<{ records: TracesRecord[]; total: number }> {
  const url = `${TRACES_API}?max=${PAGE_SIZE}&offset=${offset}&states=ISSUED&countryCode=NL&sort=-issuedOn`;

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept':     'application/json',
          'Referer':    TRACES_REF,
        },
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const ct = res.headers.get('content-type') ?? '';
        if (!ct.includes('json')) {
          // Likely rate-limited or session expired — wait and retry
          log(`  Offset ${offset}: HTTP ${res.status} (non-JSON) — retry ${attempt}/4`, 'warn');
          await sleep(5000 * attempt);
          continue;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const total    = parseInt(res.headers.get('documentfoundcount') ?? '0', 10);
      const records  = await res.json() as TracesRecord[];
      return { records: Array.isArray(records) ? records : [], total };

    } catch (e) {
      if (attempt === 4) throw e;
      log(`  Offset ${offset}: ${e} — retry ${attempt}/4`, 'warn');
      await sleep(3000 * attempt);
    }
  }

  return { records: [], total: 0 };
}

async function fetchAllOperators(): Promise<{ operators: Operator[]; total_raw: number }> {
  // Get first page to determine total count
  log('Fetching first page to get total record count…');
  const { records: firstPage, total } = await fetchPage(0);
  log(`Total NL records in TRACES: ${total}`);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  log(`Fetching ${totalPages} pages (${PAGE_SIZE} records each)…`);

  const allRecords: TracesRecord[] = [...firstPage];

  for (let page = 1; page < totalPages; page++) {
    const offset = page * PAGE_SIZE;
    await sleep(REQUEST_DELAY_MS);

    const { records } = await fetchPage(offset);
    allRecords.push(...records);

    if (page % 10 === 0 || page === totalPages - 1) {
      log(`  Page ${page + 1}/${totalPages}: ${allRecords.length}/${total} records`);
    }
  }

  log(`Fetched ${allRecords.length} raw records`, 'ok');

  // Transform to clean operator objects
  const operators: Operator[] = allRecords.map(r => ({
    reference:         r.reference,
    name:              r.operator?.name ?? '',
    street:            r.operator?.address?.street?.value ?? null,
    postal_code:       r.operator?.address?.cityReference?.postalCode ?? null,
    city:              r.operator?.address?.cityReference?.name ?? null,
    control_authority: r.issuingBody?.code ?? 'NL-BIO-01',
    activities:        (r.activities ?? []).map(a => a.translation),
    categories:        (r.categoriesOfProduct ?? []).map(c => c.translation),
    issued_on:         r.issuedOn ?? null,
    expires_on:        r.expiresOn ?? null,
  })).filter(op => op.name.length > 0);

  return { operators, total_raw: total };
}

// ─── Phase 2: Filter primary producers ───────────────────────────────────────

function isPrimaryProducer(op: Operator): boolean {
  // Keep operators whose activities include primary production
  // TRACES activity IDs: "production" = primary production of plants/livestock
  const text = op.activities.join(' ').toLowerCase();
  return /production|primary|primary production/i.test(text);
}

// ─── Phase 3: PDOK geocoding ─────────────────────────────────────────────────

async function geocodeOne(op: Operator): Promise<{ lat: number; lng: number; query: string } | null> {
  // Build queries from most to least specific
  const queries: string[] = [];
  if (op.street && op.city)        queries.push(`${op.street} ${op.city}`);
  if (op.postal_code && op.city)   queries.push(`${op.postal_code} ${op.city}`);
  if (op.street && op.postal_code) queries.push(`${op.street} ${op.postal_code}`);
  if (op.city)                     queries.push(op.city);
  if (queries.length === 0)        return null;

  for (const query of queries) {
    try {
      const url = `${PDOK_BASE}?q=${encodeURIComponent(query)}&rows=1&fl=centroide_ll`;
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) continue;
      const data = await res.json() as { response: { docs: Array<{ centroide_ll?: string }> } };
      const doc  = data?.response?.docs?.[0];
      if (!doc?.centroide_ll) continue;
      const m = doc.centroide_ll.match(/POINT\(([0-9.]+)\s+([0-9.]+)\)/);
      if (!m) continue;
      return { lat: parseFloat(m[2]), lng: parseFloat(m[1]), query };
    } catch { /* try next query */ }
  }
  return null;
}

async function geocodeAll(operators: Operator[]): Promise<GeocodedOperator[]> {
  const result: GeocodedOperator[] = [];
  let ok = 0, failed = 0;

  log(`Geocoding ${operators.length} operators via PDOK…`);

  for (let i = 0; i < operators.length; i++) {
    if ((i + 1) % 100 === 0 || i === 0) {
      log(`  ${i + 1}/${operators.length} (ok=${ok}, failed=${failed})`);
    }

    const geo = await geocodeOne(operators[i]);
    await sleep(PDOK_DELAY_MS);

    if (geo) {
      result.push({ ...operators[i], lat: geo.lat, lng: geo.lng, geocode_query: geo.query });
      ok++;
    } else {
      result.push({ ...operators[i], lat: null, lng: null, geocode_query: null });
      failed++;
    }
  }

  log(`Geocoding complete: ${ok} succeeded, ${failed} failed`, 'ok');
  return result;
}

// ─── Phase 4: Supabase import ─────────────────────────────────────────────────

function activitiesToFarmTypes(activities: string[], categories: string[]): string[] {
  const types = new Set<string>();
  const text = [...activities, ...categories].join(' ').toLowerCase();

  if (/livestock|cattle|cow|dairy|milk|goat|sheep|pig|swine|poultry/i.test(text)) {
    types.add('dairy');
    types.add('meat');
  }
  if (/eggs?|poultry|hen|chicken/i.test(text)) types.add('eggs');
  if (/crops?|plant|vegetable|fruit|arable|grain|cereal|horticulture/i.test(text)) types.add('produce');
  if (/bee|honey|apicult/i.test(text)) types.add('honey');
  if (/wine|vineyard|vitis/i.test(text)) types.add('wine');
  if (/fish|aqua/i.test(text)) types.add('fish');

  // If no specific category matched, default to produce (most NL primary producers grow crops)
  if (types.size === 0) types.add('produce');

  return Array.from(types);
}

async function importToSupabase(operators: GeocodedOperator[]): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('Missing Supabase env vars in .env.local');

  const sb = createClient(supabaseUrl, serviceKey);

  // Load existing farms
  log('Loading existing farms for deduplication…');
  const existing: Array<{ osm_id: string; name: string | null; city: string | null; lat?: number | null; lng?: number | null }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('farms').select('osm_id, name, city').range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    existing.push(...data);
    if (data.length < 1000) break;
  }

  // Load coords via RPC
  try {
    const { data: coords } = await sb.rpc('get_farms_with_coords');
    if (coords) {
      const map = new Map<string, { lat: number; lng: number }>();
      for (const r of coords as { osm_id: string; lat: number; lng: number }[]) map.set(r.osm_id, r);
      for (const f of existing) { const c = map.get(f.osm_id); if (c) { f.lat = c.lat; f.lng = c.lng; } }
    }
  } catch { /* coords not available */ }

  const existingNameCity = new Set(
    existing.filter(e => e.name && e.city)
      .map(e => `${e.name!.toLowerCase().trim()}|${e.city!.toLowerCase().trim()}`)
  );
  const existingOsmIds = new Set(existing.map(e => e.osm_id));
  const withCoords = existing.filter(e => e.lat != null);

  log(`Existing farms: ${existing.length}`);

  let skipNoCoords = 0, skipNameCity = 0, skipLocation = 0, skipRerun = 0;
  const toInsert: Array<Record<string, unknown>> = [];

  for (const op of operators) {
    if (op.lat == null || op.lng == null) { skipNoCoords++; continue; }

    const osmId = `traces/${op.reference}`;
    if (existingOsmIds.has(osmId)) { skipRerun++; continue; }

    const ncKey = `${op.name.toLowerCase().trim()}|${(op.city ?? '').toLowerCase().trim()}`;
    if (existingNameCity.has(ncKey)) { skipNameCity++; continue; }

    const near = withCoords.some(e => {
      const dlat = Math.abs((e.lat ?? 0) - op.lat!);
      const dlng = Math.abs((e.lng ?? 0) - op.lng!);
      return dlat < 0.0009 && dlng < 0.00135; // ~100 m
    });
    if (near) { skipLocation++; continue; }

    const farmTypes = activitiesToFarmTypes(op.activities, op.categories);

    toInsert.push({
      name:         op.name,
      address:      op.street,
      city:         op.city,
      postal_code:  op.postal_code,
      country:      'NL',
      location:     `POINT(${op.lng} ${op.lat})`,
      farm_type:    farmTypes,
      source:       'traces',
      osm_id:       osmId,
      is_published: true,
      primary_tag:  'organic_certified',
      description:  `SKAL-gecertificeerd biologisch bedrijf (${op.reference}).${op.activities.length ? ' Activiteiten: ' + op.activities.join(', ') + '.' : ''}`,
    });
  }

  log('');
  log('── Deduplication ─────────────────────────────────────────────────────────');
  log(`  Total geocoded operators: ${operators.length}`);
  log(`  No coordinates:           ${skipNoCoords}`);
  log(`  Name+city duplicate:      ${skipNameCity}`);
  log(`  Location duplicate ≤100m: ${skipLocation}`);
  log(`  Already imported:         ${skipRerun}`);
  log(`  To insert:                ${toInsert.length}`);
  log('──────────────────────────────────────────────────────────────────────────');

  if (toInsert.length === 0) { log('Nothing new to insert.', 'warn'); return; }

  const BATCH = 100;
  let saved = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { error } = await sb.from('farms').upsert(batch, { onConflict: 'osm_id' });
    if (error) throw new Error(`Batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
    saved += batch.length;
    log(`  Upserted ${saved}/${toInsert.length}…`);
    await sleep(100);
  }

  const { count } = await sb.from('farms').select('*', { count: 'exact', head: true });
  log('');
  log('── Import complete ───────────────────────────────────────────────────────', 'ok');
  log(`  Inserted: ${saved}  |  Total in DB: ${count ?? '?'}`, 'ok');
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  const saveMode    = process.argv.includes('--save');
  const primaryOnly = !process.argv.includes('--all');  // default: filter for primary producers

  mkdirSync(OUT_DIR, { recursive: true });
  const SEP = '='.repeat(72);

  if (saveMode) {
    const path = join(OUT_DIR, 'geocoded_operators.json');
    if (!existsSync(path)) throw new Error('Run without --save first to generate geocoded_operators.json');
    const { operators } = JSON.parse(readFileSync(path, 'utf-8')) as { operators: GeocodedOperator[] };
    log(`Loaded ${operators.length} geocoded operators`);
    await importToSupabase(operators);
    return;
  }

  log(SEP);
  log('TRACES NT — NL Organic Operator Extractor');
  log('Source: EU public REST API (no auth required)');
  log(SEP);

  // ── Phase 1: Fetch ──────────────────────────────────────────────────────────
  const { operators: allOperators, total_raw } = await fetchAllOperators();

  saveJson('raw_operators.json', {
    extracted_at:  new Date().toISOString(),
    source:        TRACES_API,
    total_in_api:  total_raw,
    total_fetched: allOperators.length,
    operators:     allOperators,
  });

  // ── Phase 2: Filter ─────────────────────────────────────────────────────────
  const filtered = primaryOnly
    ? allOperators.filter(isPrimaryProducer)
    : allOperators;

  log('');
  log(`Total NL operators:      ${allOperators.length}`);
  log(`Primary producers:       ${allOperators.filter(isPrimaryProducer).length}`);
  log(`Processing:              ${filtered.length} (${primaryOnly ? 'primary producers only' : 'all'})`);

  // ── Phase 3: Geocode ────────────────────────────────────────────────────────
  log('');
  const geocoded = await geocodeAll(filtered);
  const withCoords = geocoded.filter(o => o.lat != null).length;

  saveJson('geocoded_operators.json', {
    geocoded_at:   new Date().toISOString(),
    filter:        primaryOnly ? 'primary_producers' : 'all',
    total:         geocoded.length,
    with_coords:   withCoords,
    operators:     geocoded,
  });

  // ── Report ───────────────────────────────────────────────────────────────────
  const actCounts: Record<string, number> = {};
  for (const op of allOperators) {
    for (const a of op.activities) actCounts[a] = (actCounts[a] ?? 0) + 1;
  }

  saveJson('extraction_report.json', {
    date:            new Date().toISOString(),
    source:          'TRACES NT (EU organic operator directory)',
    api_endpoint:    TRACES_API,
    legal_basis:     'Official EU public REST API — open government data (no scraping)',
    total_nl_api:    total_raw,
    total_fetched:   allOperators.length,
    primary_producers: allOperators.filter(isPrimaryProducer).length,
    geocoded_total:  geocoded.length,
    geocoded_success: withCoords,
    geocoded_rate:   `${Math.round(withCoords / (geocoded.length || 1) * 100)}%`,
    activities_breakdown: actCounts,
  });

  log('');
  log(SEP);
  log('Extraction complete!');
  log(`  NL operators fetched:    ${allOperators.length}`);
  log(`  Primary producers:       ${allOperators.filter(isPrimaryProducer).length}`);
  log(`  Geocoded (of ${filtered.length}): ${withCoords}`);
  log('');
  log('Next: npm run import:traces:save');
  log(SEP);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
