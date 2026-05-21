/**
 * Fish farms import script
 *
 * Reads output/fish_farms_to_import.json and upserts into Supabase.
 *
 * Usage:
 *   npx ts-node -P tsconfig.scripts.json src/scripts/fish-import.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

interface FishFarm {
  name: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string;
  latitude: number;
  longitude: number;
  location: string;
  farm_type: string[];
  website: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  image: string | null;
  source: string;
  osm_id: string;
  is_published: boolean;
  primary_tag: string | null;
  opening_hours: string | null;
}

function log(msg: string) {
  console.log(`${new Date().toISOString()} ${msg}`);
}

function normalizeFarmTypes(raw: unknown): string[] {
  if (Array.isArray(raw)) return (raw as string[]).map(v => String(v).toLowerCase()).filter(Boolean);
  if (typeof raw === 'string' && raw) {
    if (raw.startsWith('{') && raw.endsWith('}'))
      return raw.slice(1, -1).split(',').map(v => v.trim().replace(/^"(.*)"$/, '$1').toLowerCase()).filter(Boolean);
    if (raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return (parsed as unknown[]).map(v => String(v).toLowerCase()).filter(Boolean);
      } catch { /* ignore */ }
    }
    return [raw.toLowerCase()];
  }
  return [];
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(supabaseUrl, serviceKey);

  // ── 1. Load JSON ─────────────────────────────────────────────────────────────
  const jsonPath = join(process.cwd(), 'output', 'fish_farms_to_import.json');
  const { farms, metadata } = JSON.parse(readFileSync(jsonPath, 'utf-8')) as {
    farms: FishFarm[];
    metadata: Record<string, unknown>;
  };
  log(`Loaded ${farms.length} fish farms from JSON (source: ${metadata.source})`);

  // ── 2. Count existing fish farms before import ────────────────────────────────
  const { data: allBefore } = await supabase
    .from('farms')
    .select('farm_type')
    .eq('is_published', true);

  let fishBefore = 0;
  for (const row of allBefore ?? []) {
    if (normalizeFarmTypes(row.farm_type).includes('fish')) fishBefore++;
  }
  log(`Fish farms currently in DB: ${fishBefore}`);

  // ── 3. Upsert in batches of 50 ───────────────────────────────────────────────
  const toUpsert = farms.map(f => ({
    name:          f.name,
    address:       f.address,
    city:          f.city,
    postal_code:   f.postal_code,
    country:       f.country,
    location:      f.location,
    farm_type:     f.farm_type.map(t => t.toLowerCase()),
    website:       f.website,
    phone:         f.phone,
    email:         f.email,
    description:   f.description,
    image:         f.image,
    source:        f.source,
    osm_id:        f.osm_id,
    is_published:  f.is_published,
    primary_tag:   f.primary_tag,
    opening_hours: f.opening_hours ?? null,
  }));

  const BATCH = 50;
  let upserted = 0;
  for (let i = 0; i < toUpsert.length; i += BATCH) {
    const batch = toUpsert.slice(i, i + BATCH);
    const { error } = await supabase
      .from('farms')
      .upsert(batch, { onConflict: 'osm_id', ignoreDuplicates: false });
    if (error) throw new Error(`Batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
    upserted += batch.length;
    log(`  Upserted ${upserted}/${toUpsert.length}`);
    await new Promise(r => setTimeout(r, 100));
  }

  // ── 4. Count fish farms after import ─────────────────────────────────────────
  const { data: allAfter } = await supabase
    .from('farms')
    .select('farm_type')
    .eq('is_published', true);

  let fishAfter = 0;
  for (const row of allAfter ?? []) {
    if (normalizeFarmTypes(row.farm_type).includes('fish')) fishAfter++;
  }

  const { count: totalCount } = await supabase
    .from('farms')
    .select('*', { count: 'exact', head: true })
    .eq('is_published', true);

  log('');
  log('── Import complete ──────────────────────────────────────────────');
  log(`  Records in JSON:        ${farms.length}`);
  log(`  Upserted:               ${upserted}`);
  log(`  Fish farms before:      ${fishBefore}`);
  log(`  Fish farms after:       ${fishAfter}`);
  log(`  New fish farms added:   ${fishAfter - fishBefore}`);
  log(`  Total farms in DB:      ${totalCount ?? '?'}`);
  log('─────────────────────────────────────────────────────────────────');
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
