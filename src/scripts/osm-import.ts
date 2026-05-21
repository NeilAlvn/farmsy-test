// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Create Supabase client with service role key for server-side imports (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configuration
const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const BATCH_SIZE = 100;

// Each entry is a named query with one or more AND-combined OSM filters.
interface TagQuery {
  label: string
  filters: Array<{ key: string; value: string }>
}

const FARM_QUERIES: TagQuery[] = [
  { label: 'shop=farm',           filters: [{ key: 'shop',    value: 'farm'           }] },
  { label: 'shop=dairy',          filters: [{ key: 'shop',    value: 'dairy'          }] },
  { label: 'shop=cheese',         filters: [{ key: 'shop',    value: 'cheese'         }] },
  { label: 'craft=beekeeper',     filters: [{ key: 'craft',   value: 'beekeeper'      }] },
  { label: 'shop=honey',          filters: [{ key: 'shop',    value: 'honey'          }] },
  { label: 'vending=eggs',        filters: [{ key: 'vending', value: 'eggs'           }] },
  { label: 'vending=milk',        filters: [{ key: 'vending', value: 'milk'           }] },
  { label: 'tourism=wine_cellar', filters: [{ key: 'tourism', value: 'wine_cellar'    }] },
  { label: 'amenity=marketplace', filters: [{ key: 'amenity', value: 'marketplace'    }] },
  { label: 'craft=cheesemaker',   filters: [{ key: 'craft',   value: 'cheesemaker'    }] },
  // Farm butchers / bakeries only (farm_shop=yes filters out regular shops)
  { label: 'shop=butcher (farm)', filters: [{ key: 'shop', value: 'butcher' }, { key: 'farm_shop',   value: 'yes' }] },
  { label: 'shop=bakery (farm)',  filters: [{ key: 'shop', value: 'bakery'  }, { key: 'farm_shop',   value: 'yes' }] },
  // Meat — broader tags actually used in NL/BE
  { label: 'craft=butcher',       filters: [{ key: 'craft', value: 'butcher'     }] },
  { label: 'shop=butcher (direct_sale)', filters: [{ key: 'shop', value: 'butcher' }, { key: 'direct_sale', value: 'yes' }] },
  { label: 'shop=poultry',        filters: [{ key: 'shop',  value: 'poultry'     }] },
  { label: 'vending=meat',        filters: [{ key: 'vending', value: 'meat'      }] },
  { label: 'vending=sausage',     filters: [{ key: 'vending', value: 'sausage'   }] },
  // Fish
  { label: 'shop=fish',           filters: [{ key: 'shop',  value: 'fish'        }] },
  { label: 'craft=fish_farm',     filters: [{ key: 'craft', value: 'fish_farm'   }] },
];

interface OSMElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: {
    name?: string;
    'addr:street'?: string;
    'addr:housenumber'?: string;
    'addr:city'?: string;
    'addr:postcode'?: string;
    'addr:country'?: string;
    website?: string;
    phone?: string;
    'contact:website'?: string;
    'contact:phone'?: string;
    [key: string]: string | undefined;
  };
}

interface OSMResponse {
  version: number;
  generator: string;
  elements: OSMElement[];
}

interface ImportStats {
  totalFetched: number;
  totalSaved: number;
  totalErrors: number;
  totalSkipped: number;
  byCountry: {
    NL: number;
    BE: number;
  };
  byTag: {
    [key: string]: number;
  };
}

/**
 * Helper function to format elapsed time
 */
function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Helper function to log with timestamp
 */
function log(message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '[INFO]',
    warn: '[WARN]',
    error: '[ERROR]',
    success: '[SUCCESS]',
  }[level];

  console.log(`${timestamp} ${prefix} ${message}`);
}

/**
 * Sleep helper for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build Overpass QL query for farms in Netherlands and Belgium
 */
