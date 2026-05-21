/**
 * overture-import.ts
 *
 * Imports consumer-facing farms from Overture Maps (Meta + Microsoft data)
 * into the Supabase farms table.
 *
 * Source file: data/overture_import_ready.json (6,866 records)
 * Already filtered to:
 *   - NL + BE only
 *   - Consumer-facing categories only
 *   - Microsoft dairy_stores removed (chain stores)
 *
 * Prerequisites:
 *   1. Run migrations/017_add_overture_source.sql in Supabase SQL Editor
 *
 * Usage (dry-run, no DB writes):
 *   npx ts-node -P tsconfig.scripts.json src/scripts/overture-import.ts
 *
 * Usage (live import):
 *   npx ts-node -P tsconfig.scripts.json src/scripts/overture-import.ts --save
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// ── Category → farm_type mapping ──────────────────────────────────────────────

const CATEGORY_TO_FARM_TYPE: Record<string, string[]> = {
  farm:                  ['produce'],
  dairy_farm:            ['dairy'],
  winery:                ['wine'],
  farmers_market:        ['markets'],
  cheese_shop:           ['cheese'],
  organic_grocery_store: ['organic'],
  fishmonger:            ['fish'],
  distillery:            ['wine'],
  dairy_stores:          ['dairy'],
  poultry_farm:          ['meat'],
  urban_farm:            ['produce'],
  public_market:         ['markets'],
  fish_farm:             ['fish'],
  pig_farm:              ['meat'],
  community_gardens:     ['produce'],
  honey_farm_shop:       ['honey'],
  greenhouses:           ['produce'],
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface OvertureRecord {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string;
  category: string;
  phone: string | null;
  website: string | null;
  socials: string[];
  datasets: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`${new Date().toISOString().slice(11, 19)} [IMPORT] ${msg}`);
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  // Microsoft phones sometimes omit the +
  const stripped = phone.replace(/\s/g, '');
  if (stripped.match(/^\d{9,12}$/) && !stripped.startsWith('+')) {
    // Heuristic: 10-digit starting with 0 → likely NL/BE local format, keep as-is
    return phone.trim();
  }
  return phone.trim();
}

function buildDescription(record: OvertureRecord): string {
  const srcLabel = record.datasets.find(d => d !== 'Overture') ?? 'Overture';
  const cat = record.category.replace(/_/g, ' ');
  return `Lokale ${cat} via Overture Maps (${srcLabel}).`;
}

function resolveFarmType(category: string): string[] {
  return CATEGORY_TO_FARM_TYPE[category] ?? ['produce'];
}

// ── Main ────────────────────────────────────────────────────────────────────────

async function main() {
  const DRY_RUN = !process.argv.includes('--save');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

  const sb = createClient(supabaseUrl, serviceKey);

  log(`Mode: ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'LIVE IMPORT'}`);
  log('Reading overture_import_ready.json...');

  const filePath = join(process.cwd(), 'data', 'overture_import_ready.json');
  const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as OvertureRecord[];
  log(`Loaded ${raw.length.toLocaleString()} records`);

  // ── Load existing name+city for dedup ────────────────────────────────────────
  log('Loading existing farms for deduplication...');
  const existingNameCity = new Set<string>();
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const { data: batch, error } = await sb
      .from('farms')
      .select('name, city')
      .eq('is_published', true)
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`Supabase error: ${error.message}`);
    if (!batch || batch.length === 0) break;
    for (const f of batch) {
      const key = `${(f.name ?? '').trim().toLowerCase()}|${(f.city ?? '').trim().toLowerCase()}`;
      existingNameCity.add(key);
    }
    if (batch.length < PAGE) break;
    offset += PAGE;
  }
  log(`Existing name+city pairs: ${existingNameCity.size.toLocaleString()}`);

  // ── DB count before import ───────────────────────────────────────────────────
  const { count: beforeCount } = await sb
    .from('farms')
    .select('*', { count: 'exact', head: true })
    .eq('is_published', true);
  log(`Farms in DB before import: ${beforeCount ?? '?'}`);

  // ── Build insert rows ─────────────────────────────────────────────────────────
  log('Mapping records to DB schema...');

  let skippedDedup    = 0;
  let skippedNoName   = 0;
  const toInsert: object[] = [];

  for (const record of raw) {
    if (!record.name?.trim()) { skippedNoName++; continue; }

    const nameKey = `${record.name.trim().toLowerCase()}|${(record.city ?? '').trim().toLowerCase()}`;
    if (existingNameCity.has(nameKey)) { skippedDedup++; continue; }

    const farmType = resolveFarmType(record.category);
    const primaryTag = farmType[0] ?? 'produce';

    toInsert.push({
      osm_id:      `overture_${record.id}`,
      name:        record.name.trim(),
      address:     record.address   ?? null,
      city:        record.city      ?? null,
      postal_code: record.postal_code ?? null,
      country:     record.country   ?? null,
      location:    `POINT(${record.lng} ${record.lat})`,
      farm_type:   farmType,
      primary_tag: primaryTag,
      source:      'overture',
      is_published: true,
      phone:       normalizePhone(record.phone),
      website:     record.website ?? null,
      description: buildDescription(record),
    });
  }

  log('');
  log('── Pre-import summary ───────────────────────────────────────');
  log(`  Total records     : ${raw.length.toLocaleString()}`);
  log(`  Skipped (no name) : ${skippedNoName}`);
  log(`  Skipped (dedup)   : ${skippedDedup.toLocaleString()}`);
  log(`  Ready to insert   : ${toInsert.length.toLocaleString()}`);
  log('─────────────────────────────────────────────────────────────');

  if (DRY_RUN) {
    log('DRY RUN — no changes made. Run with --save to import.');
    log('');
    log('Sample of first 5 rows that would be inserted:');
    for (const row of toInsert.slice(0, 5)) {
      log(JSON.stringify(row));
    }
    return;
  }

  // ── Batch upsert ──────────────────────────────────────────────────────────────
  log('Starting batch upsert (500 per batch)...');
  const BATCH = 500;
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
      if (saved % 2000 === 0 || saved === toInsert.length) {
        log(`  Upserted ${saved.toLocaleString()}/${toInsert.length.toLocaleString()}...`);
      }
    }

    await sleep(50);
  }

  // ── Final count ───────────────────────────────────────────────────────────────
  const { count: afterCount } = await sb
    .from('farms')
    .select('*', { count: 'exact', head: true })
    .eq('is_published', true);

  log('');
  log('── Import complete ──────────────────────────────────────────');
  log(`  Records processed     : ${raw.length.toLocaleString()}`);
  log(`  Skipped (dedup)       : ${skippedDedup.toLocaleString()}`);
  log(`  Successfully upserted : ${saved.toLocaleString()}`);
  log(`  Batches with errors   : ${errors}`);
  log(`  Farms in DB before    : ${beforeCount ?? '?'}`);
  log(`  Farms in DB after     : ${afterCount ?? '?'}`);
  log(`  Net new farms         : ${(afterCount ?? 0) - (beforeCount ?? 0)}`);
  log('─────────────────────────────────────────────────────────────');
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
