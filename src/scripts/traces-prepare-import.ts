/**
 * traces-prepare-import.ts
 *
 * Phases 2–6 of the TRACES import pipeline:
 *   2. Filter 2,193 primary producers → consumer food farms
 *   3. Map TRACES categories → farm_type
 *   4. Deduplicate against existing DB
 *   5. Prepare import records
 *   6. Generate: traces_import_ready.csv, traces_duplicates.json, traces_import_report.json
 *
 * Usage:
 *   npx ts-node -P tsconfig.scripts.json src/scripts/traces-prepare-import.ts
 *
 * Reads:  output/traces/geocoded_operators.json
 * Writes: data/traces_import_ready.csv
 *         data/traces_duplicates.json
 *         data/traces_import_report.json
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ─── Config ───────────────────────────────────────────────────────────────────

const GEOCODED_PATH = join(process.cwd(), 'output', 'traces', 'geocoded_operators.json');
const OUT_DIR       = join(process.cwd(), 'data');

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeocodedOperator {
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
  lat:               number | null;
  lng:               number | null;
  geocode_query:     string | null;
}

interface ImportRecord {
  osm_id:                   string;
  name:                     string;
  address:                  string | null;
  city:                     string | null;
  postal_code:              string | null;
  country:                  string;
  lat:                      number;
  lng:                      number;
  farm_type:                string[];
  source:                   string;
  certification:            string;
  certification_authority:  string;
  is_certified_organic:     boolean;
  needs_enrichment:         boolean;
  traces_reference:         string;
  traces_categories:        string;
  traces_activities:        string;
}

interface DuplicateRecord {
  reference:    string;
  name:         string;
  city:         string | null;
  postal_code:  string | null;
  reason:       'name_city' | 'location_100m' | 'fuzzy_name_postal';
  matched_osm_id: string;
  matched_name:   string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`${new Date().toISOString().slice(11, 19)} ${msg}`);
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Simple Levenshtein distance (early exit if > threshold)
function levenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], row[j], prev) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

// Bounding box ~100m at NL latitude
function withinBbox(lat1: number, lng1: number, lat2: number, lng2: number): boolean {
  return Math.abs(lat1 - lat2) < 0.0009 && Math.abs(lng1 - lng2) < 0.00135;
}

// ─── Phase 2: Filter consumer food farms ─────────────────────────────────────

const CONSUMER_CATEGORIES = new Set([
  'Livestock and unprocessed livestock products',
  'Unprocessed plants and plant products, including seeds and other plant reproductive material',
  'Wine',
  'Algae and unprocessed aquaculture products',
  'Other products listed in Annex I to Regulation (EU) 2018/848 or not covered by the previous categories',
]);

const EXCLUDE_ONLY_CATEGORIES = new Set([
  'Feed',
  // If ALL categories are feed/seeds only, exclude
]);

function isConsumerFoodFarm(op: GeocodedOperator): boolean {
  // Must have Production activity
  if (!op.activities.includes('Production')) return false;
  // Must have at least one consumer-facing category
  const hasConsumer = op.categories.some(c => CONSUMER_CATEGORIES.has(c));
  if (!hasConsumer) return false;
  // Exclude if ONLY has Feed category (animal feed producers)
  const onlyFeed = op.categories.length > 0 && op.categories.every(c => c === 'Feed');
  return !onlyFeed;
}

// ─── Phase 3: Map categories → farm_type ─────────────────────────────────────

function mapToFarmTypes(op: GeocodedOperator): string[] {
  // TRACES categories represent what an operator is CERTIFIED to handle, not what
  // they actually produce. In NL, "Wine" and "Algae" appear as blanket cert categories
  // alongside all other product groups — not as specific product indicators.
  // All TRACES primary producers get tagged as 'organic' only.
  // Specific sub-types (dairy, meat, etc.) will be assigned during Google enrichment.
  void op; // op available for future per-name heuristics if needed
  return ['organic'];
}

// ─── Phase 4: Deduplicate against existing DB ─────────────────────────────────

interface ExistingFarm {
  osm_id:      string;
  name:        string | null;
  city:        string | null;
  postal_code: string | null;
  lat:         number | null;
  lng:         number | null;
}

async function loadExistingFarms(): Promise<ExistingFarm[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    log('WARN: No Supabase creds — deduplication will be name+city only (no coord check)');
    return [];
  }

  const sb = createClient(supabaseUrl, serviceKey);
  const all: ExistingFarm[] = [];

  log('Loading existing farms from database…');
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('farms').select('osm_id, name, city, postal_code').range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    for (const row of data) all.push({ ...row, lat: null, lng: null });
    if (data.length < 1000) break;
  }

  // Load coords
  try {
    const { data: coords } = await sb.rpc('get_farms_with_coords');
    if (coords) {
      const map = new Map<string, { lat: number; lng: number }>();
      for (const r of coords as { osm_id: string; lat: number; lng: number }[]) map.set(r.osm_id, r);
      for (const f of all) { const c = map.get(f.osm_id); if (c) { f.lat = c.lat; f.lng = c.lng; } }
    }
  } catch { /* no coords */ }

  log(`Loaded ${all.length} existing farms (${all.filter(f => f.lat != null).length} with coords)`);
  return all;
}

