/**
 * remove-out-of-bounds.js
 * Finds and deletes farms with coordinates outside the NL/BE bounding box.
 * Bounding box: lat 48–55, lng 2–8
 */

require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const LAT_MIN = 48.0, LAT_MAX = 55.0;
const LNG_MIN = 2.0,  LNG_MAX = 8.0;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function region(lat, lng) {
  if (lat >= 5 && lat <= 25 && lng >= -90 && lng <= -55) return 'Caribbean';
  if (lat >= -60 && lat < 15 && lng >= -82 && lng <= -34) return 'South America';
  if (lat >= -35 && lat <= 5 && lng >= 10 && lng <= 55) return 'Africa';
  if (lat >= 5 && lat <= 40 && lng >= 55 && lng <= 150) return 'Asia';
  if (lat >= -50 && lat <= 5 && lng >= 110 && lng <= 180) return 'Oceania';
  if (lat >= 24 && lat <= 50 && lng >= -130 && lng <= -55) return 'North America';
  if (lat >= -90 && lat < -55) return 'Antarctica';
  if (lat > 55 || lat < 48) return 'Europe (out of NL/BE range)';
  return 'Unknown';
}

async function main() {
  // ── 1. Fetch all coordinates via RPC ─────────────────────────────────────
  const coordMap = new Map();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb.rpc('get_farms_with_coords').range(from, from + PAGE - 1);
    if (error) { console.error('RPC error:', error); process.exit(1); }
    if (!data || data.length === 0) break;
    for (const row of data) coordMap.set(row.osm_id, { lat: row.lat, lng: row.lng });
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`Total farms with coordinates: ${coordMap.size}`);

  // ── 2. Filter outside bounding box ───────────────────────────────────────
  const outsideOsmIds = [];
  for (const [osm_id, { lat, lng }] of coordMap) {
    if (lat < LAT_MIN || lat > LAT_MAX || lng < LNG_MIN || lng > LNG_MAX) {
      outsideOsmIds.push({ osm_id, lat, lng });
    }
  }
  console.log(`Outside bounding box: ${outsideOsmIds.length}`);

  if (outsideOsmIds.length === 0) {
    console.log('\nNo out-of-bounds farms found.');
    const { count } = await sb.from('farms').select('id', { count: 'exact', head: true });
    console.log(`Current total: ${count}`);
    return;
  }

  // ── 3. Fetch farm details by osm_id (batched) ─────────────────────────────
  const allFarms = [];
  const BATCH = 500;
  for (let i = 0; i < outsideOsmIds.length; i += BATCH) {
    const chunk = outsideOsmIds.slice(i, i + BATCH).map(r => r.osm_id);
    const { data, error } = await sb.from('farms').select('id, name, city, osm_id').in('osm_id', chunk);
    if (error) { console.error('Fetch error:', error); process.exit(1); }
    if (data) allFarms.push(...data);
  }

  // Merge coordinates into farm records
  const farmsWithCoords = allFarms.map(f => {
    const c = coordMap.get(f.osm_id) || {};
    return { ...f, lat: c.lat, lng: c.lng };
  });

  // ── 4. Report ─────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  OUT-OF-BOUNDS FARMS');
  console.log('═══════════════════════════════════════════════════════════════════');

  const byRegion = {};
  for (const f of farmsWithCoords) {
    const r = region(f.lat, f.lng);
    if (!byRegion[r]) byRegion[r] = [];
    byRegion[r].push(f);
  }

  for (const [r, farms] of Object.entries(byRegion)) {
    console.log(`\n  ${r} (${farms.length} farm${farms.length > 1 ? 's' : ''}):`);
    for (const f of farms) {
      console.log(`    • ${f.name || '(unnamed)'} | ${f.city || '(no city)'} | lat=${f.lat?.toFixed(4)} lng=${f.lng?.toFixed(4)}`);
    }
  }

  // ── 5. Delete ─────────────────────────────────────────────────────────────
  const ids = farmsWithCoords.map(f => f.id);
  console.log(`\n  Deleting ${ids.length} farm(s)...`);

  let deleted = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const { error, count } = await sb.from('farms').delete({ count: 'exact' }).in('id', chunk);
    if (error) { console.error('Delete error:', error); process.exit(1); }
    deleted += count || chunk.length;
  }

  // ── 6. Final count ────────────────────────────────────────────────────────
  const { count: total, error: cntErr } = await sb.from('farms').select('id', { count: 'exact', head: true });
  if (cntErr) { console.error('Count error:', cntErr); }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  COMPLETE');
  console.log(`  Farms deleted           : ${deleted}`);
  console.log(`  Remaining farm count    : ${total}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

main().catch(err => { console.error(err); process.exit(1); });
