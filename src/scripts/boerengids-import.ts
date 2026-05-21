/**
 * Boerengids.nl — Dutch organic farm shop scraper + Supabase importer
 *
 * Scrapes ~700 biological farm shops from boerengids.nl, geocodes with PDOK,
 * deduplicates against the existing De Lokale Boer database, and imports new farms.
 *
 * Usage:
 *   npm run import:boerengids          → scrape all pages, geocode, save JSON
 *   npm run import:boerengids:save     → load JSON → deduplicate → upsert into Supabase
 *
 * Output files (output/boerengids/):
 *   raw_slugs.json        — slugs collected from 46 index pages
 *   raw_farms.json        — parsed detail data for each farm
 *   geocoded_farms.json   — with PDOK lat/lng added
 *   extraction_report.json — stats summary
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { parse as parseHtml } from 'node-html-parser';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = 'https://boerengids.nl';
const INDEX_BASE = `${BASE_URL}/biologische-boerderijwinkels`;
const FARM_BASE = `${BASE_URL}/boerderij`;
const TOTAL_PAGES = 46;
const DELAY_MS = 1500;           // be polite: 1.5 s between requests
const PDOK_DELAY_MS = 500;       // PDOK geocoder: 500 ms between requests
const GEOCODE_BASE = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
const USER_AGENT = 'Mozilla/5.0 (compatible; De Lokale Boer Crawler; +https://delokaleboer.nl)';
const OUT_DIR = join(process.cwd(), 'output', 'boerengids');

// ─── Types ────────────────────────────────────────────────────────────────────

interface SlugEntry {
  slug: string;
  name: string;
  city: string | null;
  province: string | null;
  url: string;
}

interface OpeningHours {
  monday:    string | null;
  tuesday:   string | null;
  wednesday: string | null;
  thursday:  string | null;
  friday:    string | null;
  saturday:  string | null;
  sunday:    string | null;
}

interface RawFarm {
  slug:              string;
  source_url:        string;
  name:              string;
  address:           string | null;
  city:              string | null;
  province:          string | null;
  postal_code:       string | null;
  phone:             string | null;
  email:             string | null;
  website:           string | null;
  description:       string | null;
  product_categories: string[];
  opening_hours:     OpeningHours;
  facebook:          string | null;
  instagram:         string | null;
  certification:     string | null;
  verified:          boolean;
}

interface GeocodedFarm extends RawFarm {
  lat:               number | null;
  lng:               number | null;
  geocode_query:     string | null;
  geocode_source:    'pdok' | 'city_only' | 'failed';
}

// ─── Product category → farm_type mapping ─────────────────────────────────────

type FarmType = 'dairy' | 'eggs' | 'meat' | 'fish' | 'produce' | 'honey' | 'wine';

const CATEGORY_MAP: Array<{ pattern: RegExp; type: FarmType }> = [
  { pattern: /kaas|zuivel|melk|brie|geit|schaap|butter|boerenkaas/i,   type: 'dairy'   },
  { pattern: /eier|kip\b/i,                                             type: 'eggs'    },
  { pattern: /rundvlees|varkensvlees|lamsvlees|vlees|kip|gehakt|worst|ham|spek|kalf/i, type: 'meat' },
  { pattern: /vis\b|zeevruchten|schaal/i,                               type: 'fish'    },
  { pattern: /honing/i,                                                  type: 'honey'   },
  { pattern: /wijn|bier|cider|jenever/i,                                type: 'wine'    },
  { pattern: /groenten?|fruit|aardappel|meel|brood|graan|noten|jam|sap|paddenstoel|asperges?|bessen|tomaat|pompoen|ui|peen|wortel|prei|kool|sla/i, type: 'produce' },
];

function mapCategories(categories: string[]): FarmType[] {
  const result = new Set<FarmType>();
  for (const cat of categories) {
    for (const { pattern, type } of CATEGORY_MAP) {
      if (pattern.test(cat)) result.add(type);
    }
  }
  return Array.from(result);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string, level: 'info' | 'warn' | 'error' | 'ok' = 'info') {
  const prefix = { info: '[INFO]', warn: '[WARN]', error: '[ERR ]', ok: '[OK  ]' }[level];
  console.log(`${new Date().toISOString().slice(11, 19)} ${prefix} ${msg}`);
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPage(url: string, retries = 3): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' },
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === retries) {
        log(`Failed fetching ${url}: ${err}`, 'warn');
        return null;
      }
      await sleep(3000 * attempt);
    }
  }
  return null;
}

// ─── Phase 1: Scrape index pages → collect slugs ─────────────────────────────

async function scrapeIndexPages(): Promise<SlugEntry[]> {
  const slugs: SlugEntry[] = [];
  const seenSlugs = new Set<string>();

  log(`Scraping ${TOTAL_PAGES} index pages…`);

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const url = page === 1 ? `${INDEX_BASE}/` : `${INDEX_BASE}/page/${page}/`;
    log(`  Page ${page}/${TOTAL_PAGES}: ${url}`);

    const html = await fetchPage(url);
    if (!html) {
      log(`  Page ${page}: no content, skipping`, 'warn');
      continue;
    }

    const root = parseHtml(html);

    // Find all links matching /boerderij/{slug}/ pattern
    const links = root.querySelectorAll('a[href*="/boerderij/"]');
    let pageCount = 0;

    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      const match = href.match(/\/boerderij\/([^/]+)\//);
      if (!match) continue;
      const slug = match[1];
      if (seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);

      // Try to get name and city from surrounding context
      const card = link.closest('.listing-item, .farm-card, article, .post, li, .entry') ?? link;
      const nameEl = card.querySelector('h2, h3, h4, .listing-title, .entry-title, strong') ?? link;
      const name = nameEl.text.trim().replace(/\s+/g, ' ') || slug;
      const cityEl = card.querySelector('.listing-location__city, .city, .location');
      const city = cityEl?.text.trim() || null;
      const provEl = card.querySelector('.listing-location__region, .province, .region');
      const province = provEl?.text.trim() || null;

      slugs.push({ slug, name, city, province, url: `${FARM_BASE}/${slug}/` });
      pageCount++;
    }

    log(`  Page ${page}: found ${pageCount} new slugs (total: ${slugs.length})`);
    await sleep(DELAY_MS);
  }

  log(`Index scraping complete: ${slugs.length} unique slugs`, 'ok');
  return slugs;
}

// ─── Phase 2: Scrape each farm detail page ────────────────────────────────────

function parseOpeningHours(root: ReturnType<typeof parseHtml>): OpeningHours {
  const hours: OpeningHours = {
    monday: null, tuesday: null, wednesday: null, thursday: null,
    friday: null, saturday: null, sunday: null,
  };

  const dayMap: Record<string, keyof OpeningHours> = {
    'maandag':  'monday',    'monday':    'monday',    'ma': 'monday',
    'dinsdag':  'tuesday',   'tuesday':   'tuesday',   'di': 'tuesday',
    'woensdag': 'wednesday', 'wednesday': 'wednesday', 'wo': 'wednesday',
    'donderdag':'thursday',  'thursday':  'thursday',  'do': 'thursday',
    'vrijdag':  'friday',    'friday':    'friday',    'vr': 'friday',
    'zaterdag': 'saturday',  'saturday':  'saturday',  'za': 'saturday',
    'zondag':   'sunday',    'sunday':    'sunday',    'zo': 'sunday',
  };

  // Try table rows
  const rows = root.querySelectorAll('table tr, .opening-hours tr, .openingstijden tr');
  for (const row of rows) {
    const cells = row.querySelectorAll('td, th');
    if (cells.length < 2) continue;
    const dayText = cells[0].text.trim().toLowerCase().replace(/[.:]/g, '');
    const timeText = cells[1].text.trim();
    const day = dayMap[dayText];
    if (day && timeText && !/gesloten|closed/i.test(timeText)) {
      hours[day] = timeText;
    }
  }

  // Try definition lists
  const dts = root.querySelectorAll('dt');
  for (const dt of dts) {
    const dayText = dt.text.trim().toLowerCase().replace(/[.:]/g, '');
    const day = dayMap[dayText];
    if (!day) continue;
    const dd = dt.nextElementSibling;
    if (dd && dd.tagName === 'DT') continue;
    const time = dd?.text.trim() ?? '';
    if (time && !/gesloten|closed/i.test(time)) hours[day] = time;
  }

  return hours;
}

async function scrapeFarmDetail(entry: SlugEntry): Promise<RawFarm | null> {
  const html = await fetchPage(entry.url);
  if (!html) return null;

  const root = parseHtml(html);

  // Name — prefer h1
  const h1 = root.querySelector('h1');
  const name = h1?.text.trim().replace(/\s+/g, ' ') || entry.name;

  // Address — look for structured location data
  const locationEl = root.querySelector('.listing-location, .farm-location, .address, [class*="location"]');
  let address: string | null = null;
  let city: string | null = entry.city;
  let province: string | null = entry.province;
  let postalCode: string | null = null;

  if (locationEl) {
    // Try specific sub-elements first
    const streetEl   = locationEl.querySelector('[class*="street"], [class*="address"], .street-address');
    const cityEl     = locationEl.querySelector('[class*="city"], [class*="plaats"]');
    const provEl     = locationEl.querySelector('[class*="region"], [class*="province"], [class*="state"]');
    const postalEl   = locationEl.querySelector('[class*="postal"], [class*="postcode"], [class*="zip"]');

    address    = streetEl?.text.trim() || null;
    city       = cityEl?.text.trim() || city;
    province   = provEl?.text.trim() || province;
    postalCode = postalEl?.text.trim() || null;

    // If no street el, parse the whole block
    if (!address) {
      const fullText = locationEl.text.replace(/\s+/g, ' ').trim();
      // Dutch address pattern: "Street 12, 1234 AB City"
      const addrMatch = fullText.match(/^([A-Za-zÀ-ÿ\s'.-]+\s+\d+[A-Za-z]?)/);
      if (addrMatch) address = addrMatch[1].trim();
      const pcMatch = fullText.match(/(\d{4}\s?[A-Z]{2})/);
      if (pcMatch) postalCode = pcMatch[1].replace(' ', '');
      const cityMatch = fullText.match(/\d{4}\s?[A-Z]{2}\s+([A-Za-zÀ-ÿ\s'-]+)/);
      if (cityMatch) city = cityMatch[1].trim();
    }
  }

  // Contact info
  const emailLink  = root.querySelector('a[href^="mailto:"]');
  const phoneLink  = root.querySelector('a[href^="tel:"]');
  const email  = emailLink?.getAttribute('href')?.replace('mailto:', '').trim() || null;
  const phone  = phoneLink?.getAttribute('href')?.replace('tel:', '').trim() || null;

  // Website — external link that isn't mailto/tel/boerengids
  let website: string | null = null;
  const allLinks = root.querySelectorAll('a[href^="http"]');
  for (const link of allLinks) {
    const href = link.getAttribute('href') ?? '';
    if (!href.includes('boerengids.nl') && !href.includes('facebook.com') &&
        !href.includes('instagram.com') && !href.includes('google.com') &&
        !href.includes('twitter.com') && !href.includes('youtube.com')) {
      website = href.split('?')[0].replace(/\/$/, '');
      break;
    }
  }

  // Description
  const descEl = root.querySelector('.listing-description, .farm-description, [class*="description"], .entry-content, .content');
  const description = descEl?.text.trim().replace(/\s+/g, ' ').slice(0, 1000) || null;

  // Product categories — tags, badges, categories
  const tagEls = root.querySelectorAll(
    '.listing-category, .farm-type, [class*="category"] a, [class*="tag"] a, ' +
    '.tags a, .categories a, [rel="tag"], [class*="badge"], [class*="label"]'
  );
  const productCategories = [...new Set(
    tagEls.map(el => el.text.trim()).filter(t => t.length > 1 && t.length < 60)
  )];

  // Opening hours
  const openingHours = parseOpeningHours(root);

  // Social media
  let facebook: string | null = null;
  let instagram: string | null = null;
  const fbLink = root.querySelector('a[href*="facebook.com"]');
  const igLink = root.querySelector('a[href*="instagram.com"]');
  if (fbLink) facebook = fbLink.getAttribute('href')?.split('?')[0] || null;
  if (igLink) instagram = igLink.getAttribute('href')?.split('?')[0] || null;

  // Certification
  const certEl = root.querySelector('[class*="certif"], [class*="biological"], [class*="organic"], [class*="bio"]');
  const certification = certEl?.text.trim().slice(0, 80) || 'Biologisch';

  // Verified badge
  const verified = !!root.querySelector('[class*="verified"], [class*="geverifieerd"]');

  return {
    slug: entry.slug,
    source_url: entry.url,
    name,
    address,
    city,
    province,
    postal_code: postalCode,
    phone,
    email,
    website,
    description,
    product_categories: productCategories,
    opening_hours: openingHours,
    facebook,
    instagram,
    certification,
    verified,
  };
}

async function scrapeAllFarms(slugs: SlugEntry[]): Promise<RawFarm[]> {
  const farms: RawFarm[] = [];
  let failed = 0;

  log(`Scraping ${slugs.length} farm detail pages…`);

  for (let i = 0; i < slugs.length; i++) {
    const entry = slugs[i];
    if ((i + 1) % 50 === 0 || i === 0) {
      log(`  Progress: ${i + 1}/${slugs.length} (${farms.length} parsed, ${failed} failed)`);
    }

    const farm = await scrapeFarmDetail(entry);
    if (farm) {
      farms.push(farm);
    } else {
      failed++;
      log(`  Failed: ${entry.slug}`, 'warn');
    }

    await sleep(DELAY_MS);
  }

  log(`Detail scraping complete: ${farms.length} farms, ${failed} failed`, 'ok');
  return farms;
}

// ─── Phase 3: Geocode with PDOK ───────────────────────────────────────────────

interface PdokResponse {
  response: { docs: Array<{ centroide_ll?: string }> };
}

async function geocodeAddress(address: string | null, city: string | null): Promise<{ lat: number; lng: number; query: string } | null> {
  const parts: string[] = [];
  if (address) parts.push(address.trim());
  if (city) parts.push(city.trim());
  if (parts.length === 0) return null;

  const query = parts.join(' ');
  const url = `${GEOCODE_BASE}?q=${encodeURIComponent(query)}&rows=1&fl=centroide_ll`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;

    const data = await res.json() as PdokResponse;
    const doc = data?.response?.docs?.[0];
    if (!doc?.centroide_ll) {
      // Retry with city only if address+city failed
      if (address && city) return geocodeAddress(null, city);
      return null;
    }

    // Format: "POINT(lng lat)"
    const m = doc.centroide_ll.match(/POINT\(([0-9.]+)\s+([0-9.]+)\)/);
    if (!m) return null;
    return { lat: parseFloat(m[2]), lng: parseFloat(m[1]), query };
  } catch {
    return null;
  }
}

async function geocodeAll(farms: RawFarm[]): Promise<GeocodedFarm[]> {
  const result: GeocodedFarm[] = [];
  let geocoded = 0, cityOnly = 0, failed = 0;

  log(`Geocoding ${farms.length} farms via PDOK…`);

  for (let i = 0; i < farms.length; i++) {
    const farm = farms[i];
    if ((i + 1) % 100 === 0) {
      log(`  Geocoded: ${i + 1}/${farms.length} (ok=${geocoded}, city-only=${cityOnly}, failed=${failed})`);
    }

    const geo = await geocodeAddress(farm.address, farm.city);
    await sleep(PDOK_DELAY_MS);

    if (geo) {
      const usedCity = !farm.address || geo.query === farm.city;
      result.push({
        ...farm,
        lat: geo.lat,
        lng: geo.lng,
        geocode_query: geo.query,
        geocode_source: usedCity ? 'city_only' : 'pdok',
      });
      if (usedCity) cityOnly++; else geocoded++;
    } else {
      result.push({ ...farm, lat: null, lng: null, geocode_query: null, geocode_source: 'failed' });
      failed++;
    }
  }

  log(`Geocoding complete: ${geocoded} precise, ${cityOnly} city-only, ${failed} failed`, 'ok');
  return result;
}

// ─── Phase 4: Supabase import ─────────────────────────────────────────────────

interface ExistingFarm {
  osm_id: string;
  name: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchExistingFarms(supabase: any): Promise<ExistingFarm[]> {
  const PAGE = 1000;
  const all: ExistingFarm[] = [];
  let from = 0;

  log('Loading existing farms from database…');

  while (true) {
    const { data, error } = await supabase
      .from('farms')
      .select('osm_id, name, city')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`DB fetch: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) all.push({ ...row, lat: null, lng: null });
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Load coords via RPC
  try {
    const { data: coordData, error: coordErr } = await supabase.rpc('get_farms_with_coords');
    if (!coordErr && coordData) {
      const coordMap = new Map<string, { lat: number; lng: number }>();
      for (const r of coordData as { osm_id: string; lat: number; lng: number }[]) {
        coordMap.set(r.osm_id, { lat: r.lat, lng: r.lng });
      }
      for (const farm of all) {
        const coords = coordMap.get(farm.osm_id);
        if (coords) { farm.lat = coords.lat; farm.lng = coords.lng; }
      }
    }
  } catch { /* coords not available — skip */ }

  log(`  Loaded ${all.length} existing farms`, 'ok');
  return all;
}