// ─── Phase 5 & 6: Prepare records + CSV ───────────────────────────────────────

function toCsvRow(record: ImportRecord): string {
  const escape = (v: string | null | boolean | number): string => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  return [
    escape(record.osm_id),
    escape(record.name),
    escape(record.address),
    escape(record.city),
    escape(record.postal_code),
    escape(record.country),
    escape(record.lat),
    escape(record.lng),
    escape(record.farm_type.join('|')),
    escape(record.source),
    escape(record.certification),
    escape(record.certification_authority),
    escape(record.is_certified_organic),
    escape(record.needs_enrichment),
    escape(record.traces_reference),
    escape(record.traces_categories),
    escape(record.traces_activities),
  ].join(',');
}

const CSV_HEADER = [
  'osm_id', 'name', 'address', 'city', 'postal_code', 'country',
  'lat', 'lng', 'farm_type', 'source', 'certification',
  'certification_authority', 'is_certified_organic', 'needs_enrichment',
  'traces_reference', 'traces_categories', 'traces_activities',
].join(',');

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  log('='.repeat(68));
  log('TRACES Import Preparation — Phases 2-6');
  log('='.repeat(68));

  // ── Load geocoded data ────────────────────────────────────────────────────
  const rawData = JSON.parse(readFileSync(GEOCODED_PATH, 'utf-8')) as {
    operators: GeocodedOperator[];
    total:     number;
  };
  const allOperators = rawData.operators;
  log(`Loaded ${allOperators.length} operators from geocoded file`);

  // ── Phase 2: Filter primary producers → consumer farms ───────────────────
  log('');
  log('── Phase 2: Filtering consumer food farms ───────────────────────────────');

  const producers = allOperators.filter(op => op.activities.includes('Production'));
  log(`  Primary producers (has "Production" activity): ${producers.length}`);

  const consumerFarms = producers.filter(isConsumerFoodFarm);
  const excluded = producers.length - consumerFarms.length;
  log(`  Consumer food farms (after category filter):   ${consumerFarms.length}`);
  log(`  Excluded (feed-only / no consumer categories): ${excluded}`);

  // Count category breakdown of consumer farms
  const catCounts: Record<string, number> = {};
  for (const op of consumerFarms) {
    for (const c of op.categories) catCounts[c] = (catCounts[c] ?? 0) + 1;
  }
  log('  Category breakdown:');
  for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
    log(`    ${count.toString().padStart(4)} × ${cat}`);
  }

  // ── Phase 3: Map to farm_type ────────────────────────────────────────────
  log('');
  log('── Phase 3: Mapping farm types ──────────────────────────────────────────');

  const typeGroups: Record<string, number> = {};
  for (const op of consumerFarms) {
    const types = mapToFarmTypes(op);
    const key = types.join('+');
    typeGroups[key] = (typeGroups[key] ?? 0) + 1;
  }
  for (const [types, count] of Object.entries(typeGroups).sort((a, b) => b[1] - a[1])) {
    log(`  ${count.toString().padStart(5)} × [${types}]`);
  }

  // ── Phase 4: Load existing farms + deduplicate ───────────────────────────
  log('');
  log('── Phase 4: Deduplication ───────────────────────────────────────────────');

  const existing = await loadExistingFarms();
  const existingNameCity = new Map<string, ExistingFarm>(); // key → farm
  const existingPostalName = new Map<string, ExistingFarm>(); // key → farm
  for (const f of existing) {
    if (f.name && f.city) {
      existingNameCity.set(`${normalize(f.name)}|${normalize(f.city)}`, f);
    }
    if (f.name && f.postal_code) {
      existingPostalName.set(`${normalize(f.name)}|${f.postal_code}`, f);
    }
  }
  const withCoords = existing.filter(f => f.lat != null);

  const toImport:    ImportRecord[]    = [];
  const duplicates:  DuplicateRecord[] = [];
  const fuzzyFlags:  DuplicateRecord[] = [];

  let dupExact = 0, dupCoord = 0, dupFuzzy = 0;

  for (const op of consumerFarms) {
    if (op.lat == null || op.lng == null) continue; // already geocoded — all should have coords

    const osmId  = `traces/${op.reference}`;
    const normName = normalize(op.name);
    const normCity = normalize(op.city ?? '');

    // ── Check 1: exact name + city ──────────────────────────────────────────
    const ncKey  = `${normName}|${normCity}`;
    const ncMatch = existingNameCity.get(ncKey);
    if (ncMatch) {
      duplicates.push({ reference: op.reference, name: op.name, city: op.city, postal_code: op.postal_code,
        reason: 'name_city', matched_osm_id: ncMatch.osm_id, matched_name: ncMatch.name ?? '' });
      dupExact++;
      continue;
    }

    // ── Check 2: coordinate within 100 m ───────────────────────────────────
    const coordMatch = withCoords.find(f => withinBbox(op.lat!, op.lng!, f.lat!, f.lng!));
    if (coordMatch) {
      duplicates.push({ reference: op.reference, name: op.name, city: op.city, postal_code: op.postal_code,
        reason: 'location_100m', matched_osm_id: coordMatch.osm_id, matched_name: coordMatch.name ?? '' });
      dupCoord++;
      continue;
    }

    // ── Check 3: fuzzy name + same postal code ──────────────────────────────
    const postalKey = `${op.postal_code}`;
    let isFuzzyDup = false;
    if (op.postal_code) {
      for (const [key, f] of existingPostalName) {
        if (!key.endsWith(`|${postalKey}`)) continue;
        const existingNorm = key.split('|')[0];
        const dist = levenshtein(normName, existingNorm, 3);
        if (dist < 3 && dist > 0) {
          fuzzyFlags.push({ reference: op.reference, name: op.name, city: op.city, postal_code: op.postal_code,
            reason: 'fuzzy_name_postal', matched_osm_id: f.osm_id, matched_name: f.name ?? '' });
          isFuzzyDup = true;
          dupFuzzy++;
          break;
        }
      }
    }
    if (isFuzzyDup) continue;

    // ── New farm ────────────────────────────────────────────────────────────
    toImport.push({
      osm_id:                  osmId,
      name:                    op.name,
      address:                 op.street,
      city:                    op.city,
      postal_code:             op.postal_code,
      country:                 'NL',
      lat:                     op.lat,
      lng:                     op.lng,
      farm_type:               mapToFarmTypes(op),
      source:                  'traces',
      certification:           'organic',
      certification_authority: 'SKAL',
      is_certified_organic:    true,
      needs_enrichment:        true,
      traces_reference:        op.reference,
      traces_categories:       op.categories.join('; '),
      traces_activities:       op.activities.join('; '),
    });
  }

  log(`  Exact name+city duplicates:    ${dupExact}`);
  log(`  Location duplicates (≤100m):   ${dupCoord}`);
  log(`  Fuzzy name+postal (review):    ${dupFuzzy}`);
  log(`  New farms to import:           ${toImport.length}`);

  // ── Phase 6: Generate output files ───────────────────────────────────────
  log('');
  log('── Phase 6: Writing output files ────────────────────────────────────────');
  mkdirSync(OUT_DIR, { recursive: true });

  // CSV
  const csvLines = [CSV_HEADER, ...toImport.map(toCsvRow)];
  const csvPath  = join(OUT_DIR, 'traces_import_ready.csv');
  writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');
  log(`  CSV (${toImport.length} farms)  → ${csvPath}`);

  // Duplicates JSON
  const dupPath = join(OUT_DIR, 'traces_duplicates.json');
  writeFileSync(dupPath, JSON.stringify({
    total_exact:   dupExact,
    total_coord:   dupCoord,
    total_fuzzy:   dupFuzzy,
    exact_and_coord: duplicates,
    fuzzy_for_review: fuzzyFlags,
  }, null, 2), 'utf-8');
  log(`  Duplicates log                → ${dupPath}`);

  // Province breakdown (best-effort from postal code ranges)
  const provinceCodes: Record<string, string> = {
    '1': 'Noord-Holland', '2': 'Zuid-Holland', '3': 'Utrecht',
    '4': 'Zeeland/Noord-Brabant', '5': 'Noord-Brabant', '6': 'Limburg',
    '7': 'Overijssel/Gelderland', '8': 'Overijssel/Flevoland', '9': 'Drenthe/Groningen/Friesland',
  };
  const provinceCounts: Record<string, number> = {};
  for (const op of toImport) {
    if (op.postal_code) {
      const prov = provinceCodes[op.postal_code[0]] ?? 'Unknown';
      provinceCounts[prov] = (provinceCounts[prov] ?? 0) + 1;
    }
  }

  const uniqueCities = new Set(toImport.map(o => o.city).filter(Boolean)).size;

  // farm_type breakdown
  const ftBreakdown: Record<string, number> = {};
  for (const op of toImport) {
    const key = op.farm_type.join('+');
    ftBreakdown[key] = (ftBreakdown[key] ?? 0) + 1;
  }

  // Report JSON
  const report = {
    extraction_date:     new Date().toISOString().slice(0, 10),
    source:              'TRACES EU Database (via public REST API)',
    legal_basis:         'Official EU government open data — no ToS violation',
    total_traces_records: allOperators.length,
    primary_producers:   producers.length,
    consumer_food_farms: consumerFarms.length,
    excluded_feed_only:  excluded,
    duplicates_found:    dupExact + dupCoord + dupFuzzy,
    exact_duplicates:    dupExact,
    location_duplicates: dupCoord,
    fuzzy_matches_review: dupFuzzy,
    new_farms_to_import: toImport.length,
    category_breakdown: ftBreakdown,
    geographic_coverage: {
      provinces: provinceCounts,
      unique_cities: uniqueCities,
    },
    data_quality: {
      with_coordinates:         '100%',
      needs_contact_enrichment: '100%',
      needs_hours_enrichment:   '100%',
    },
    existing_db_farms:  existing.length,
    projected_db_total: existing.length + toImport.length,
    growth_pct:         Math.round(toImport.length / (existing.length || 1) * 100),
    next_steps: [
      `Review data/traces_duplicates.json fuzzy matches (${dupFuzzy} entries)`,
      'Run: npx ts-node -P tsconfig.scripts.json src/scripts/traces-prepare-import.ts --import',
      'Enrich with Google Places for contact info & opening hours',
      'Add TRACES Phase 2: enrichment after farms are claimed',
    ],
  };

  const reportPath = join(OUT_DIR, 'traces_import_report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  log(`  Report                        → ${reportPath}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const SEP = '='.repeat(68);
  log('');
  log(SEP);
  log('RESULTS SUMMARY');
  log(SEP);
  log(`  Total NL in TRACES:     ${allOperators.length.toLocaleString()}`);
  log(`  Primary producers:      ${producers.length.toLocaleString()}`);
  log(`  Consumer food farms:    ${consumerFarms.length.toLocaleString()}`);
  log(`  Exact duplicates:       ${dupExact}`);
  log(`  Location duplicates:    ${dupCoord}`);
  log(`  Fuzzy (manual review):  ${dupFuzzy}`);
  log(`  NEW farms to import:    ${toImport.length.toLocaleString()}`);
  log(`  Current DB size:        ${existing.length.toLocaleString()}`);
  log(`  Projected DB total:     ${(existing.length + toImport.length).toLocaleString()}`);
  log(`  Growth:                 +${report.growth_pct}%`);
  log('');
  log('Category breakdown:');
  for (const [type, count] of Object.entries(ftBreakdown).sort((a, b) => b[1] - a[1])) {
    log(`  ${count.toString().padStart(5)} × [${type}]`);
  }
  log(SEP);
  log('Import files ready — waiting for approval before DB insert.');
  log(`Review: data/traces_import_report.json`);
  log(SEP);
}

main().catch(err => { console.error(err); process.exitCode = 1; });