function buildOverpassQuery(): string {
  const countries = ['NL', 'BE'];

  let query = '[out:json][timeout:300];\n';

  for (let i = 0; i < countries.length; i++) {
    const countryCode = countries[i];
    const areaName = `searchArea${i}`;

    // Define the search area by ISO country code
    query += `area["ISO3166-1"="${countryCode}"][admin_level=2]->.${areaName};\n`;
  }

  query += '\n(\n';

  // Query each tag for each country
  for (let i = 0; i < countries.length; i++) {
    const areaName = `searchArea${i}`;

    for (const q of FARM_QUERIES) {
      const filterStr = q.filters.map(f => `["${f.key}"="${f.value}"]`).join('');
      query += `  node${filterStr}(area.${areaName});\n`;
      query += `  way${filterStr}(area.${areaName});\n`;
      query += `  relation${filterStr}(area.${areaName});\n`;
    }
  }

  query += ');\n\nout center;';

  return query;
}

/**
 * Fetch data from Overpass API with retry logic
 */
async function fetchFromOverpass(): Promise<OSMResponse> {
  const query = buildOverpassQuery();

  log('Fetching farms from OpenStreetMap via Overpass API...');
  log(`Query tags: ${FARM_QUERIES.map(q => q.label).join(', ')}`);
  log(`Countries: Netherlands, Belgium`);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      log(`Attempt ${attempt}/${MAX_RETRIES}: Sending query to Overpass API...`);

      const response = await fetch(OVERPASS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'De Lokale Boer Import Script',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        throw new Error(
          `Overpass API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json() as OSMResponse;
      log(`Successfully fetched ${data.elements.length} elements from OSM`, 'success');
      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      log(
        `Attempt ${attempt}/${MAX_RETRIES} failed: ${lastError.message}`,
        'warn'
      );

      if (attempt < MAX_RETRIES) {
        log(`Retrying in ${RETRY_DELAY_MS}ms...`, 'info');
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  log(`All ${MAX_RETRIES} attempts failed to fetch from Overpass API`, 'error');
  throw lastError || new Error('Unknown error occurred');
}

/**
 * Determine country from OSM element
 */
function getCountry(element: OSMElement): string {
  // First check addr:country tag
  if (element.tags?.['addr:country']) {
    const country = element.tags['addr:country'].toUpperCase();
    if (country === 'NL' || country === 'BE') {
      return country;
    }
  }

  // Fallback: use coordinates to determine country
  // Netherlands: roughly 50.7-53.5N, 3.3-7.2E
  // Belgium: roughly 49.5-51.5N, 2.5-6.4E
  const lat = element.lat || element.center?.lat;
  const lon = element.lon || element.center?.lon;

  if (lat && lon) {
    // Simple heuristic: if latitude > 51.5, likely Netherlands
    if (lat > 51.5 && lon > 3.3 && lon < 7.2) {
      return 'NL';
    } else if (lat >= 49.5 && lat <= 51.5 && lon >= 2.5 && lon <= 6.4) {
      return 'BE';
    }
  }

  // Default to NL if uncertain
  return 'NL';
}

/**
 * Map an OSM element to a product category stored in farm_type.
 * Falls back to inferring from the produce/product tag.
 */
function getFarmCategory(primaryTag: string | null, tags: Record<string, string | undefined>): string[] | null {
  const tagToCategory: Record<string, string> = {
    'shop=farm':             'produce',
    'shop=dairy':            'dairy',
    'shop=cheese':           'cheese',
    'craft=beekeeper':       'produce',
    'shop=honey':            'produce',
    'vending=eggs':          'eggs',
    'vending=milk':          'dairy',
    'tourism=wine_cellar':   'wine',
    'amenity=marketplace':   'markets',
    'craft=cheesemaker':     'cheese',
    'shop=butcher (farm)':          'meat',
    'shop=bakery (farm)':           'produce',
    'craft=butcher':                'meat',
    'shop=butcher (direct_sale)':   'meat',
    'shop=poultry':                 'meat',
    'vending=meat':                 'meat',
    'vending=sausage':              'meat',
    'shop=fish':                    'fish',
    'craft=fish_farm':              'fish',
  };

  if (primaryTag && tagToCategory[primaryTag]) {
    return [tagToCategory[primaryTag]];
  }

  // Infer from the produce / product free-text tag
  const produce = (tags.produce || tags.product || '').toLowerCase();
  if (!produce) return null;

  if (/\begg|eier|eieren/.test(produce))           return ['eggs'];
  if (/\bmilk|dairy|melk|zuivel/.test(produce))    return ['dairy'];
  if (/\bmeat|vlees|beef|pork|chicken/.test(produce)) return ['meat'];
  if (/\bfish|\bvis\b|seafood|zeevruchten/.test(produce)) return ['fish'];
  if (/\bcheese|kaas/.test(produce))               return ['cheese'];
  if (/\bwine|wijn/.test(produce))                 return ['wine'];
  if (/vegetable|groente|fruit|produce/.test(produce)) return ['produce'];

  return null;
}

/**
 * Get primary farm tag from OSM element
 */
function getPrimaryFarmTag(element: OSMElement): string | null {
  const tags = element.tags || {};

  // Check in priority order (matches FARM_QUERIES)
  if (tags['shop'] === 'farm') return 'shop=farm';
  if (tags['shop'] === 'dairy') return 'shop=dairy';
  if (tags['shop'] === 'cheese') return 'shop=cheese';
  if (tags['craft'] === 'beekeeper') return 'craft=beekeeper';
  if (tags['shop'] === 'honey') return 'shop=honey';
  if (tags['vending'] === 'eggs') return 'vending=eggs';
  if (tags['vending'] === 'milk') return 'vending=milk';
  if (tags['tourism'] === 'wine_cellar') return 'tourism=wine_cellar';
  if (tags['amenity'] === 'marketplace') return 'amenity=marketplace';
  if (tags['craft'] === 'cheesemaker') return 'craft=cheesemaker';
  if (tags['shop'] === 'butcher' && tags['farm_shop']   === 'yes') return 'shop=butcher (farm)';
  if (tags['shop'] === 'bakery'  && tags['farm_shop']   === 'yes') return 'shop=bakery (farm)';
  if (tags['craft'] === 'butcher')                                  return 'craft=butcher';
  if (tags['shop'] === 'butcher' && tags['direct_sale'] === 'yes') return 'shop=butcher (direct_sale)';
  if (tags['shop'] === 'poultry')                                   return 'shop=poultry';
  if (tags['vending'] === 'meat')                                   return 'vending=meat';
  if (tags['vending'] === 'sausage')                                return 'vending=sausage';
  if (tags['shop'] === 'fish')                                      return 'shop=fish';
  if (tags['craft'] === 'fish_farm')                                return 'craft=fish_farm';

  return null;
}

/**
 * Transform OSM element to farm record
 */
function transformToFarmRecord(element: OSMElement) {
  const tags = element.tags || {};

  // Get coordinates (nodes have lat/lon, ways/relations have center)
  const lat = element.lat || element.center?.lat;
  const lon = element.lon || element.center?.lon;

  if (!lat || !lon) return null;
  if (!tags.name) return null;

  // Build address from components
  let address = null;
  if (tags['addr:street'] || tags['addr:housenumber']) {
    const street = tags['addr:street'] || '';
    const housenumber = tags['addr:housenumber'] || '';
    address = `${street} ${housenumber}`.trim() || null;
  }

  // Get website (prefer website tag, fallback to contact:website)
  const website = tags.website || tags['contact:website'] || null;

  // Get phone (prefer phone tag, fallback to contact:phone)
  const phone = tags.phone || tags['contact:phone'] || null;

  // Determine country
  const country = getCountry(element);

  // Get primary tag
  const primaryTag = getPrimaryFarmTag(element);

  return {
    name: tags.name,
    address: address,
    city: tags['addr:city'] || null,
    postal_code: tags['addr:postcode'] || null,
    country: country,
    location: `POINT(${lon} ${lat})`,
    website: website,
    phone: phone,
    email: tags.email || tags['contact:email'] || null,
    opening_hours: tags['opening_hours'] || null,
    description: tags.description || null,
    facebook: tags['contact:facebook'] || tags.facebook || null,
    instagram: tags['contact:instagram'] || tags.instagram || null,
    organic: tags.organic || null,
    produce: tags.produce || tags.product || null,
    image: tags.image || null,
    operator: tags.operator || null,
    source: 'osm',
    osm_id: `${element.type}/${element.id}`,
    farm_type: getFarmCategory(primaryTag, tags),
    is_published: true,
    primary_tag: primaryTag,
  };
}

/**
 * Save farms to Supabase in batches
 */
async function saveFarmsInBatches(farms: ReturnType<typeof transformToFarmRecord>[]): Promise<number> {
  // Filter out null records
  const validFarms = farms.filter(farm => farm !== null);

  if (validFarms.length === 0) {
    log('No valid farms to save, skipping database operation', 'warn');
    return 0;
  }

  log(`Saving ${validFarms.length} farms to database in batches of ${BATCH_SIZE}...`);

  let totalSaved = 0;
  const batches = Math.ceil(validFarms.length / BATCH_SIZE);

  for (let i = 0; i < batches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, validFarms.length);
    const batch = validFarms.slice(start, end);

    try {
      log(`Processing batch ${i + 1}/${batches} (${batch.length} records)...`);

      const { data, error } = await supabase
        .from('farms')
        .upsert(batch, {
          onConflict: 'osm_id',
          ignoreDuplicates: false,
        })
        .select();

      if (error) {
        log(`Database error in batch ${i + 1}: ${error.message}`, 'error');
        log(`Error details: ${JSON.stringify(error, null, 2)}`, 'error');
        throw error;
      }

      const savedCount = data?.length || 0;
      totalSaved += savedCount;
      log(`Batch ${i + 1}/${batches}: Saved ${savedCount} records (Total: ${totalSaved}/${validFarms.length})`, 'success');

      // Add small delay between batches to avoid rate limiting
      if (i < batches - 1) {
        await sleep(100);
      }
    } catch (error) {
      const msg = error instanceof Error
        ? error.message
        : (error as any)?.message ?? JSON.stringify(error);
      log(`Failed to save batch ${i + 1}: ${msg}`, 'error');
      throw error;
    }
  }

  log(`Successfully saved ${totalSaved} farms to database`, 'success');
  return totalSaved;
}

/**
 * Read farms from the local JSON file
 */
function readFarmsFromJSON(): { farms: ReturnType<typeof transformToFarmRecord>[]; metadata: Record<string, unknown> } {
  const outputPath = join(process.cwd(), 'output', 'osm-farms.json');

  if (!existsSync(outputPath)) {
    throw new Error(
      `JSON file not found at ${outputPath}. Run without --save first to fetch from OSM.`
    );
  }

  log(`Reading farms from ${outputPath}...`);
  const raw = readFileSync(outputPath, 'utf-8');
  const parsed = JSON.parse(raw);

  if (!parsed.farms || !Array.isArray(parsed.farms)) {
    throw new Error('Invalid JSON structure: missing "farms" array');
  }

  log(`Found ${parsed.farms.length} farms in JSON file (fetched at ${parsed.metadata?.fetchedAt ?? 'unknown'})`, 'success');
  return { farms: parsed.farms, metadata: parsed.metadata ?? {} };
}

/**
 * Import farms from JSON file into Supabase
 */
async function importFromJSON(): Promise<ImportStats> {
  const startTime = Date.now();

  log('='.repeat(80));
  log('OSM Farm Import — Supabase Load Mode (--save)');
  log('='.repeat(80));
  log(`Source: output/osm-farms.json`);
  log(`Supabase URL: ${supabaseUrl}`);
  log(`Batch size: ${BATCH_SIZE} records`);
  log(`Duplicate handling: upsert on osm_id`);
  log('='.repeat(80));

  const stats: ImportStats = {
    totalFetched: 0,
    totalSaved: 0,
    totalErrors: 0,
    totalSkipped: 0,
    byCountry: { NL: 0, BE: 0 },
    byTag: {},
  };

  try {
    // Step 1: Read from JSON
    log('');
    log('Step 1: Reading from JSON file...');
    log('-'.repeat(80));
    const { farms, metadata } = readFarmsFromJSON();
    stats.totalFetched = farms.length;

    // Collect country/tag stats from the file metadata if available
    if (metadata.countries && typeof metadata.countries === 'object') {
      const countries = metadata.countries as Record<string, number>;
      stats.byCountry.NL = countries.NL ?? 0;
      stats.byCountry.BE = countries.BE ?? 0;
    }
    if (metadata.tags && typeof metadata.tags === 'object') {
      stats.byTag = metadata.tags as Record<string, number>;
    }

    if (farms.length === 0) {
      log('JSON file contains no farms — nothing to import.', 'warn');
      return stats;
    }

    // Step 2: Import to Supabase
    log('');
    log('Step 2: Importing into Supabase farms table...');
    log('-'.repeat(80));
    stats.totalSaved = await saveFarmsInBatches(farms);

  } catch (error) {
    stats.totalErrors++;
    log(`Fatal error: ${error instanceof Error ? error.message : (error as any)?.message ?? JSON.stringify(error)}`, 'error');
    if (error instanceof Error && error.stack) {
      log(`Stack trace: ${error.stack}`, 'error');
    }
  }

  const elapsed = Date.now() - startTime;

  log('');
  log('='.repeat(80));
  log('Import Summary');
  log('='.repeat(80));
  log(`Records in JSON file: ${stats.totalFetched.toLocaleString()}`);
  log(`Saved/updated in Supabase: ${stats.totalSaved.toLocaleString()}`);
  log(`Errors: ${stats.totalErrors}`, stats.totalErrors > 0 ? 'error' : 'info');
  log(`Time elapsed: ${formatElapsedTime(elapsed)}`);
  log('');
  log('By Country:');
  log(`  Netherlands (NL): ${stats.byCountry.NL.toLocaleString()}`);
  log(`  Belgium (BE):     ${stats.byCountry.BE.toLocaleString()}`);
  if (Object.keys(stats.byTag).length > 0) {
    log('');
    log('By Tag:');
    for (const [tag, count] of Object.entries(stats.byTag).sort((a, b) => b[1] - a[1])) {
      log(`  ${tag}: ${count.toLocaleString()}`);
    }
  }
  log('='.repeat(80));
  log('Import completed!', stats.totalErrors > 0 ? 'warn' : 'success');
  log('='.repeat(80));

  return stats;
}

/**
 * Fetch from Overpass API and save to JSON
 */
async function importOSMFarms(): Promise<ImportStats> {
  const startTime = Date.now();

  log('='.repeat(80));
  log('OSM Farm Import — Fetch Mode');
  log('='.repeat(80));
  log(`Overpass API URL: ${OVERPASS_API_URL}`);
  log(`Farm tags: ${FARM_QUERIES.map(q => q.label).join(', ')}`);
  log(`Countries: Netherlands (NL), Belgium (BE)`);
  log(`Batch size: ${BATCH_SIZE} records`);
  log(`Max retries: ${MAX_RETRIES}`);
  log('='.repeat(80));

  const stats: ImportStats = {
    totalFetched: 0,
    totalSaved: 0,
    totalErrors: 0,
    totalSkipped: 0,
    byCountry: { NL: 0, BE: 0 },
    byTag: {},
  };

  try {
    // Step 1: Fetch data from Overpass API
    log('');
    log('Step 1: Fetching data from Overpass API...');
    log('-'.repeat(80));
    const osmData = await fetchFromOverpass();
    stats.totalFetched = osmData.elements.length;

    // Step 2: Transform OSM elements to farm records
    log('');
    log('Step 2: Transforming OSM elements to farm records...');
    log('-'.repeat(80));
    const farms = osmData.elements.map(element => transformToFarmRecord(element));
    const validFarms = farms.filter(farm => farm !== null);
    stats.totalSkipped = farms.length - validFarms.length;

    for (const farm of validFarms) {
      if (!farm) continue;
      if (farm.country === 'NL' || farm.country === 'BE') {
        stats.byCountry[farm.country as 'NL' | 'BE']++;
      }
      if (farm.primary_tag) {
        stats.byTag[farm.primary_tag] = (stats.byTag[farm.primary_tag] || 0) + 1;
      }
    }

    log(`Transformed ${validFarms.length} valid records (${stats.totalSkipped} skipped)`, 'success');
    log(`Netherlands: ${stats.byCountry.NL}, Belgium: ${stats.byCountry.BE}`);

    if (validFarms.length === 0) {
      log('No valid farms found to save', 'warn');
      return stats;
    }

    // Step 3: Save to JSON file
    log('');
    log('Step 3: Saving to JSON file...');
    log('-'.repeat(80));

    const outputDir = join(process.cwd(), 'output');
    mkdirSync(outputDir, { recursive: true });
    const outputPath = join(outputDir, 'osm-farms.json');

    const farmsToSave = validFarms.filter(Boolean);

    writeFileSync(
      outputPath,
      JSON.stringify({
        metadata: {
          fetchedAt: new Date().toISOString(),
          totalRecords: farmsToSave.length,
          countries: stats.byCountry,
          tags: stats.byTag,
        },
        farms: farmsToSave,
      }, null, 2)
    );

    log(`Saved ${farmsToSave.length} farms to ${outputPath}`, 'success');
    log('');
    log('Run with --save to import this data into Supabase.');

  } catch (error) {
    stats.totalErrors++;
    log(`Fatal error: ${error instanceof Error ? error.message : (error as any)?.message ?? JSON.stringify(error)}`, 'error');
    if (error instanceof Error && error.stack) {
      log(`Stack trace: ${error.stack}`, 'error');
    }
  }

  const elapsed = Date.now() - startTime;

  log('');
  log('='.repeat(80));
  log('Fetch Summary');
  log('='.repeat(80));
  log(`Total OSM elements fetched: ${stats.totalFetched.toLocaleString()}`);
  log(`Valid farm records: ${(stats.totalFetched - stats.totalSkipped).toLocaleString()}`);
  log(`Skipped (no coordinates): ${stats.totalSkipped}`);
  log(`Saved to JSON: output/osm-farms.json`);
  log(`Errors: ${stats.totalErrors}`, stats.totalErrors > 0 ? 'error' : 'info');
  log(`Time elapsed: ${formatElapsedTime(elapsed)}`);
  log('');
  log('By Country:');
  log(`  Netherlands (NL): ${stats.byCountry.NL.toLocaleString()}`);
  log(`  Belgium (BE):     ${stats.byCountry.BE.toLocaleString()}`);
  log('');
  log('By Tag:');
  for (const [tag, count] of Object.entries(stats.byTag).sort((a, b) => b[1] - a[1])) {
    log(`  ${tag}: ${count.toLocaleString()}`);
  }
  log('='.repeat(80));
  log('Fetch completed!', stats.totalErrors > 0 ? 'warn' : 'success');
  log('='.repeat(80));

  return stats;
}

// Run the import if this script is executed directly
if (require.main === module) {
  const saveToDatabase = process.argv.includes('--save');

  const run = saveToDatabase ? importFromJSON : importOSMFarms;

  run()
    .then((stats) => {
      process.exitCode = stats.totalErrors > 0 ? 1 : 0;
    })
    .catch((error) => {
      log(`Script failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
      process.exitCode = 1;
    });
}

export { importOSMFarms, importFromJSON, fetchFromOverpass, transformToFarmRecord, saveFarmsInBatches };
