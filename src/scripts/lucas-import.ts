/**
 * EU LUCAS microdata import script
 *
 * Downloads the LUCAS (Land Use and Cover Area frame Survey) CSV for
 * Netherlands (NL) and Belgium (BE), maps land-use classification codes
 * to our farm categories, and saves to output/lucas-farms.json.
 *
 * LUCAS provides ~250 m grid sample points — not named individual farms.
 * Each point gets a generated name derived from its land-use type.
 * Points without agricultural land use are discarded.
 *
 * Usage:
 *   npx ts-node src/scripts/lucas-import.ts
 *   npx ts-node src/scripts/lucas-import.ts --save
 *   LUCAS_CSV=/path/to/lucas.csv npx ts-node src/scripts/lucas-import.ts
 *
 * LUCAS data sources (pick one):
 *   • Eurostat microdata: https://ec.europa.eu/eurostat/web/lucas/data/primary-data
 *   • JRC FTP (2018): https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/LUCAS/LUCAS-CORE-2018.zip
 *   • JRC FTP (2022): https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/LUCAS/LUCAS-CORE-2022.zip
 *
 * If automatic download fails, download manually, unzip, and set LUCAS_CSV.
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse as csvParse } from 'csv-parse';
import { createReadStream } from 'fs';
import AdmZip from 'adm-zip';
import { tmpdir } from 'os';

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
// Land-use code → farm_type mapping
//
// LU1 codes follow the LUCAS 2018/2022 nomenclature.
// Reference: https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/LUCAS/
// ---------------------------------------------------------------------------

type LUGroup = { categories: Category[]; label: string };

const LU_TO_FARM_TYPE: Record<string, LUGroup> = {
  // ── Arable crops ──────────────────────────────────────────────────────────
  U110: { categories: ['Produce'], label: 'Cereal / Grain farm' },
  U120: { categories: ['Produce'], label: 'Root & tuber farm' },
  U130: { categories: ['Produce'], label: 'Industrial crop farm' },
  U140: { categories: ['Produce'], label: 'Vegetable / salad farm' },
  U150: { categories: ['Produce'], label: 'Flower & horticultural farm' },
  U160: { categories: ['Produce'], label: 'Mixed field crop farm' },
  U170: { categories: ['Produce'], label: 'Fallow farmland' },

  // ── Permanent crops ───────────────────────────────────────────────────────
  U210: { categories: ['Produce'], label: 'Orchard / fruit farm' },
  U220: { categories: ['Wine'],    label: 'Vineyard' },
  U230: { categories: ['Produce'], label: 'Olive farm' },
  U240: { categories: ['Produce'], label: 'Permanent crop farm' },

  // ── Grassland / livestock ─────────────────────────────────────────────────
  U310: { categories: ['Dairy', 'Meat'], label: 'Grazed grassland farm' },
  U320: { categories: ['Dairy', 'Meat'], label: 'Agropastoral farm' },
  U330: { categories: ['Dairy', 'Meat'], label: 'Agrosilvopastoral farm' },

  // ── Aquaculture / fishing ─────────────────────────────────────────────────
  U510: { categories: ['Fish'], label: 'Fish farm / aquaculture' },
  U520: { categories: ['Fish'], label: 'Shellfish / aquaculture' },
  U530: { categories: ['Fish'], label: 'Algae / aquaculture' },
};

// Land-cover prefix fallback when LU1 is absent / unknown
const LC_PREFIX_TO_FARM_TYPE: Record<string, LUGroup> = {
  A: { categories: ['Produce'],         label: 'Cropland' },
  D: { categories: ['Dairy', 'Meat'],   label: 'Grassland farm' },
  F: { categories: ['Fish'],            label: 'Water / aquaculture' },
};

function getFarmTypeFromCodes(lu1: string, lc1: string): LUGroup | null {
  const lu = lu1.trim().toUpperCase();

  // 1. Exact LU1 match
  if (LU_TO_FARM_TYPE[lu]) return LU_TO_FARM_TYPE[lu];

  // 2. LU1 prefix match (e.g. U312 → U31 → U310 group → Dairy/Meat)
  //    The harmonised LUCAS uses 3-digit sub-codes; map them by 3-char prefix.
  if (lu.length >= 4) {
    const prefix3 = lu.slice(0, 3); // e.g. "U31"
    for (const [code, group] of Object.entries(LU_TO_FARM_TYPE)) {
      if (code.startsWith(prefix3)) return group;
    }
  }

  // 3. LC1 prefix fallback (A10, A22 … → 'A' → Produce)
  const lcPrefix = lc1.trim().toUpperCase().charAt(0);
  return LC_PREFIX_TO_FARM_TYPE[lcPrefix] ?? null;
}

// ---------------------------------------------------------------------------
// Column name normalisation
// LUCAS CSV headers vary across survey years; we handle common aliases.
// ---------------------------------------------------------------------------

interface LucasRow {
  // Identifiers
  point_id?: string;
  POINT_ID?: string;
  id?: string;
  // Country
  nuts0?: string;
  NUTS0?: string;
  // Theoretical coordinates (always available — the grid centroid)
  th_lat?: string;
  th_long?: string;
  TH_LAT?: string;
  TH_LONG?: string;
  // Car GPS (surveyor vehicle; 88.888888 = not visited)
  car_latitude?: string;
  car_longitude?: string;
  CAR_LATITUDE?: string;
  CAR_LONGITUDE?: string;
  // Field GPS (most accurate; also may be 88.888888)
  gps_lat?: string;
  gps_long?: string;
  GPS_LAT?: string;
  GPS_LONG?: string;
  // Land classification
  lu1?: string;
  LU1?: string;
  lc1?: string;
  LC1?: string;
  [key: string]: string | undefined;
}

const LUCAS_SENTINEL = 88.888888;

function col(row: LucasRow, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '') return row[k]!;
    if (row[k.toLowerCase()] !== undefined) return row[k.toLowerCase()]!;
    if (row[k.toUpperCase()] !== undefined) return row[k.toUpperCase()]!;
  }
  return '';
}

/**
 * Resolve the best available coordinate for a LUCAS row.
 * Priority: field GPS → car GPS → theoretical (grid centroid).
 * Filters out the LUCAS sentinel value 88.888888.
 */
