import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import {
  Egg, Milk, Beef, Fish, Carrot, Circle, Wine, Store, Droplets, Leaf,
  Search, Tag, Navigation, Wheat, ArrowRight, Sparkles,
} from 'lucide-react'
import FarmCard from './FarmCard'
import ContentLayout from './_components/ContentLayout'

export const dynamic = 'force-dynamic'

const CATEGORIES = [
  { id: 'eggs',    label: 'Eggs',    Icon: Egg,    bg: 'bg-orange-50',  iconColor: 'text-orange-500',  border: 'border-orange-100'  },
  { id: 'dairy',   label: 'Dairy',   Icon: Milk,   bg: 'bg-blue-50',    iconColor: 'text-blue-500',    border: 'border-blue-100'    },
  { id: 'meat',    label: 'Meat',    Icon: Beef,   bg: 'bg-red-50',     iconColor: 'text-red-500',     border: 'border-red-100'     },
  { id: 'fish',    label: 'Fish',    Icon: Fish,   bg: 'bg-cyan-50',    iconColor: 'text-cyan-500',    border: 'border-cyan-100'    },
  { id: 'produce', label: 'Produce', Icon: Carrot, bg: 'bg-green-50',   iconColor: 'text-green-600',   border: 'border-green-100'   },
  { id: 'cheese',  label: 'Cheese',  Icon: Circle, bg: 'bg-yellow-50',  iconColor: 'text-yellow-600',  border: 'border-yellow-100'  },
  { id: 'wine',    label: 'Wine',    Icon: Wine,   bg: 'bg-purple-50',  iconColor: 'text-purple-600',  border: 'border-purple-100'  },
  { id: 'markets', label: 'Markets', Icon: Store,    bg: 'bg-stone-50',   iconColor: 'text-stone-600',   border: 'border-stone-100'   },
  { id: 'honey',   label: 'Honey',   Icon: Droplets, bg: 'bg-amber-50',   iconColor: 'text-amber-600',   border: 'border-amber-100'   },
  { id: 'organic', label: 'Organic', Icon: Leaf,     bg: 'bg-emerald-50', iconColor: 'text-emerald-600', border: 'border-emerald-100' },
] as const

const STEPS = [
  {
    num: '1',
    Icon: Search,
    title: 'Search your area',
    desc: 'Enter your city or postal code. No account needed — local farms appear on the map in seconds.',
  },
  {
    num: '2',
    Icon: Tag,
    title: 'Browse by category',
    desc: 'Filter by Eggs, Dairy, Meat, Wine, Honey, and more. Tap any pin to see the farm\'s full profile.',
  },
  {
    num: '3',
    Icon: Navigation,
    title: 'Visit the farm',
    desc: 'Get directions, see opening hours, and contact the producer directly. Fresh food from the source.',
  },
] as const

function normalizeFarmTypes(raw: unknown): string[] {
  if (Array.isArray(raw)) return (raw as string[]).map(v => String(v).toLowerCase()).filter(Boolean)
  if (typeof raw === 'string' && raw) {
    if (raw.startsWith('{') && raw.endsWith('}'))
      return raw
        .slice(1, -1)
        .split(',')
        .map(v => v.trim().replace(/^"(.*)"$/, '$1').toLowerCase())
        .filter(Boolean)
    if (raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return (parsed as unknown[]).map(v => String(v).toLowerCase()).filter(Boolean)
      } catch { /* ignore */ }
    }
    return [raw.toLowerCase()]
  }
  return []
}

async function fetchStats() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { count } = await supabase
    .from('farms')
    .select('*', { count: 'exact', head: true })
    .eq('is_published', true)

  const PAGE = 1000
  let from = 0
  const categoryCounts: Record<string, number> = {}

  while (true) {
    const { data: typeRows } = await supabase
      .from('farms')
      .select('farm_type')
      .eq('is_published', true)
      .range(from, from + PAGE - 1)

    if (!typeRows || typeRows.length === 0) break
    for (const row of typeRows) {
      for (const t of normalizeFarmTypes(row.farm_type)) {
        categoryCounts[t] = (categoryCounts[t] ?? 0) + 1
      }
    }
    if (typeRows.length < PAGE) break
    from += PAGE
  }

  return { totalCount: count ?? 0, categoryCounts }
}

