/**
 * foursquare-import.ts
 *
 * Imports 2,653 Foursquare Produce + Fish farms (enriched with Google Places data)
 * into the Supabase farms table.
 *
 * Prerequisites:
 *   1. Run migrations/015_add_foursquare_source.sql in Supabase SQL Editor
 *
 * Usage:
 *   npx ts-node -P tsconfig.scripts.json src/scripts/foursquare-import.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// ── Category ID → farm_type mapping ───────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  '4bf58dd8d48988d1fa941735': 'produce',  // Produce & Grocery
  '4bf58dd8d48988d10e951735': 'fish',     // Fish & Chips / Fishmonger
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface OriginalFarm {
  fsq_place_id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  locality: string | null;
  region: string | null;
  postcode: string | null;
  country: string;
  categories: string[];
  phone: string | null;
  website: string | null;
}

interface GoogleData {
  phone: string | null;
  website: string | null;
  opening_hours: string[] | null;
  rating: number | null;
  reviews: number | null;
  image_url: string | null;
  place_types: string[];
}

interface EnrichedRecord {
  fsq_place_id: string;
  name: string;
  status: 'SUCCESS' | 'PARTIAL' | 'NOT_FOUND';
  original: OriginalFarm;
  google_data?: GoogleData;
}

interface EnrichedFile {
  metadata: { stats: Record<string, number> };
  results: EnrichedRecord[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`${new Date().toISOString().slice(11, 19)} [IMPORT] ${msg}`);
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function resolveFarmTypes(categories: string[]): string[] {
  const types = new Set<string>();
  for (const catId of categories) {
    const type = CATEGORY_MAP[catId];
    if (type) types.add(type);
  }
  return types.size > 0 ? Array.from(types) : ['produce'];
}

function buildDescription(record: EnrichedRecord): string {
  const farmTypes = resolveFarmTypes(record.original.categories ?? []);
  const typeLabel = farmTypes.includes('fish') ? 'viswinkel/viskraam' : 'boerenwinkel/markt';
  const parts: string[] = [`Lokale ${typeLabel} via Foursquare.`];
  if (record.google_data?.rating && record.google_data?.reviews) {
    parts.push(`Google Rating: ${record.google_data.rating} (${record.google_data.reviews} reviews).`);
  }
  return parts.join(' ');
}

// ── Main ────────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

  const sb = createClient(supabaseUrl, serviceKey);

  log('Reading foursquare_enriched.json…');
  const filePath = join(process.cwd(), 'data', 'foursquare_enriched.json');
  const { results } = JSON.parse(readFileSync(filePath, 'utf-8')) as EnrichedFile;
  log(`Loaded ${results.length} records (${results.filter(r => r.status === 'SUCCESS').length} SUCCESS, ${results.filter(r => r.status === 'PARTIAL').length} PARTIAL, ${results.filter(r => r.status === 'NOT_FOUND').length} NOT_FOUND)`);

  // Count farms currently in DB before import
  const { count: beforeCount } = await sb
    .from('farms')
    .select('*', { count: 'exact', head: true })
    .eq('is_published', true);
  log(`Farms in DB before import: ${beforeCount ?? '?'}`);

  const toInsert = results.map(record => {
    const orig = record.original;
    const gd   = record.google_data;

    // Prefer Google Places data; fall back to Foursquare original
    const phone   = gd?.phone   ?? orig.phone   ?? null;
    const website = gd?.website ?? orig.website ?? null;
    const image   = gd?.image_url ?? null;

    const openingHoursRaw = gd?.opening_hours;
    const opening_hours = Array.isArray(openingHoursRaw) && openingHoursRaw.length > 0
      ? openingHoursRaw.join('\n')
      : null;

    const farmTypes = resolveFarmTypes(orig.categories ?? []);

    return {
      osm_id:            `fsq_${orig.fsq_place_id}`,
      name:              orig.name,
      address:           orig.address  ?? null,
      city:              orig.locality ?? null,
      postal_code:       orig.postcode ?? null,
      country:           orig.country  ?? 'NL',
      location:          `POINT(${orig.longitude} ${orig.latitude})`,
      farm_type:         farmTypes,
      source:            'foursquare',
      enrichment_source: gd ? 'google_places' : null,
      is_published:      true,
      primary_tag:       farmTypes.includes('fish') ? 'fish' : 'produce',
      description:       buildDescription(record),
      phone,
      website,
      opening_hours,
      image,
    };
  });

  log(`Prepared ${toInsert.length} records for upsert.`);

  const BATCH = 50;
  let saved  = 0;
  let errors = 0;

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { error } = await sb
      .from('farms')
      .upsert(batch, { onConflict: 'osm_id', ignoreDuplicates: false });

    if (error) {
      log(`ERROR in batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
      errors++;
    } else {
      saved += batch.length;
      if (saved % 500 === 0 || saved === toInsert.length) {
        log(`  Upserted ${saved}/${toInsert.length}…`);
      }
    }

    await sleep(100);
  }

  const { count: afterCount } = await sb
    .from('farms')
    .select('*', { count: 'exact', head: true })
    .eq('is_published', true);

  log('');
  log('── Import complete ──────────────────────────────────────────────');
  log(`  Records processed:    ${toInsert.length}`);
  log(`  Successfully upserted:${saved}`);
  log(`  Batches with errors:  ${errors}`);
  log(`  Farms in DB before:   ${beforeCount ?? '?'}`);
  log(`  Farms in DB after:    ${afterCount ?? '?'}`);
  log(`  Net new farms:        ${(afterCount ?? 0) - (beforeCount ?? 0)}`);
  log('─────────────────────────────────────────────────────────────────');
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