function resolveCoords(row: LucasRow): { lat: number; lng: number } | null {
  const candidates = [
    // Field GPS — most precise
    [col(row, 'gps_lat'), col(row, 'gps_long')],
    // Car GPS — surveyor position
    [col(row, 'car_latitude'), col(row, 'car_longitude')],
    // Theoretical centroid — always present
    [col(row, 'th_lat'), col(row, 'th_long')],
  ];

  for (const [latStr, lngStr] of candidates) {
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (isNaN(lat) || isNaN(lng)) continue;
    if (Math.abs(lat - LUCAS_SENTINEL) < 0.001) continue; // sentinel
    if (lat === 0 && lng === 0) continue;
    return { lat, lng };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

function log(msg: string, level: 'info' | 'warn' | 'error' | 'success' = 'info') {
  const prefix = { info: '[INFO]', warn: '[WARN]', error: '[ERROR]', success: '[OK  ]' }[level];
  console.log(`${new Date().toISOString()} ${prefix} ${msg}`);
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Download helpers
// ---------------------------------------------------------------------------

// Known LUCAS data URLs in order of preference.
// Source: https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/LUCAS/LUCAS_harmonised/
const LUCAS_URLS: Array<{ url: string; type: 'zip' | 'csv' | 'auto' }> = [
  // Harmonised LUCAS 2018 survey table (~33 MB) — has car_latitude/car_longitude + LC1/LU1
  {
    url: 'https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/LUCAS/LUCAS_harmonised/1_table/lucas_harmo_uf_2018.zip',
    type: 'zip',
  },
  // Harmonised LUCAS all years (~128 MB) — larger but more complete
  {
    url: 'https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/LUCAS/LUCAS_harmonised/1_table/lucas_harmo_uf.zip',
    type: 'zip',
  },
  // GPS geometry only (~25 MB) — has coordinates but needs join for LC1/LU1
  {
    url: 'https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/LUCAS/LUCAS_harmonised/2_geometry/LUCAS_gps_geom.zip',
    type: 'zip',
  },
];

/** Download a file, returning { saved: true, isZip } or { saved: false }. */
async function downloadFile(
  url: string,
  dest: string,
  hintType: 'zip' | 'csv' | 'auto' = 'auto',
): Promise<{ saved: boolean; isZip: boolean }> {
  log(`Downloading: ${url}`);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Farmsy Research Bot 1.0' },
      signal: AbortSignal.timeout(300_000),
    });
    if (!res.ok) {
      log(`  HTTP ${res.status} — skipping`, 'warn');
      return { saved: false, isZip: false };
    }

    const ct = (res.headers.get('content-type') ?? '').toLowerCase();
    log(`  Content-Type: ${ct || '(none)'}`);

    // Buffer the response so we can inspect magic bytes
    const arrayBuf = await res.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);

    // ZIP magic bytes: PK\x03\x04
    const isZipMagic = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
    const isZipByType = ct.includes('zip') || ct.includes('octet-stream');

    let isZip: boolean;
    if (hintType === 'zip') {
      isZip = true;
    } else if (hintType === 'csv') {
      isZip = false;
    } else {
      isZip = isZipMagic || isZipByType;
    }

    if (!isZipMagic && isZip) {
      log('  File does not have ZIP magic bytes — treating as CSV/text', 'warn');
      isZip = false;
    }

    require('fs').writeFileSync(dest, Buffer.from(arrayBuf));
    log(`  Saved ${(bytes.length / 1e6).toFixed(1)} MB → ${dest} (isZip=${isZip})`, 'success');
    return { saved: true, isZip };
  } catch (err) {
    log(`  Download failed: ${(err as Error).message}`, 'warn');
    return { saved: false, isZip: false };
  }
}