async function importToSupabase(farms: GeocodedFarm[]): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const existing = await fetchExistingFarms(supabase);

  // Build lookup sets
  const existingNameCity = new Set(
    existing
      .filter(e => e.name && e.city)
      .map(e => `${e.name!.toLowerCase().trim()}|${e.city!.toLowerCase().trim()}`)
  );
  const existingWithCoords = existing.filter(e => e.lat != null && e.lng != null);

  let skipNameCity  = 0;
  let skipCoord     = 0;
  let skipNoCoords  = 0;
  const toInsert: Array<Record<string, unknown>> = [];

  for (const farm of farms) {
    // Skip if no coordinates — can't place on map
    if (farm.lat == null || farm.lng == null) {
      skipNoCoords++;
      continue;
    }

    // Name+city dedup
    const ncKey = `${farm.name.toLowerCase().trim()}|${(farm.city ?? '').toLowerCase().trim()}`;
    if (existingNameCity.has(ncKey)) { skipNameCity++; continue; }

    // Coordinate dedup: within 100 m of existing farm
    const coordDup = existingWithCoords.some(e =>
      e.lat != null && haversineM(farm.lat!, farm.lng!, e.lat!, e.lng!) < 100
    );
    if (coordDup) { skipCoord++; continue; }

    const farmTypes = mapCategories(farm.product_categories);

    // Format opening hours as OSM-style string if any days have data
    const ohParts: string[] = [];
    const dayAbbr: [keyof OpeningHours, string][] = [
      ['monday', 'Mo'], ['tuesday', 'Tu'], ['wednesday', 'We'],
      ['thursday', 'Th'], ['friday', 'Fr'], ['saturday', 'Sa'], ['sunday', 'Su'],
    ];
    for (const [key, abbr] of dayAbbr) {
      if (farm.opening_hours[key]) ohParts.push(`${abbr} ${farm.opening_hours[key]}`);
    }
    const openingHoursStr = ohParts.length > 0 ? ohParts.join('; ') : null;

    toInsert.push({
      name:          farm.name,
      address:       farm.address,
      city:          farm.city,
      postal_code:   farm.postal_code,
      country:       'NL',
      location:      `POINT(${farm.lng} ${farm.lat})`,
      farm_type:     farmTypes.length > 0 ? farmTypes : null,
      website:       farm.website,
      phone:         farm.phone,
      email:         farm.email,
      description:   farm.description,
      facebook:      farm.facebook,
      instagram:     farm.instagram,
      opening_hours: openingHoursStr,
      source:        'boerengids',
      osm_id:        `boerengids/${farm.slug}`,
      is_published:  true,
      primary_tag:   'farm_shop',
    });
  }

  log('');
  log('── Deduplication summary ────────────────────────────────────────────────');
  log(`  Total geocoded farms:     ${farms.length}`);
  log(`  Skipped (no coords):      ${skipNoCoords}`);
  log(`  Skipped (name+city dup):  ${skipNameCity}`);
  log(`  Skipped (within 100m):    ${skipCoord}`);
  log(`  New farms to insert:      ${toInsert.length}`);
  log('─────────────────────────────────────────────────────────────────────────');

  if (toInsert.length === 0) {
    log('Nothing new to insert.', 'warn');
    return;
  }

  // Upsert in batches
  const BATCH = 100;
  let saved = 0;

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { error } = await supabase
      .from('farms')
      .upsert(batch, { onConflict: 'osm_id', ignoreDuplicates: false });
    if (error) throw new Error(`Batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
    saved += batch.length;
    log(`  Upserted ${saved}/${toInsert.length}…`);
    await sleep(100);
  }

  const { count } = await supabase.from('farms').select('*', { count: 'exact', head: true });
  log('');
  log('── Import complete ──────────────────────────────────────────────────────', 'ok');
  log(`  New farms inserted:       ${saved}`);
  log(`  Total farms in database:  ${count ?? '?'}`, 'ok');
  log('─────────────────────────────────────────────────────────────────────────');
}

// ─── Output helpers ───────────────────────────────────────────────────────────

function saveJson(filename: string, data: unknown) {
  mkdirSync(OUT_DIR, { recursive: true });
  const path = join(OUT_DIR, filename);
  writeFileSync(path, JSON.stringify(data, null, 2));
  log(`Saved → ${path}`, 'ok');
  return path;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  const saveMode  = process.argv.includes('--save');
  const skipIndex = process.argv.includes('--skip-index');   // skip index re-scrape

  if (saveMode) {
    const geocodedPath = join(OUT_DIR, 'geocoded_farms.json');
    if (!existsSync(geocodedPath)) {
      throw new Error('Run without --save first to generate geocoded_farms.json');
    }
    const farms = JSON.parse(readFileSync(geocodedPath, 'utf-8')) as GeocodedFarm[];
    log(`Loaded ${farms.length} geocoded farms from JSON`);
    await importToSupabase(farms);
    return;
  }

  const line = '='.repeat(72);
  log(line);
  log('Boerengids.nl — Dutch Organic Farm Shop Extractor');
  log(line);

  // ── Phase 1: Slugs ────────────────────────────────────────────────────────
  let slugs: SlugEntry[];
  const slugsPath = join(OUT_DIR, 'raw_slugs.json');

  if (skipIndex && existsSync(slugsPath)) {
    slugs = JSON.parse(readFileSync(slugsPath, 'utf-8')) as SlugEntry[];
    log(`Loaded ${slugs.length} slugs from cache (--skip-index)`);
  } else {
    slugs = await scrapeIndexPages();
    saveJson('raw_slugs.json', { scraped_at: new Date().toISOString(), count: slugs.length, slugs });
  }

  // ── Phase 2: Detail pages ─────────────────────────────────────────────────
  log('');
  const rawFarmsPath = join(OUT_DIR, 'raw_farms.json');
  let rawFarms: RawFarm[];

  // Resume from existing raw if already scraped
  if (existsSync(rawFarmsPath) && skipIndex) {
    rawFarms = JSON.parse(readFileSync(rawFarmsPath, 'utf-8')) as RawFarm[];
    log(`Loaded ${rawFarms.length} raw farms from cache (--skip-index)`);
  } else {
    rawFarms = await scrapeAllFarms(slugs);
    saveJson('raw_farms.json', { scraped_at: new Date().toISOString(), count: rawFarms.length, farms: rawFarms });
  }

  // ── Phase 3: Geocode ──────────────────────────────────────────────────────
  log('');
  const geocodedFarms = await geocodeAll(rawFarms);
  saveJson('geocoded_farms.json', { geocoded_at: new Date().toISOString(), count: geocodedFarms.length, farms: geocodedFarms });

  // ── Extraction report ─────────────────────────────────────────────────────
  const withCoords    = geocodedFarms.filter(f => f.lat != null).length;
  const withEmail     = geocodedFarms.filter(f => f.email).length;
  const withWebsite   = geocodedFarms.filter(f => f.website).length;
  const withPhone     = geocodedFarms.filter(f => f.phone).length;
  const withHours     = geocodedFarms.filter(f => Object.values(f.opening_hours).some(Boolean)).length;
  const provinceCounts: Record<string, number> = {};
  for (const f of geocodedFarms) {
    if (f.province) provinceCounts[f.province] = (provinceCounts[f.province] ?? 0) + 1;
  }
  const catCounts: Record<string, number> = {};
  for (const f of geocodedFarms) {
    for (const c of f.product_categories) catCounts[c] = (catCounts[c] ?? 0) + 1;
  }

  saveJson('extraction_report.json', {
    extracted_at:   new Date().toISOString(),
    source:         'boerengids.nl',
    total_slugs:    slugs.length,
    total_scraped:  rawFarms.length,
    total_geocoded: geocodedFarms.length,
    with_coords:    withCoords,
    with_email:     withEmail,
    with_website:   withWebsite,
    with_phone:     withPhone,
    with_hours:     withHours,
    by_province:    Object.fromEntries(Object.entries(provinceCounts).sort((a, b) => b[1] - a[1])),
    top_categories: Object.fromEntries(
      Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 20)
    ),
    geocode_precision: {
      precise:   geocodedFarms.filter(f => f.geocode_source === 'pdok').length,
      city_only: geocodedFarms.filter(f => f.geocode_source === 'city_only').length,
      failed:    geocodedFarms.filter(f => f.geocode_source === 'failed').length,
    },
  });

  log('');
  log(line);
  log('Extraction complete!');
  log(`  Farms scraped:      ${rawFarms.length}`);
  log(`  With coordinates:   ${withCoords} / ${rawFarms.length}`);
  log(`  With email:         ${withEmail}`);
  log(`  With website:       ${withWebsite}`);
  log(`  With opening hours: ${withHours}`);
  log('');
  log('Run with --save to import into Supabase.');
  log(line);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
