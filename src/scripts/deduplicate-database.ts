/**
 * deduplicate-database.ts
 *
 * Comprehensive deduplication across all farms in Supabase.
 * Detects GPS-proximity duplicates (within 50 m) across all sources,
 * merges data from duplicates into the best entry, then removes the rest.
 *
 * SOURCE PRIORITY (highest trust first):
 *   TRACES → Foursquare → Overture → OSM → other
 *   Google Places enrichment earns a +100 bonus on top.
 *
 * MODES:
 *   Dry run (default) — analyse, print report, save JSON, no DB changes
 *   npx ts-node -P tsconfig.scripts.json src/scripts/deduplicate-database.ts
 *
 *   Apply — execute merges + deletions
 *   npx ts-node -P tsconfig.scripts.json src/scripts/deduplicate-database.ts --apply
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ─── Config ───────────────────────────────────────────────────────────────────

const PROXIMITY_METERS = 25;    // farms within this distance = same physical location
const NAME_SIM_THRESHOLD = 0.70; // name similarity must exceed this (0–1) to merge
const PAGE_SIZE        = 1000;  // Supabase pagination size
const OUT_DIR          = join(process.cwd(), 'output', 'dedupe');
const REPORT_PATH      = join(process.cwd(), 'data', 'deduplication_dry_run_report.json');

// ─── Types ────────────────────────────────────────────────────────────────────

interface FarmRow {
  id:                string;
  osm_id:            string;
  name:              string;
  city:              string | null;
  address:           string | null;
  source:            string | null;
  enrichment_source: string | null;
  image:             string | null;
  phone:             string | null;
  website:           string | null;
  email:             string | null;
  description:       string | null;
  opening_hours:     string | null;
  facebook:          string | null;
  instagram:         string | null;
  lat:               number | null;
  lng:               number | null;
}

type MergeUpdate = Partial<Pick<FarmRow,
  'phone' | 'website' | 'email' | 'description' | 'opening_hours' |
  'facebook' | 'instagram' | 'image' | 'address'
>>;

interface MergePlan {
  winner:           { id: string; name: string; osm_id: string; source: string | null; score: number };
  losers:           { id: string; name: string; osm_id: string; source: string | null; score: number; name_sim: number }[];
  merge_update:     MergeUpdate | null;
  max_distance_m:   number;
  sources_involved: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R    = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Score a farm entry — higher score = better primary candidate.
 * Source trust priority + Google enrichment bonus + data completeness.
 */
function scoreFarm(f: FarmRow): number {
  let s = 0;
  const src = (f.source ?? '').toLowerCase();
  if      (src.includes('traces'))      s += 40;
  else if (src.includes('foursquare'))  s += 30;
  else if (src.includes('overture'))    s += 20;
  else if (src.includes('osm'))         s += 10;

  if (f.enrichment_source === 'google_places') s += 100;

  if (f.image)         s += 20;
  if (f.phone)         s += 10;
  if (f.website)       s += 10;
  if (f.opening_hours) s += 10;
  if (f.description)   s += 10;
  if (f.email)         s +=  5;
  if (f.facebook)      s +=  3;
  if (f.instagram)     s +=  3;
  return s;
}

const MERGE_FIELDS: (keyof MergeUpdate)[] = [
  'phone', 'website', 'email', 'description', 'opening_hours',
  'facebook', 'instagram', 'image', 'address',
];

/** Copy non-null fields from losers into winner only where winner is missing them. */
function buildMerge(winner: FarmRow, losers: FarmRow[]): MergeUpdate | null {
  const update: MergeUpdate = {};
  for (const loser of losers) {
    for (const field of MERGE_FIELDS) {
      if (!winner[field] && loser[field]) {
        (update as Record<string, unknown>)[field] = loser[field];
      }
    }
  }
  return Object.keys(update).length > 0 ? update : null;
}

// ─── Name similarity (Levenshtein ratio) ─────────────────────────────────────

/** Normalise a farm name for comparison — lowercase, strip punctuation/legal suffixes. */
function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(bv|b\.v\.|vof|v\.o\.f\.|nv|vzw|maatschap|mts|fa\.|gebr\.|boerderij|hoeve|kwekerij|winkel)\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein edit distance between two strings. */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

/** Similarity ratio 0–1 (1 = identical). */
function nameSimilarity(a: string, b: string): number {
  const na = normaliseName(a);
  const nb = normaliseName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  return 1 - levenshtein(na, nb) / maxLen;
}

