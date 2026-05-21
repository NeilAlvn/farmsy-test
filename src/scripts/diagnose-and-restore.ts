/**
 * diagnose-and-restore.ts
 *
 * Phase 1 — DIAGNOSE
 *   • Read original output/jecuisinelocal-farms.json
 *   • Count how many JCL farms originally had each category
 *   • Query DB for all JCL farms, compare actual vs expected farm_type
 *   • Detect count-query pagination bug (Supabase default limit = 1000 rows)
 *
 * Phase 2 — RESTORE (--save)
 *   • For every JCL farm: merge DB farm_type with original JCL farm_type
 *   • If DB is ahead (has Wine/Meat from later imports): keep those too
 *   • Upsert in batches
 *
 * Usage:
 *   npx ts-node -P tsconfig.scripts.json src/scripts/diagnose-and-restore.ts
 *   npx ts-node -P tsconfig.scripts.json src/scripts/diagnose-and-restore.ts --save
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

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

/** Paginated full table scan — works regardless of row count */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllFarms(
  supabase: any,
  cols: string,
): Promise<Record<string, unknown>[]> {
  const PAGE = 1000;
  const all: Record<string, unknown>[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from('farms').select(cols).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...(data as Record<string, unknown>[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function main() {
  const saveMode = process.argv.includes('--save');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('Missing env vars');
  const supabase = createClient(supabaseUrl, serviceKey);

  // ── Phase 1: Read original JCL JSON ────────────────────────────────────────
  log('');
  log('═══ Phase 1: Diagnose ═════════════════════════════════════════════');

  const jsonPath = join(process.cwd(), 'output', 'jecuisinelocal-farms.json');
  const { farms: jclFarms } = JSON.parse(readFileSync(jsonPath, 'utf-8')) as {
    farms: Array<{ osm_id: string; name: string; city: string | null; farm_type: string[] }>;
  };

  log(`JCL JSON: ${jclFarms.length} farms`);

  // Count originals (case-insensitive — JCL uses Title Case)
  const origCounts: Record<string, number> = {};
  const origByOsmId = new Map<string, string[]>();
  for (const f of jclFarms) {
    const types = f.farm_type.map(t => t.toLowerCase()).filter(Boolean);
    origByOsmId.set(f.osm_id, types);
    for (const t of types) origCounts[t] = (origCounts[t] ?? 0) + 1;
  }

  log('');
  log('── Original JCL category counts (from JSON) ─────────────────────');
  const catOrder = ['eggs','dairy','meat','fish','produce','cheese','wine','markets'];
  for (const cat of catOrder) {
    log(`  ${cat.padEnd(10)}: ${origCounts[cat] ?? 0}`);
  }
  for (const [cat, cnt] of Object.entries(origCounts)) {
    if (!catOrder.includes(cat)) log(`  ${cat.padEnd(10)}: ${cnt}  (extra)`);
  }

  // ── Phase 1b: Query DB ──────────────────────────────────────────────────────
  log('');
  log('Loading all farms from DB (paginated)…');
  const allFarms = await fetchAllFarms(supabase, 'osm_id, name, city, farm_type, source, is_published');
  log(`  Total farms in DB: ${allFarms.length}`);

  const jclInDb = allFarms.filter(f => (f.source as string)?.startsWith('jecuisinelocal'));
  log(`  JCL farms in DB:   ${jclInDb.length}`);

  // Correct category counts (paginated, all farms)
  const dbCounts: Record<string, number> = {};
  for (const row of allFarms) {
    if (!(row.is_published as boolean)) continue;
    for (const t of normalizeFarmTypes(row.farm_type)) {
      dbCounts[t] = (dbCounts[t] ?? 0) + 1;
    }
  }

  log('');
  log('── CORRECT DB category counts (paginated, all farms) ────────────');
  for (const cat of catOrder) {
    const orig = origCounts[cat] ?? 0;
    const db   = dbCounts[cat] ?? 0;
    const flag = db < orig ? ' ← BELOW EXPECTED' : '';
    log(`  ${cat.padEnd(10)}: DB=${String(db).padStart(4)}  |  JCL-original=${String(orig).padStart(4)}${flag}`);
  }
  log(`  Total in DB: ${allFarms.length}`);

  // ── Phase 1c: Per-farm comparison ───────────────────────────────────────────
  log('');
  log('── JCL farms: expected vs actual farm_type ──────────────────────');

  const byOsmId = new Map<string, Record<string, unknown>>();
  for (const f of jclInDb) byOsmId.set(f.osm_id as string, f);

  let missingOsmId  = 0;
  let typeMismatch  = 0;
  let eggsLost      = 0;
  const eggsLostExamples: Array<{ name: string; city: string | null; expected: string[]; actual: string[] }> = [];
  const missingTypeExamples: Array<{ name: string; expected: string[]; actual: string[]; missing: string[] }> = [];

  for (const [osmId, expected] of origByOsmId.entries()) {
    const dbFarm = byOsmId.get(osmId);
    if (!dbFarm) { missingOsmId++; continue; }

    const actual = normalizeFarmTypes(dbFarm.farm_type);
    const missing = expected.filter(t => !actual.includes(t));

    if (missing.length > 0) {
      typeMismatch++;
      if (missing.includes('eggs')) {
        eggsLost++;
        if (eggsLostExamples.length < 5) {
          eggsLostExamples.push({
            name: dbFarm.name as string,
            city: dbFarm.city as string | null,
            expected,
            actual,
          });
        }
      }
      if (missingTypeExamples.length < 10) {
        missingTypeExamples.push({ name: dbFarm.name as string, expected, actual, missing });
      }
    }
  }

  log(`  JCL farms in JSON:         ${jclFarms.length}`);
  log(`  JCL farms missing from DB: ${missingOsmId}`);
  log(`  JCL farms with wrong type: ${typeMismatch}`);
  log(`  JCL farms missing 'eggs':  ${eggsLost}`);

  if (eggsLostExamples.length > 0) {
    log('');
    log('  Eggs-missing examples:');
    for (const ex of eggsLostExamples) {
      log(`    ${ex.name} (${ex.city ?? '?'})`);
      log(`      expected: [${ex.expected.join(', ')}]`);
      log(`      actual:   [${ex.actual.join(', ')}]`);
    }
  }

  log('');
  log('── Root cause ────────────────────────────────────────────────────');
  log('  The JCL import stored ONLY the first category (farm_type[0]) per farm.');
  log('  Multi-category farms (e.g. Dairy+Eggs+Meat) lost all but the first.');
  log('  Subsequent OSM imports never touched JCL farms → categories still missing.');

  if (missingTypeExamples.length > 0) {
    log('');
    log('  Sample farms with missing categories:');
    for (const ex of missingTypeExamples.slice(0, 5)) {
      log(`    ${ex.name}: missing [${ex.missing.join(', ')}]`);
    }
  }

  if (!saveMode) {
    log('');
    log('Run with --save to restore all missing JCL categories.');
    return;
  }

  // ── Phase 2: Restore ────────────────────────────────────────────────────────
  log('');
  log('═══ Phase 2: Restore ══════════════════════════════════════════════');

  // Track restoration stats per category
  const restoredCounts: Record<string, number> = {};
  const toUpdate: Array<{ osm_id: string; farm_type: string[] }> = [];

  for (const [osmId, expected] of origByOsmId.entries()) {
    const dbFarm = byOsmId.get(osmId);
    if (!dbFarm) continue;  // missing entirely — would need a full re-insert

    const actual  = normalizeFarmTypes(dbFarm.farm_type);
    const merged  = [...new Set([...actual, ...expected])];

    if (merged.length === actual.length) continue;  // nothing to restore

    const restored = merged.filter(t => !actual.includes(t));
    for (const t of restored) restoredCounts[t] = (restoredCounts[t] ?? 0) + 1;
    toUpdate.push({ osm_id: osmId, farm_type: merged });
  }

  log(`Farms to update: ${toUpdate.length}`);
  log('Categories being restored:');
  for (const [cat, cnt] of Object.entries(restoredCounts).sort((a, b) => (b[1] as number) - (a[1] as number))) {
    log(`  ${cat.padEnd(10)}: +${cnt}`);
  }

  // Execute updates in batches
  let done = 0;
  const BATCH = 50;
  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const slice = toUpdate.slice(i, i + BATCH);
    await Promise.all(slice.map(async u => {
      const { error } = await supabase.from('farms').update({ farm_type: u.farm_type }).eq('osm_id', u.osm_id);
      if (error) log(`  [WARN] ${u.osm_id}: ${error.message}`);
      else done++;
    }));
    await new Promise(r => setTimeout(r, 80));
  }
  log(`Updated ${done} farms`);

  // ── Final report ─────────────────────────────────────────────────────────
  log('');
  log('═══ Final report ══════════════════════════════════════════════════');

  const finalFarms = await fetchAllFarms(supabase, 'farm_type, is_published');
  const finalCounts: Record<string, number> = {};
  for (const row of finalFarms) {
    if (!(row.is_published as boolean)) continue;
    for (const t of normalizeFarmTypes(row.farm_type)) {
      finalCounts[t] = (finalCounts[t] ?? 0) + 1;
    }
  }

  log('');
  log('── Category totals after restore ─────────────────────────────────');
  const allCats = new Set([...catOrder, ...Object.keys(finalCounts)]);
  for (const cat of catOrder) {
    const before = dbCounts[cat] ?? 0;
    const after  = finalCounts[cat] ?? 0;
    const diff   = after - before;
    const arrow  = diff > 0 ? ` (+${diff})` : diff < 0 ? ` (${diff})` : '';
    log(`  ${cat.padEnd(10)}: ${String(after).padStart(4)}${arrow}`);
  }
  for (const cat of allCats) {
    if (!catOrder.includes(cat) && finalCounts[cat]) {
      log(`  ${cat.padEnd(10)}: ${finalCounts[cat]}  (extra)`);
    }
  }
  log('');
  log(`  Total farms in DB: ${finalFarms.length}`);
  log('═══════════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
