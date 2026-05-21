/**
 * dedupe-farms.ts
 *
 * Resolves the 109 duplicate farm groups flagged during Google enrichment.
 *
 * The enrichment script grouped farms by name+city (lowercased), which catches
 * many FALSE POSITIVES — e.g. every "Markt" across the Netherlands in one group.
 * This script adds a geographic check: only farms within PROXIMITY_METERS of each
 * other at the same-name location are treated as real duplicates.
 *
 * PHASE 1 (default): Analyse, print report, save plan to output/dedupe/
 * PHASE 2 (--apply): Read plan and execute merges + deletions against DB
 *
 * Usage:
 *   npx ts-node -P tsconfig.scripts.json src/scripts/dedupe-farms.ts
 *   npx ts-node -P tsconfig.scripts.json src/scripts/dedupe-farms.ts --apply
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ─── Config ──────────────────────────────────────────────────────────────────

const PROXIMITY_METERS = 300;   // farms closer than this = same physical location
const OUT_DIR = join(process.cwd(), 'output', 'dedupe');

// ─── Types ───────────────────────────────────────────────────────────────────

interface FarmRow {
  id: string;
  name: string;
  osm_id: string;
  city: string | null;
  source: string | null;
  enrichment_source: string | null;
  image: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  description: string | null;
  opening_hours: string | null;
  facebook: string | null;
  instagram: string | null;
  lat: number | null;
  lng: number | null;
}

interface DupGroup { name: string; city: string; ids: string[] }

interface SubgroupPlan {
  winner: { id: string; name: string; osm_id: string; source: string | null; score: number };
  losers: { id: string; name: string; osm_id: string; source: string | null; score: number }[];
  merge_update: Record<string, string> | null;
  max_distance_m: number;
}

interface GroupPlan {
  group_name: string;
  group_city: string;
  true_dup_subgroups: SubgroupPlan[];
  false_positive_farms: { id: string; name: string; lat: number | null; lng: number | null }[];
  notes: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg: string) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function scoreFarm(f: FarmRow): number {
  let s = 0;
  if (f.enrichment_source === 'google_places') s += 100;
  if (f.image)         s += 20;
  if (f.phone)         s += 10;
  if (f.website)       s += 10;
  if (f.opening_hours) s += 10;
  if (f.description)   s += 10;
  if (f.email)         s += 5;
  const src = f.source ?? '';
  if (src.includes('osm'))           s += 5;
  else if (src.includes('jecuisinelocal')) s += 3;
  return s;
}

const MERGE_FIELDS = ['phone', 'website', 'email', 'description', 'opening_hours', 'facebook', 'instagram', 'image'] as const;

function buildMerge(winner: FarmRow, losers: FarmRow[]): Record<string, string> | null {
  const update: Record<string, string> = {};
  for (const loser of losers) {
    for (const field of MERGE_FIELDS) {
      if (!winner[field] && loser[field]) update[field] = loser[field] as string;
    }
  }
  return Object.keys(update).length > 0 ? update : null;
}

/** Greedy union-find style clustering by proximity */
function clusterByProximity(farms: FarmRow[]): FarmRow[][] {
  const clusters: FarmRow[][] = [];
  const used = new Set<string>();

  for (const seed of farms) {
    if (used.has(seed.id)) continue;
    const cluster = [seed];
    used.add(seed.id);
    for (const other of farms) {
      if (used.has(other.id)) continue;
      if (seed.lat == null || seed.lng == null || other.lat == null || other.lng == null) continue;
      if (haversineMeters(seed.lat, seed.lng, other.lat, other.lng) <= PROXIMITY_METERS) {
        cluster.push(other);
        used.add(other.id);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const apply = process.argv.includes('--apply');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // ── 1. Load duplicate groups from enrichment results ──────────────────────
  const resultsPath = join(process.cwd(), 'output', 'enrichment', 'enrichment_results.json');
  const enrichmentData = JSON.parse(readFileSync(resultsPath, 'utf8'));
  const dupGroups: DupGroup[] = enrichmentData.duplicates;

  const allGroupIds = [...new Set(dupGroups.flatMap(g => g.ids))];
  log(`Loaded ${dupGroups.length} duplicate groups — ${allGroupIds.length} unique farm IDs`);

  // ── 2. Fetch farm metadata by UUID from farms table ───────────────────────
  log('Fetching farm metadata from DB...');
  const { data: metaRows, error: metaErr } = await supabase
    .from('farms')
    .select('id, name, osm_id, city, source, enrichment_source, image, phone, website, email, description, opening_hours, facebook, instagram')
    .in('id', allGroupIds);

  if (metaErr) { console.error('Metadata fetch failed:', metaErr); process.exit(1); }
  log(`Fetched metadata for ${metaRows!.length} farms`);

  // ── 3. Fetch coordinates via RPC (returns osm_id → lat/lng) ──────────────
  log('Fetching coordinates via RPC...');
  const coordMap = new Map<string, { lat: number; lng: number }>();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase.rpc('get_farms_with_coords').range(from, from + PAGE - 1);
    if (error) { console.error('RPC error:', error); process.exit(1); }
    if (!data || data.length === 0) break;
    for (const row of data as { osm_id: string; lat: number; lng: number }[]) {
      coordMap.set(row.osm_id, { lat: row.lat, lng: row.lng });
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  log(`Coordinate map built for ${coordMap.size} farms`);

  // ── 4. Build unified farm map: id → FarmRow ───────────────────────────────
  const farmById = new Map<string, FarmRow>();
  for (const row of metaRows!) {
    const coords = coordMap.get(row.osm_id) ?? { lat: null, lng: null };
    farmById.set(row.id, { ...(row as Omit<FarmRow, 'lat' | 'lng'>), ...coords });
  }

  // ── 5. Analyse each duplicate group ───────────────────────────────────────
  const plan: GroupPlan[] = [];
  let totalToDelete = 0;

  for (const group of dupGroups) {
    const farms = group.ids.map(id => farmById.get(id)).filter((f): f is FarmRow => f !== undefined);

    // Cluster farms that are physically near each other
    const clusters = clusterByProximity(farms);

    const trueDupSubgroups: SubgroupPlan[] = [];
    const falsePositives: GroupPlan['false_positive_farms'] = [];

    for (const cluster of clusters) {
      if (cluster.length < 2) {
        falsePositives.push(...cluster.map(f => ({ id: f.id, name: f.name, lat: f.lat, lng: f.lng })));
        continue;
      }

      // Sort by score descending — highest score wins
      cluster.sort((a, b) => scoreFarm(b) - scoreFarm(a));
      const winner = cluster[0];
      const losers = cluster.slice(1);

      let maxDist = 0;
      for (let i = 0; i < cluster.length; i++) {
        for (let j = i + 1; j < cluster.length; j++) {
          const a = cluster[i], b = cluster[j];
          if (a.lat != null && b.lat != null) {
            maxDist = Math.max(maxDist, haversineMeters(a.lat, a.lng!, b.lat, b.lng!));
          }
        }
      }

      trueDupSubgroups.push({
        winner: { id: winner.id, name: winner.name, osm_id: winner.osm_id, source: winner.source, score: scoreFarm(winner) },
        losers: losers.map(l => ({ id: l.id, name: l.name, osm_id: l.osm_id, source: l.source, score: scoreFarm(l) })),
        merge_update: buildMerge(winner, losers),
        max_distance_m: Math.round(maxDist),
      });
      totalToDelete += losers.length;
    }

    plan.push({
      group_name: group.name,
      group_city: group.city,
      true_dup_subgroups: trueDupSubgroups,
      false_positive_farms: falsePositives,
      notes: trueDupSubgroups.length === 0
        ? `All ${farms.length} farms are at different locations — no deletions needed`
        : `${trueDupSubgroups.length} location cluster(s) identified`,
    });
  }

  // ── 6. Save plan ──────────────────────────────────────────────────────────
  mkdirSync(OUT_DIR, { recursive: true });
  const planPath = join(OUT_DIR, 'dedupe_plan.json');
  writeFileSync(planPath, JSON.stringify(plan, null, 2));
  log(`Plan saved → ${planPath}`);

  // ── 7. Print report ───────────────────────────────────────────────────────
  const actionable = plan.filter(g => g.true_dup_subgroups.length > 0);
  const fpOnly     = plan.filter(g => g.true_dup_subgroups.length === 0);
  const totalFarms = (enrichmentData.metadata as { total_farms_in_db: number }).total_farms_in_db;

  const line = '═'.repeat(68);
  console.log('\n' + line);
  console.log('  DUPLICATE FARM ANALYSIS REPORT');
  console.log(line);
  console.log(`  Duplicate groups from enrichment      : ${dupGroups.length}`);
  console.log(`  Groups with real location duplicates  : ${actionable.length}`);
  console.log(`  Groups that are false positives       : ${fpOnly.length}`);
  console.log(`  Farms to be deleted                   : ${totalToDelete}`);
  console.log(`  Current farm count                    : ${totalFarms}`);
  console.log(`  Projected count after dedup           : ${totalFarms - totalToDelete}`);
  console.log(line);

  if (actionable.length > 0) {
    console.log('\n  TRUE DUPLICATES — will be merged then deleted\n');
    for (const g of actionable) {
      for (const sg of g.true_dup_subgroups) {
        console.log(`  Group: "${g.group_name}" / ${g.group_city || '(no city)'} — within ${sg.max_distance_m}m`);
        console.log(`    ✓ KEEP   [score ${String(sg.winner.score).padStart(3)}] ${sg.winner.name} — ${sg.winner.osm_id}`);
        for (const l of sg.losers) {
          console.log(`    ✗ DELETE [score ${String(l.score).padStart(3)}] ${l.name} — ${l.osm_id}`);
        }
        if (sg.merge_update) {
          console.log(`    ↑ Copy to winner: ${Object.keys(sg.merge_update).join(', ')}`);
        }
      }
    }
  }

  if (fpOnly.length > 0) {
    console.log('\n  FALSE POSITIVES — same name, different locations, no action\n');
    for (const g of fpOnly) {
      console.log(`  "${g.group_name}" / ${g.group_city || '(no city)'} — ${g.false_positive_farms.length} farms at distinct locations, all kept`);
    }
  }

  console.log('\n' + line);
  if (!apply) {
    console.log('  DRY RUN — no changes made.');
    console.log(`  Review plan at: output/dedupe/dedupe_plan.json`);
    console.log(`  Re-run with --apply to execute.\n`);
    return;
  }

  // ── 8. Apply ──────────────────────────────────────────────────────────────
  console.log('\n  APPLYING changes...\n');
  let mergedCount = 0, deletedCount = 0, errorCount = 0;

  for (const g of actionable) {
    for (const sg of g.true_dup_subgroups) {
      // Merge missing fields into winner first
      if (sg.merge_update) {
        const { error } = await supabase.from('farms').update(sg.merge_update).eq('id', sg.winner.id);
        if (error) {
          console.error(`  ERROR merging into ${sg.winner.name} (${sg.winner.id}):`, error.message);
          errorCount++;
        } else {
          log(`  Merged [${Object.keys(sg.merge_update).join(', ')}] → ${sg.winner.name}`);
          mergedCount++;
        }
      }

      // Delete losers
      for (const loser of sg.losers) {
        const { error } = await supabase.from('farms').delete().eq('id', loser.id);
        if (error) {
          console.error(`  ERROR deleting ${loser.name} (${loser.id}):`, error.message);
          errorCount++;
        } else {
          log(`  Deleted ${loser.name} (${loser.osm_id})`);
          deletedCount++;
        }
      }
    }
  }

  // Save apply log
  const applyLog = { applied_at: new Date().toISOString(), merged: mergedCount, deleted: deletedCount, errors: errorCount, projected_count: totalFarms - deletedCount };
  writeFileSync(join(OUT_DIR, 'dedupe_apply_log.json'), JSON.stringify(applyLog, null, 2));

  console.log('\n' + line);
  console.log('  APPLY COMPLETE');
  console.log(`  Fields merged into winners  : ${mergedCount}`);
  console.log(`  Duplicate farms deleted     : ${deletedCount}`);
  console.log(`  Errors                      : ${errorCount}`);
  console.log(`  Final farm count            : ${totalFarms - deletedCount}`);
  console.log(line + '\n');
}

main().catch(err => { console.error(err); process.exit(1); });