// ─── Spatial clustering ───────────────────────────────────────────────────────
//
// Grid cell = 0.001° ≈ 111 m per cell side.
// Checking a 3×3 neighbourhood covers a 333 m search radius, well beyond 25 m.
// This reduces proximity checks from O(n²) to O(n) in practice.
//
// BOTH conditions must be true to merge:
//   1. haversine distance ≤ PROXIMITY_METERS (25 m)
//   2. name similarity   ≥ NAME_SIM_THRESHOLD (0.70)

function gridKey(lat: number, lng: number): string {
  return `${Math.floor(lat * 1000)},${Math.floor(lng * 1000)}`;
}

function findDuplicateClusters(farms: FarmRow[]): FarmRow[][] {
  const farmsWithCoords = farms.filter(f => f.lat != null && f.lng != null);

  // Build spatial grid
  const grid = new Map<string, FarmRow[]>();
  for (const f of farmsWithCoords) {
    const k = gridKey(f.lat!, f.lng!);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k)!.push(f);
  }

  const visited  = new Set<string>();
  const clusters: FarmRow[][] = [];

  for (const seed of farmsWithCoords) {
    if (visited.has(seed.id)) continue;

    const cluster: FarmRow[] = [seed];
    visited.add(seed.id);

    const sLat = Math.floor(seed.lat! * 1000);
    const sLng = Math.floor(seed.lng! * 1000);

    for (let dLat = -1; dLat <= 1; dLat++) {
      for (let dLng = -1; dLng <= 1; dLng++) {
        const neighborKey = `${sLat + dLat},${sLng + dLng}`;
        for (const candidate of (grid.get(neighborKey) ?? [])) {
          if (visited.has(candidate.id)) continue;
          const dist = haversineMeters(
            seed.lat!, seed.lng!,
            candidate.lat!, candidate.lng!,
          );
          if (dist > PROXIMITY_METERS) continue;
          const sim = nameSimilarity(seed.name, candidate.name);
          if (sim < NAME_SIM_THRESHOLD) continue;
          cluster.push(candidate);
          visited.add(candidate.id);
        }
      }
    }

    if (cluster.length > 1) clusters.push(cluster);
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

  // ── 1. Fetch all farm metadata (paginated) ──────────────────────────────────
  log('Fetching all farm metadata…');
  const allFarms: FarmRow[] = [];
  let metaFrom = 0;
  while (true) {
    const { data, error } = await supabase
      .from('farms')
      .select('id, osm_id, name, city, address, source, enrichment_source, image, phone, website, email, description, opening_hours, facebook, instagram')
      .range(metaFrom, metaFrom + PAGE_SIZE - 1);

    if (error) { console.error('Metadata fetch error:', error); process.exit(1); }
    if (!data || data.length === 0) break;

    for (const row of data as Omit<FarmRow, 'lat' | 'lng'>[]) {
      allFarms.push({ ...row, lat: null, lng: null });
    }
    if (data.length < PAGE_SIZE) break;
    metaFrom += PAGE_SIZE;
    if (metaFrom % 5000 === 0) log(`  …${metaFrom} metadata rows fetched`);
  }
  log(`Loaded ${allFarms.length} farms from metadata`);

  // ── 2. Fetch coordinates via RPC ────────────────────────────────────────────
  log('Fetching coordinates via RPC…');
  const coordMap = new Map<string, { lat: number; lng: number }>();
  let coordFrom = 0;
  while (true) {
    const { data, error } = await supabase
      .rpc('get_farms_with_coords')
      .range(coordFrom, coordFrom + PAGE_SIZE - 1);

    if (error) { console.error('RPC error:', error); process.exit(1); }
    if (!data || data.length === 0) break;
    for (const row of data as { osm_id: string; lat: number; lng: number }[]) {
      coordMap.set(row.osm_id, { lat: row.lat, lng: row.lng });
    }
    if (data.length < PAGE_SIZE) break;
    coordFrom += PAGE_SIZE;
    if (coordFrom % 5000 === 0) log(`  …${coordFrom} coord rows fetched`);
  }
  log(`Coordinate map built for ${coordMap.size} farms`);

  // ── 3. Join coordinates → FarmRow ───────────────────────────────────────────
  for (const f of allFarms) {
    const coords = coordMap.get(f.osm_id);
    if (coords) { f.lat = coords.lat; f.lng = coords.lng; }
  }
  const withCoords = allFarms.filter(f => f.lat != null).length;
  log(`${withCoords} / ${allFarms.length} farms have coordinates`);

  // ── 4. Source distribution ──────────────────────────────────────────────────
  const sourceCount: Record<string, number> = {};
  for (const f of allFarms) {
    const s = f.source ?? 'unknown';
    sourceCount[s] = (sourceCount[s] ?? 0) + 1;
  }

  // ── 5. Find duplicate clusters ──────────────────────────────────────────────
  log(`Finding duplicate clusters (≤${PROXIMITY_METERS} m AND name sim ≥${NAME_SIM_THRESHOLD * 100}%)…`);
  const clusters = findDuplicateClusters(allFarms);
  log(`Found ${clusters.length} duplicate groups`);

  // ── 6. Build merge plans ────────────────────────────────────────────────────
  const plans: MergePlan[] = [];
  let totalToDelete = 0;

  for (const cluster of clusters) {
    cluster.sort((a, b) => scoreFarm(b) - scoreFarm(a));
    const winner = cluster[0];
    const losers = cluster.slice(1);

    let maxDist = 0;
    for (let i = 0; i < cluster.length; i++) {
      for (let j = i + 1; j < cluster.length; j++) {
        const a = cluster[i], b = cluster[j];
        if (a.lat != null && b.lat != null) {
          maxDist = Math.max(
            maxDist,
            haversineMeters(a.lat!, a.lng!, b.lat!, b.lng!),
          );
        }
      }
    }

    const sourcesInvolved = [...new Set(cluster.map(f => f.source ?? 'unknown'))].sort();

    plans.push({
      winner:           { id: winner.id, name: winner.name, osm_id: winner.osm_id, source: winner.source, score: scoreFarm(winner) },
      losers:           losers.map(l => ({ id: l.id, name: l.name, osm_id: l.osm_id, source: l.source, score: scoreFarm(l), name_sim: parseFloat(nameSimilarity(winner.name, l.name).toFixed(2)) })),
      merge_update:     buildMerge(winner, losers),
      max_distance_m:   Math.round(maxDist),
      sources_involved: sourcesInvolved,
    });
    totalToDelete += losers.length;
  }

  // ── 7. Source-pair breakdown ────────────────────────────────────────────────
  const pairCounts: Record<string, number> = {};
  for (const plan of plans) {
    const key = plan.sources_involved.join(' + ');
    pairCounts[key] = (pairCounts[key] ?? 0) + 1;
  }

  // ── 8. Quality improvement tallies ─────────────────────────────────────────
  let gainsPhone = 0, gainsWebsite = 0, gainsAddress = 0, gainsDesc = 0;
  for (const plan of plans) {
    if (plan.merge_update?.phone)       gainsPhone++;
    if (plan.merge_update?.website)     gainsWebsite++;
    if (plan.merge_update?.address)     gainsAddress++;
    if (plan.merge_update?.description) gainsDesc++;
  }

  // ── 9. Console report ───────────────────────────────────────────────────────
  const bar = '═'.repeat(72);
  console.log('\n' + bar);
  console.log('  FARMSY DATABASE DEDUPLICATION REPORT');
  console.log(bar);
  console.log(`  Total farms in DB              : ${allFarms.length.toLocaleString()}`);
  console.log(`  Farms with coordinates         : ${withCoords.toLocaleString()}`);
  console.log(`  Duplicate groups found         : ${plans.length.toLocaleString()}`);
  console.log(`  Farms to delete                : ${totalToDelete.toLocaleString()}`);
  console.log(`  Projected count after dedup    : ${(allFarms.length - totalToDelete).toLocaleString()}`);
  console.log(`  Reduction                      : ${((totalToDelete / allFarms.length) * 100).toFixed(1)}%`);

  console.log('\n  SOURCE DISTRIBUTION\n');
  for (const [src, cnt] of Object.entries(sourceCount).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${src.padEnd(32)} ${cnt.toLocaleString()}`);
  }

  console.log('\n  SOURCE-PAIR OVERLAP (top 15)\n');
  for (const [pair, cnt] of Object.entries(pairCounts).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${pair.padEnd(50)} ${cnt} groups`);
  }

  console.log('\n  QUALITY IMPROVEMENTS FROM MERGE\n');
  console.log(`  Farms gaining phone numbers    : ${gainsPhone}`);
  console.log(`  Farms gaining websites         : ${gainsWebsite}`);
  console.log(`  Farms gaining addresses        : ${gainsAddress}`);
  console.log(`  Farms gaining descriptions     : ${gainsDesc}`);

  console.log('\n  SAMPLE MERGES (first 20)\n');
  for (const plan of plans.slice(0, 20)) {
    console.log('  ──');
    console.log(`  ✓ KEEP   [${String(plan.winner.score).padStart(3)}] ${plan.winner.name}  (${plan.winner.source ?? 'unknown'})`);
    for (const l of plan.losers) {
      console.log(`  ✗ DELETE [${String(l.score).padStart(3)}] ${l.name}  (${l.source ?? 'unknown'})  ${plan.max_distance_m}m  sim:${(l.name_sim * 100).toFixed(0)}%`);
    }
    if (plan.merge_update) {
      console.log(`  ↑ Copy to winner: ${Object.keys(plan.merge_update).join(', ')}`);
    }
  }

  // ── 10. Save report ─────────────────────────────────────────────────────────
  mkdirSync(OUT_DIR, { recursive: true });

  const report = {
    generated_at:   new Date().toISOString(),
    proximity_threshold_m: PROXIMITY_METERS,
    summary: {
      total_farms:           allFarms.length,
      farms_with_coordinates: withCoords,
      duplicate_groups:      plans.length,
      farms_to_delete:       totalToDelete,
      projected_count:       allFarms.length - totalToDelete,
      reduction_percent:     parseFloat(((totalToDelete / allFarms.length) * 100).toFixed(1)),
    },
    source_distribution:   sourceCount,
    source_pair_overlap:   pairCounts,
    quality_improvements:  { gains_phone: gainsPhone, gains_website: gainsWebsite, gains_address: gainsAddress, gains_description: gainsDesc },
    sample_merges:         plans.slice(0, 50),
    // Full plan is written separately (may be large)
  };

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  writeFileSync(join(OUT_DIR, 'global_dedupe_plan.json'), JSON.stringify(plans, null, 2));
  log(`Report saved → ${REPORT_PATH}`);
  log(`Full plan  saved → ${OUT_DIR}/global_dedupe_plan.json`);

  console.log('\n' + bar);
  if (!apply) {
    console.log('  DRY RUN — no changes made to the database.');
    console.log(`  Review: data/deduplication_dry_run_report.json`);
    console.log(`  Full plan: output/dedupe/global_dedupe_plan.json`);
    console.log(`  Re-run with --apply to execute.\n`);
    return;
  }

  // ── 11. Apply ───────────────────────────────────────────────────────────────
  console.log('\n  APPLYING changes…\n');
  let mergedCount = 0, deletedCount = 0, errorCount = 0;

  for (const plan of plans) {
    // Merge missing fields into winner first
    if (plan.merge_update) {
      const { error } = await supabase
        .from('farms')
        .update(plan.merge_update)
        .eq('id', plan.winner.id);

      if (error) {
        console.error(`  ERROR merging into ${plan.winner.name} (${plan.winner.id}):`, error.message);
        errorCount++;
      } else {
        mergedCount++;
      }
    }

    // Delete losers one by one (allows partial progress on error)
    for (const loser of plan.losers) {
      const { error } = await supabase
        .from('farms')
        .delete()
        .eq('id', loser.id);

      if (error) {
        console.error(`  ERROR deleting ${loser.name} (${loser.id}):`, error.message);
        errorCount++;
      } else {
        deletedCount++;
        if (deletedCount % 100 === 0) log(`  …${deletedCount} duplicates deleted`);
      }
    }
  }

  const applyLog = {
    applied_at:     new Date().toISOString(),
    farms_before:   allFarms.length,
    fields_merged:  mergedCount,
    farms_deleted:  deletedCount,
    errors:         errorCount,
    farms_after:    allFarms.length - deletedCount,
  };
  writeFileSync(join(OUT_DIR, 'dedupe_apply_log.json'), JSON.stringify(applyLog, null, 2));

  console.log('\n' + bar);
  console.log('  APPLY COMPLETE');
  console.log(`  Farms before        : ${allFarms.length.toLocaleString()}`);
  console.log(`  Fields merged       : ${mergedCount}`);
  console.log(`  Duplicates deleted  : ${deletedCount}`);
  console.log(`  Errors              : ${errorCount}`);
  console.log(`  Final count         : ${(allFarms.length - deletedCount).toLocaleString()}`);
  console.log(bar + '\n');
}

main().catch(err => { console.error(err); process.exit(1); });