async function fetchFeaturedFarms() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Fetch 60 farms to ensure we get enough valid ones
  const { data } = await supabase
    .from('farms')
    .select('osm_id, name, city, image, farm_type, description, phone, website, opening_hours, enrichment_source, source')
    .eq('is_published', true)
    .not('image', 'is', null)
    .limit(60)

  if (!data) return []

  const candidates = [...data].sort(() => Math.random() - 0.5)

  // Validate images in parallel (checking both status and content-type)
  const results = await Promise.all(
    candidates.map(async (farm) => {
      try {
        const res = await fetch(farm.image!, { 
          method: 'HEAD', 
          signal: AbortSignal.timeout(3000),
          next: { revalidate: 3600 } 
        })
        
        if (!res.ok) return null
        
        const contentType = res.headers.get('content-type')
        if (contentType && !contentType.startsWith('image/')) return null
        
        return farm
      } catch {
        return null
      }
    })
  )

  return results.filter((f): f is NonNullable<typeof f> => f !== null).slice(0, 15)
}


export default async function Home() {
  const [{ totalCount, categoryCounts }, featuredFarms] = await Promise.all([
    fetchStats(),
    fetchFeaturedFarms(),
  ])
  return (
    <ContentLayout>

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-emerald-900 via-emerald-700 to-teal-900 text-white overflow-hidden">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        
        {/* Floating decorative elements */}
        <div className="absolute top-20 left-[10%] opacity-10 animate-pulse">
          <Wheat className="w-12 h-12 rotate-12" />
        </div>
        <div className="absolute bottom-20 right-[15%] opacity-10 animate-bounce" style={{ animationDuration: '3s' }}>
          <Leaf className="w-10 h-10 -rotate-12" />
        </div>
        <div className="absolute top-1/4 right-[5%] opacity-5">
          <Carrot className="w-16 h-16 rotate-45" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 py-32 text-center">
          <span className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/20 text-sm font-medium px-4 py-1.5 rounded-full mb-8">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Discover Local Gems in NL &amp; BE
          </span>
          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tight mb-6">
            Taste the Freshness
            <br className="hidden sm:block" />
            <span className="text-emerald-400">Directly</span> from the Farm
          </h1>
          <p className="text-xl md:text-2xl text-emerald-100/80 mb-12 max-w-2xl mx-auto font-light">
            Connect with local producers and find the best roadside stands, farm shops, and markets near you.
          </p>

          {/* Search bar */}
          <form
            action="/map"
            className="flex flex-col sm:flex-row items-stretch max-w-2xl mx-auto shadow-2xl rounded-2xl sm:rounded-full overflow-hidden bg-white p-1"
          >
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                name="q"
                placeholder="Enter your city or postal code..."
                className="w-full pl-12 pr-4 py-5 text-gray-900 text-base bg-transparent focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white px-8 py-4 sm:py-2 rounded-xl sm:rounded-full font-bold text-base whitespace-nowrap transition-all shadow-lg hover:shadow-emerald-900/20 m-1"
            >
              Search Map
            </button>
          </form>

          <p className="mt-6 text-emerald-200/60 text-sm">
            Popular: <Link href="/map?category=produce" className="underline hover:text-white">Fresh Produce</Link>, <Link href="/map?category=dairy" className="underline hover:text-white">Raw Milk</Link>, <Link href="/map?category=eggs" className="underline hover:text-white">Farm Eggs</Link>
          </p>
        </div>
      </section>


      {/* ── How It Works ──────────────────────────────────────────── */}
      <section className="py-28 px-4 bg-gray-50 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(#059669 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <div className="max-w-5xl mx-auto relative">
          <div className="text-center mb-20">
            <span className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-5">
              Simple Process
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">How It Works</h2>
            <p className="text-gray-400 text-lg max-w-sm mx-auto">From your front door to the farm gate in three steps</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-6 md:gap-4">
            {STEPS.flatMap(({ num, Icon, title, desc }, i) => {
              const card = (
                <div
                  key={num}
                  className="relative bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(5,150,105,0.1)] hover:-translate-y-1.5 transition-all duration-300 overflow-hidden group self-stretch"
                >
                  <span className="absolute -bottom-6 -right-2 text-[9rem] font-black text-gray-950/[0.03] leading-none select-none pointer-events-none">
                    {num}
                  </span>
                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-7">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/25 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shrink-0">
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-5xl font-black text-gray-900/[0.06] leading-none">0{num}</span>
                    </div>
                    <h3 className="text-xl font-extrabold text-gray-900 mb-3">{title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
                  </div>
                </div>
              )
              if (i < STEPS.length - 1) {
                return [
                  card,
                  <div key={`arrow-${i}`} className="hidden md:flex items-center justify-center">
                    <ArrowRight className="w-5 h-5 text-emerald-200" />
                  </div>,
                ]
              }
              return [card]
            })}
          </div>
        </div>
      </section>

      {/* ── Featured Farms ────────────────────────────────────────── */}
      {featuredFarms.length > 0 && (
        <section className="py-28 px-4 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold mb-4 uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" />
                  Editor's Choice
                </div>
                <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6 tracking-tight">Fresh from the Farm</h2>
                <p className="text-gray-500 text-lg leading-relaxed">
                  Discover the best local producers in your area. Every farm shop, stand, and market 
                  on this list is verified and offers direct-to-consumer fresh products.
                </p>
              </div>
              <Link 
                href="/map" 
                className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-full font-bold hover:bg-gray-800 transition-all group shadow-xl hover:shadow-gray-200"
              >
                Explore Full Map
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {featuredFarms.map((farm, idx) => (
                <FarmCard key={farm.osm_id} farm={farm} idx={idx} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Categories ────────────────────────────────────────────── */}
      <section className="py-32 px-4 bg-slate-50 relative overflow-hidden">
        {/* Decorative background pattern */}
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#059669 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-100/50 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-teal-100/50 rounded-full blur-3xl" />
        
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6 tracking-tight">Browse by Category</h2>
            <p className="text-gray-500 max-w-xl mx-auto text-lg">
              Looking for something specific? Filter our map by product type to find exactly what you need near you.
            </p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-6">
            {CATEGORIES.map(({ id, label, Icon, bg, iconColor, border }) => {
              const count = categoryCounts[id] ?? 0
              return (
                <Link
                  key={id}
                  href={`/map?category=${id}`}
                  className="group flex flex-col items-center gap-5 p-8 rounded-[2.5rem] bg-white border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(5,150,105,0.12)] hover:-translate-y-2 transition-all duration-500"
                >
                  <div className={`w-16 h-16 rounded-[1.5rem] ${bg} flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-inner`}>
                    <Icon className={`w-8 h-8 ${iconColor}`} />
                  </div>
                  <div className="text-center">
                    <p className="font-extrabold text-gray-900 text-sm mb-2">{label}</p>
                    {count > 0 && (
                      <div className="inline-block bg-emerald-50 rounded-full px-3 py-1">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">{count.toLocaleString('nl-NL')}</p>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────────── */}
      <section className="py-28 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 text-center">
            <div className="relative group">
              <div className="absolute inset-0 bg-emerald-50 scale-110 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <p className="text-6xl font-black text-emerald-600 mb-3 tabular-nums tracking-tighter">
                  {totalCount.toLocaleString('nl-NL')}
                </p>
                <p className="text-gray-500 font-bold uppercase text-xs tracking-widest">Farms & Producers</p>
              </div>
            </div>
            <div className="relative group">
              <div className="absolute inset-0 bg-emerald-50 scale-110 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <p className="text-6xl font-black text-emerald-600 mb-3 tabular-nums tracking-tighter">9</p>
                <p className="text-gray-500 font-bold uppercase text-xs tracking-widest">Fresh Categories</p>
              </div>
            </div>
            <div className="relative group">
              <div className="absolute inset-0 bg-emerald-50 scale-110 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <p className="text-6xl font-black text-emerald-600 mb-3 tabular-nums tracking-tighter">100%</p>
                <p className="text-gray-500 font-bold uppercase text-xs tracking-widest">Direct to Consumer</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Farmer CTA ────────────────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="relative rounded-[3rem] bg-emerald-900 overflow-hidden px-8 py-20 text-center shadow-2xl">
            {/* Background pattern and glow */}
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-400/20 rounded-full blur-[100px] -mr-48 -mt-48" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-400/20 rounded-full blur-[100px] -ml-48 -mb-48" />

            <div className="relative z-10 max-w-3xl mx-auto">
              <div className="w-20 h-20 bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-xl rotate-3">
                <Wheat className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">Are You a Farmer?</h2>
              <p className="text-emerald-100/80 text-lg md:text-xl mb-12 leading-relaxed">
                Connect with local customers and grow your business. List your farm shop, 
                roadside stand, or market for free and become part of our local network.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/claim"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-emerald-900 font-black px-10 py-5 rounded-2xl hover:bg-emerald-50 transition-all text-lg shadow-xl shadow-emerald-950/20 active:scale-95"
                >
                  Join the Network
                  <ArrowRight className="w-6 h-6" />
                </Link>
                <Link
                  href="/about"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold px-10 py-5 rounded-2xl hover:bg-white/20 transition-all text-lg active:scale-95"
                >
                  Learn More
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

    </ContentLayout>
  )
}
