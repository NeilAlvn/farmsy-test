'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Heart, Loader2, ArrowRight, Search, X, Clock, Camera } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isOpenToday } from '@/lib/opening-hours'
import ContentLayout from '@/app/_components/ContentLayout'
import FarmCard from '@/app/FarmCard'

interface FarmRow {
  osm_id: string
  name: string
  city: string | null
  image: string
  farm_type: unknown
  description?: string | null
  phone?: string | null
  website?: string | null
  opening_hours?: string | null
  enrichment_source?: string | null
  source?: string | null
}

export default function FavoritesPage() {
  const router = useRouter()
  const [farms, setFarms] = useState<FarmRow[]>([])
  const [loading, setLoading] = useState(true)

  // ── Filters ───────────────────────────────────────────────────────────────
  const [query, setQuery] = useState('')
  const [filterOpenToday, setFilterOpenToday] = useState(false)
  const [filterHasPhotos, setFilterHasPhotos] = useState(false)

  const displayed = useMemo(() => {
    let result = farms
    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.city?.toLowerCase().includes(q) ||
        f.description?.toLowerCase().includes(q),
      )
    }
    if (filterOpenToday) result = result.filter(f => isOpenToday(f.opening_hours))
    if (filterHasPhotos) result = result.filter(f => !!f.image)
    return result
  }, [farms, query, filterOpenToday, filterHasPhotos])

  const filtersActive = query.trim() || filterOpenToday || filterHasPhotos

  // ── Data load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/auth/signin?redirect=/favorites')
        return
      }

      const { data: favs, error: favErr } = await supabase
        .from('favorites')
        .select('farm_osm_id, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (favErr || !favs || favs.length === 0) {
        setLoading(false)
        return
      }

      const osmIds = favs.map((f: { farm_osm_id: string }) => f.farm_osm_id)

      const { data: farmData } = await supabase
        .from('farms')
        .select('osm_id, name, city, image, farm_type, description, phone, website, opening_hours, enrichment_source, source')
        .in('osm_id', osmIds)

      if (farmData) {
        const byOsmId = new Map(farmData.map((f: FarmRow) => [f.osm_id, f]))
        setFarms(osmIds.map((id: string) => byOsmId.get(id)).filter((f): f is FarmRow => f !== undefined))
      }

      setLoading(false)
    })
  }, [router])

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <ContentLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 size={22} className="animate-spin text-gray-300" />
        </div>
      </ContentLayout>
    )
  }

  return (
    <ContentLayout>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="max-w-3xl mx-auto relative">
          <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest mb-3">Your collection</p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 leading-tight flex items-center gap-4">
            My Favorites
            <Heart size={36} className="fill-red-400 text-red-400" />
          </h1>
          <p className="text-emerald-100/70 text-lg">
            {farms.length === 0
              ? 'Farms you save will appear here.'
              : `${farms.length} saved farm${farms.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </section>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      {farms.length > 0 && (
        <div className="bg-white border-b border-gray-100 sticky top-16 z-10">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2.5 flex-wrap">

            {/* Text search */}
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search favorites…"
                className="w-full pl-9 pr-9 py-2 rounded-full border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Open today */}
            <button
              onClick={() => setFilterOpenToday(v => !v)}
              className={`flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-semibold transition-all border shrink-0 ${
                filterOpenToday
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              <Clock size={14} />
              Open today
            </button>

            {/* Has photos */}
            <button
              onClick={() => setFilterHasPhotos(v => !v)}
              className={`flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-semibold transition-all border shrink-0 ${
                filterHasPhotos
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              <Camera size={14} />
              Has photos
            </button>

            {/* Result count + clear */}
            <div className="flex items-center gap-3 ml-auto shrink-0">
              <span className="text-xs text-gray-400 font-medium">
                {displayed.length} of {farms.length}
              </span>
              {filtersActive && (
                <button
                  onClick={() => { setQuery(''); setFilterOpenToday(false); setFilterHasPhotos(false) }}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="py-12 px-4 bg-gray-50 min-h-[50vh]">
        <div className="max-w-6xl mx-auto">

          {farms.length === 0 ? (
            /* No favorites saved yet */
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 rounded-3xl bg-white border border-gray-100 shadow-sm flex items-center justify-center mb-6">
                <Heart size={36} className="text-gray-200" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">No favorites yet</h2>
              <p className="text-gray-400 text-sm mb-8 max-w-xs">
                Tap the heart icon on any farm to save it here for quick access.
              </p>
              <Link
                href="/map"
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-full transition-colors shadow-md shadow-emerald-600/20"
              >
                Explore farms <ArrowRight size={16} />
              </Link>
            </div>
          ) : displayed.length === 0 ? (
            /* Filters returned nothing */
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center mb-5">
                <Search size={28} className="text-gray-200" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">No matches</h2>
              <p className="text-gray-400 text-sm mb-6">Try adjusting your search or filters.</p>
              <button
                onClick={() => { setQuery(''); setFilterOpenToday(false); setFilterHasPhotos(false) }}
                className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-gray-900">
                  {filtersActive ? 'Filtered results' : 'Saved farms'}
                </h2>
                <Link
                  href="/map"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  Explore more <ArrowRight size={14} />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {displayed.map((farm, idx) => (
                  <FarmCard key={farm.osm_id} farm={farm} idx={idx} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

    </ContentLayout>
  )
}