/**
 * Find and extract the main CSV inside a ZIP.
 * Returns path to the extracted CSV, or null if not found.
 */
function extractCsvFromZip(zipPath: string, destDir: string): string | null {
  log(`Extracting ZIP: ${zipPath}`);
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  // Prefer the largest CSV (likely the main microdata file)
  const csvEntries = entries
    .filter((e: AdmZip.IZipEntry) => e.entryName.toLowerCase().endsWith('.csv'))
    .sort((a: AdmZip.IZipEntry, b: AdmZip.IZipEntry) => b.header.size - a.header.size);

  if (csvEntries.length === 0) {
    log('No CSV found in ZIP', 'error');
    return null;
  }

  const entry = csvEntries[0];
  const outPath = join(destDir, entry.name);
  log(`  Extracting ${entry.entryName} (${(entry.header.size / 1e6).toFixed(0)} MB)…`);
  zip.extractEntryTo(entry, destDir, false, true);
  log(`  Extracted → ${outPath}`, 'success');
  return outPath;
}

async function getLucasCsvPath(): Promise<string> {
  // 1. Environment variable override
  if (process.env.LUCAS_CSV && existsSync(process.env.LUCAS_CSV)) {
    log(`Using LUCAS_CSV from environment: ${process.env.LUCAS_CSV}`);
    return process.env.LUCAS_CSV;
  }

  // 2. Already cached
  const outDir = join(process.cwd(), 'output');
  mkdirSync(outDir, { recursive: true });
  const localCsv = join(outDir, 'lucas-raw.csv');
  if (existsSync(localCsv)) {
    log(`Found cached CSV: ${localCsv}`);
    return localCsv;
  }

  // 3. Try downloading from known URLs
  const tmpFile = join(tmpdir(), 'lucas-download.bin');
  for (const { url, type } of LUCAS_URLS) {
    const { saved, isZip } = await downloadFile(url, tmpFile, type);
    if (!saved) continue;

    if (isZip) {
      const csv = extractCsvFromZip(tmpFile, outDir);
      if (csv) {
        require('fs').renameSync(csv, localCsv);
        return localCsv;
      }
      log('  ZIP extracted no usable CSV — trying next URL', 'warn');
    } else {
      // It's a CSV/TSV — check it has at least a header row
      const preview = require('fs').readFileSync(tmpFile, 'utf-8').slice(0, 500);
      log(`  Preview: ${preview.split('\n')[0].slice(0, 120)}`);
      require('fs').renameSync(tmpFile, localCsv);
      return localCsv;
    }
  }

  throw new Error(
    'Could not download LUCAS data automatically.\n\n' +
    'Download manually from the JRC FTP (open in browser, right-click → Save As):\n' +
    '  https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/LUCAS/LUCAS_harmonised/1_table/lucas_harmo_uf_2018.zip\n\n' +
    'Unzip the archive, then set:\n' +
    '  $env:LUCAS_CSV="C:\\path\\to\\lucas_harmo_uf_2018.csv" ; npm run import:lucas\n' +
    '  # bash: LUCAS_CSV=/path/to/lucas_harmo_uf_2018.csv npm run import:lucas',
  );
}

// ---------------------------------------------------------------------------
// CSV streaming parser
// ---------------------------------------------------------------------------

