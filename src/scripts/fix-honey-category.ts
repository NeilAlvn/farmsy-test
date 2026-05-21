/**
 * fix-honey-category.ts
 *
 * Finds all farms whose primary_tag is 'craft=beekeeper' or 'shop=honey'
 * and corrects their farm_type so 'produce' becomes 'honey'.
 * Also catches farms tagged shop=farm with a honey name (source already 'osm').
 *
 * Usage:
 *   npx ts-node -P tsconfig.scripts.json src/scripts/fix-honey-category.ts
 *   npx ts-node -P tsconfig.scripts.json src/scripts/fix-honey-category.ts --save
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

function log(msg: string) { console.log(`${new Date().toISOString()} ${msg}`); }

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

const HONEY_NAME_RE = /imkerij|imkerbedrijf|\bimker\b|honingboer|honingkwekerij|apiculteur|apiculture|rucher|bijenhouder|bijenteelt|bijenstal|honinghof|honinghoeve/i;

async function main() {
  const saveMode = process.argv.includes('--save');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('Missing env vars');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createClient(supabaseUrl, serviceKey);

  // Load all farms paginated
  const PAGE = 1000;
  const all: Array<{ osm_id: string; name: string | null; farm_type: unknown; primary_tag: string | null }> = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('farms')
      .select('osm_id, name, farm_type, primary_tag')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  log(`Loaded ${all.length} farms`);

  const toUpdate: Array<{ osm_id: string; old: string[]; newTypes: string[] }> = [];

  for (const farm of all) {
    const tag  = farm.primary_tag ?? '';
    const name = farm.name ?? '';
    const isHoneyFarm =
      tag === 'craft=beekeeper' ||
      tag === 'shop=honey' ||
      HONEY_NAME_RE.test(name);

    if (!isHoneyFarm) continue;

    const current = normalizeFarmTypes(farm.farm_type);
    if (current.includes('honey')) continue; // already correct

    // Replace standalone 'produce' with 'honey'; keep all other types
    const replaced = current.includes('produce')
      ? current.map(t => t === 'produce' ? 'honey' : t)
      : [...current, 'honey'];
    const deduped = [...new Set(replaced)];

    toUpdate.push({ osm_id: farm.osm_id, old: current, newTypes: deduped });
  }

  log(`Farms needing honey category fix: ${toUpdate.length}`);
  if (toUpdate.length > 0) {
    log('Sample:');
    for (const u of toUpdate.slice(0, 5)) {
      log(`  ${u.osm_id}: [${u.old.join(',')}] → [${u.newTypes.join(',')}]`);
    }
  }

  if (!saveMode) {
    log('Dry run — pass --save to apply.');
    return;
  }

  let done = 0;
  for (const u of toUpdate) {
    const { error } = await supabase.from('farms').update({ farm_type: u.newTypes }).eq('osm_id', u.osm_id);
    if (error) log(`  [WARN] ${u.osm_id}: ${error.message}`);
    else done++;
    await new Promise(r => setTimeout(r, 40));
  }
  log(`Updated ${done} farms`);

  // Verify
  let honeyCount = 0;
  from = 0;
  while (true) {
    const { data } = await supabase.from('farms').select('farm_type').eq('is_published', true).range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (normalizeFarmTypes(row.farm_type).includes('honey')) honeyCount++;
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  log(`Honey farms in DB after fix: ${honeyCount}`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
