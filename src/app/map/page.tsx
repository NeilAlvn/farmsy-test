import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import MapLoader from './MapLoader'
import MapNav from './MapNav'
import { MapSearchProvider } from './MapSearchContext'
import type { SlimFarm } from './FarmMap'

export const metadata: Metadata = {
  title: 'Farm Map',
  description: 'Explore an interactive map of 12,000+ verified farms, farm shops, and local producers across the Netherlands and Belgium.',
  alternates: { canonical: '/map' },
}

export const revalidate = 1800

const PAGE_SIZE = 1000

const TAG_TO_CATEGORY: Record<string, string> = {
  'shop=farm':           'produce',
  'shop=dairy':          'dairy',
  'shop=cheese':         'cheese',
  'craft=beekeeper':     'honey',
  'shop=honey':          'honey',
  'vending=eggs':        'eggs',
  'vending=milk':        'dairy',
  'tourism=wine_cellar': 'wine',
  'craft=winery':        'wine',
  'amenity=winery':      'wine',
  'landuse=vineyard':    'wine',
  'shop=farm (wine)':    'wine',
  'shop=wine':           'wine',
  'amenity=marketplace': 'markets',
  'craft=cheesemaker':   'cheese',
  'shop=butcher (farm)':        'meat',
  'shop=bakery (farm)':         'produce',
  'craft=butcher':              'meat',
  'shop=butcher (direct_sale)': 'meat',
  'shop=poultry':               'meat',
  'vending=meat':               'meat',
  'vending=sausage':            'meat',
  'shop=fish':                  'fish',
  'craft=fish_farm':            'fish',
}

function normalizeFarmType(raw: unknown, primaryTag: string | null | undefined): string[] | null {
  const clean = (vals: string[]) =>
    vals.map(v => v.trim().replace(/^"(.*)"$/, '$1').toLowerCase()).filter(Boolean)

  if (Array.isArray(raw)) {
    const vals = clean((raw as unknown[]).map(v => String(v)))
    return vals.length > 0 ? vals : null
  }

  if (typeof raw === 'string' && raw) {
    if (raw.startsWith('{') && raw.endsWith('}')) {
      const vals = clean(raw.slice(1, -1).split(','))
      return vals.length > 0 ? vals : null
    }
    if (raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw) as unknown[]
        if (Array.isArray(parsed)) {
          const vals = clean(parsed.map(v => String(v)))
          return vals.length > 0 ? vals : null
        }
      } catch { /* fall through */ }
    }
    return [raw.toLowerCase()]
  }

  if (primaryTag && TAG_TO_CATEGORY[primaryTag]) return [TAG_TO_CATEGORY[primaryTag]]
  return null
}

async function fetchFarms(): Promise<{ farms: SlimFarm[]; error: string | null }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const all: SlimFarm[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .rpc('get_farms_pins')
      .range(from, from + PAGE_SIZE - 1)

    if (error) return { farms: [], error: error.message }
    if (!data || data.length === 0) break

    const normalized = (data as SlimFarm[])
      .filter(f => f.lat >= 49.4 && f.lat <= 53.6 && f.lng >= 2.5 && f.lng <= 7.3)
      .filter(f => f.name !== 'Barneveldse Kip - Van Beek - Van Staal')
      .filter(f => f.name !== 'De Langenbrinck Eerlijk Heerlijk')
      .map(f => ({
        ...f,
        farm_type: normalizeFarmType(f.farm_type, f.primary_tag),
      }))
    all.push(...normalized)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return { farms: all, error: null }
}

export default async function MapPage() {
  const { farms, error } = await fetchFarms()

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md text-center space-y-3">
          <div className="text-4xl">⚠️</div>
          <p className="text-lg font-semibold text-gray-900">Failed to load farms</p>
          <p className="text-sm text-red-600 font-mono bg-red-50 border border-red-100 rounded-lg p-3 text-left break-all">
            {error}
          </p>
          <p className="text-sm text-gray-500">
            Make sure the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">get_farms_pins</code> SQL function
            has been created in Supabase. See{' '}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">
              src/scripts/migrations/024_farms_pins_public.sql
            </code>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <MapSearchProvider farms={farms}>
      <div className="flex flex-col h-screen">
        <MapNav />
        {/* Pins are visible to everyone; FarmMap gates farm details behind the
            subscription paywall on click. */}
        <MapLoader farms={farms} />
      </div>
    </MapSearchProvider>
  )
}