async function parseLucasCsv(csvPath: string): Promise<FarmRecord[]> {
  log(`Parsing CSV: ${csvPath}`);

  const farms: FarmRecord[] = [];
  let processed = 0;
  let skipped = 0;

  const parser = createReadStream(csvPath).pipe(
    csvParse({
      columns: true,       // First row is header
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }),
  );

  for await (const row of parser as AsyncIterable<LucasRow>) {
    processed++;

    if (processed % 100_000 === 0) {
      log(`  Processed ${processed.toLocaleString()} rows, ${farms.length.toLocaleString()} kept…`);
    }

    // Filter by country
    const nuts0 = col(row, 'nuts0', 'NUTS0', 'COUNTRY').toUpperCase();
    if (nuts0 !== 'NL' && nuts0 !== 'BE') { skipped++; continue; }

    // Resolve best available coordinates (GPS → car → theoretical)
    const coords = resolveCoords(row);
    if (!coords) { skipped++; continue; }

    const lu1 = col(row, 'lu1', 'LU1', 'LANDUSE1', 'land_use_1');
    const lc1 = col(row, 'lc1', 'LC1', 'LANDCOVER1', 'land_cover_1');

    const group = getFarmTypeFromCodes(lu1, lc1);
    if (!group) { skipped++; continue; }

    const pointId = col(row, 'point_id', 'POINT_ID', 'id', 'ID') || String(processed);

    farms.push({
      name: `${group.label} (LUCAS ${pointId})`,
      address: null,
      city: null,
      postal_code: null,
      country: nuts0,
      latitude: coords.lat,
      longitude: coords.lng,
      location: `POINT(${coords.lng} ${coords.lat})`,
      farm_type: group.categories,
      website: null,
      phone: null,
      email: null,
      description:
        `LUCAS survey point ${pointId}. Land use: ${lu1 || 'N/A'}, Land cover: ${lc1 || 'N/A'}.`,
      image: null,
      source: 'lucas',
      osm_id: `lucas/${pointId}`,
      is_published: true,
      primary_tag: lu1 || lc1 || null,
    });
  }

  log(`Parsing complete: ${processed.toLocaleString()} rows, kept ${farms.length.toLocaleString()}, skipped ${skipped.toLocaleString()}`, 'success');
  return farms;
}

// ---------------------------------------------------------------------------
// JSON output
// ---------------------------------------------------------------------------

function saveFarmsToJSON(farms: FarmRecord[]): string {
  const outputDir = join(process.cwd(), 'output');
  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, 'lucas-farms.json');

  const byCategory: Record<string, number> = {};
  const byCountry: Record<string, number> = {};
  for (const f of farms) {
    for (const c of f.farm_type) byCategory[c] = (byCategory[c] ?? 0) + 1;
    byCountry[f.country] = (byCountry[f.country] ?? 0) + 1;
  }

  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        metadata: {
          source: 'lucas',
          fetchedAt: new Date().toISOString(),
          totalRecords: farms.length,
          byCountry,
          byCategory,
          note:
            'LUCAS points are 250 m survey samples, not named farms. ' +
            'farm_type is an array; when inserting into the current text column, ' +
            'use farm_type[0] or farm_type.join(",").',
        },
        farms,
      },
      null,
      2,
    ),
  );

  log(`Saved ${farms.length.toLocaleString()} records → ${outputPath}`, 'success');
  return outputPath;
}

// ---------------------------------------------------------------------------
// Supabase import (--save mode)
// ---------------------------------------------------------------------------

async function saveToSupabase(farms: FarmRecord[]): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const BATCH = 200;
  let saved = 0;

  for (let i = 0; i < farms.length; i += BATCH) {
    const batch = farms.slice(i, i + BATCH).map((f) => ({
      ...f,
      farm_type: f.farm_type.length > 0 ? f.farm_type[0] : null,
      latitude: undefined,
      longitude: undefined,
    }));

    const { error } = await supabase
      .from('farms')
      .upsert(batch, { onConflict: 'osm_id', ignoreDuplicates: false });

    if (error) throw new Error(`Batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
    saved += batch.length;

    if (saved % 10_000 === 0 || saved === farms.length) {
      log(`  Upserted ${saved.toLocaleString()}/${farms.length.toLocaleString()}`, 'success');
    }
    await sleep(50);
  }

  log(`Done — ${saved.toLocaleString()} LUCAS farms saved to Supabase`, 'success');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const saveMode = process.argv.includes('--save');

  if (saveMode) {
    const jsonPath = join(process.cwd(), 'output', 'lucas-farms.json');
    if (!existsSync(jsonPath)) throw new Error('Run without --save first to fetch/parse data.');
    const { farms } = JSON.parse(readFileSync(jsonPath, 'utf-8')) as { farms: FarmRecord[] };
    log(`Loaded ${farms.length.toLocaleString()} farms from JSON`);
    await saveToSupabase(farms);
    return;
  }

  log('='.repeat(72));
  log('LUCAS EU Land-Use Dataset — NL + BE agricultural points');
  log('='.repeat(72));

  const csvPath = await getLucasCsvPath();
  const farms = await parseLucasCsv(csvPath);

  if (farms.length === 0) {
    log('No agricultural points found for NL/BE — check column names in the CSV.', 'warn');
    return;
  }

  saveFarmsToJSON(farms);

  log('');
  log('Run with --save to import into Supabase.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}

export { parseLucasCsv, getFarmTypeFromCodes, saveFarmsToJSON };
