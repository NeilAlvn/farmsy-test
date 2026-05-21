/**
 * traces-final-import.ts
 * 
 * Final step: Import the 1,720 verified and Google-enriched organic farms into Supabase.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';

// ─── Config ───────────────────────────────────────────────────────────────────

const INPUT_PATH = join(process.cwd(), 'data', 'traces_verified_import_ready.csv');

function log(msg: string) {
  console.log(`${new Date().toISOString().slice(11, 19)} [IMPORT] ${msg}`);
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Farm Type Mapping ───────────────────────────────────────────────────────

function mapToFarmTypes(activities: string, categories: string): string[] {
  const types = new Set<string>();
  const text = (activities + ' ' + categories).toLowerCase();

  if (/livestock|cattle|cow|dairy|milk|goat|sheep|pig|swine|poultry/i.test(text)) {
    types.add('dairy');
    types.add('meat');
  }
  if (/eggs?|poultry|hen|chicken/i.test(text)) types.add('eggs');
  if (/crops?|plant|vegetable|fruit|arable|grain|cereal|horticulture/i.test(text)) types.add('produce');
  if (/bee|honey|apicult/i.test(text)) types.add('honey');
  if (/wine|vineyard|vitis/i.test(text)) types.add('wine');
  if (/fish|aqua/i.test(text)) types.add('fish');

  // If no specific category matched, default to produce
  if (types.size === 0) types.add('produce');
  
  // Always add 'organic'
  types.add('organic');

  return Array.from(types);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  const sb = createClient(supabaseUrl, serviceKey);

  log('Reading verified farms CSV…');
  const fileContent = readFileSync(INPUT_PATH, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true
  });

  log(`Loaded ${records.length} records for import.`);

  const toInsert: any[] = [];

  for (const row of records as any[]) {
    const farmTypes = mapToFarmTypes(row.traces_activities || '', row.traces_categories || '');
    
    // Construct description
    let description = `SKAL-gecertificeerd biologisch bedrijf (${row.traces_reference}).`;
    if (row.traces_activities) {
        description += ` Activiteiten: ${row.traces_activities}.`;
    }
    if (row.google_rating && row.google_reviews) {
        description += ` Google Rating: ${row.google_rating} (${row.google_reviews} reviews).`;
    }

    toInsert.push({
      osm_id:       row.osm_id,
      name:         row.name,
      address:      row.address,
      city:         row.city,
      postal_code:  row.postal_code,
      country:      row.country,
      location:     `POINT(${row.lng} ${row.lat})`,
      farm_type:    farmTypes,
      source:       'traces',
      is_published: true,
      primary_tag:  'organic_certified',
      description:  description,
      phone:        row.phone || null,
      website:      row.website_google || null,
      opening_hours: row.opening_hours || null,
      image:        row.image_url || null
    });
  }

  log(`Prepared ${toInsert.length} records for upsert.`);

  const BATCH = 50;
  let saved = 0;
  let errors = 0;

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { error } = await sb.from('farms').upsert(batch, { onConflict: 'osm_id' });
    
    if (error) {
      log(`Error in batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
      errors++;
    } else {
      saved += batch.length;
      log(`  Upserted ${saved}/${toInsert.length}…`);
    }
    
    await sleep(200); // Polite delay
  }

  log('');
  log('── Import complete ───────────────────────────────────────────────────────');
  log(`  Successfully imported: ${saved}`);
  log(`  Batches with errors:   ${errors}`);
  log('──────────────────────────────────────────────────────────────────────────');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
