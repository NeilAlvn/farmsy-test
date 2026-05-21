'use client'

import Link from 'next/link'
import { MapPin, Phone, Globe, Clock } from 'lucide-react'
import HeartButton from './_components/HeartButton'
import StarRating from './_components/StarRating'

function normalizeFarmTypes(raw: unknown): string[] {
  if (Array.isArray(raw)) return (raw as string[]).map(v => String(v).toLowerCase()).filter(Boolean)
  if (typeof raw === 'string' && raw) {
    if (raw.startsWith('{') && raw.endsWith('}'))
      return raw.slice(1, -1).split(',').map(v => v.trim().replace(/^"(.*)"$/, '$1').toLowerCase()).filter(Boolean)
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

interface FarmCardProps {
  farm: {
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
    avg_rating?: number | null
    review_count?: number
  }
  idx: number
}

export default function FarmCard({ farm, idx }: FarmCardProps) {
  const types = normalizeFarmTypes(farm.farm_type)

  return (
    <Link
      href={`/map?id=${farm.osm_id}`}
      className="group bg-white rounded-3xl border border-gray-100 overflow-hidden hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.12)] transition-all duration-500 flex flex-col"
      onPointerOver={(e) => {
        const img = e.currentTarget.querySelector('img')
        if (img && img.naturalWidth === 0 && img.complete) e.currentTarget.style.display = 'none'
      }}
    >
      {/* ── Image ── */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={farm.image}
          alt={farm.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          onError={(e) => {
            const card = e.currentTarget.closest('a')
            if (card) card.style.display = 'none'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        {farm.image?.includes('googleusercontent.com') && (
          <span className="absolute bottom-1 right-2 text-[9px] text-white/60">Photo: Google</span>
        )}

        <HeartButton osmId={farm.osm_id} className="absolute top-3 right-3" />

        {idx < 3 && (
          <div className="absolute top-3 left-3">
            <span className="bg-white/90 backdrop-blur-md text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest shadow-sm">
              Top Pick
            </span>
          </div>
        )}

        {/* City + name on image */}
        <div className="absolute bottom-3 left-4 right-4 text-white">
          <p className="text-xs font-bold flex items-center gap-1 mb-1 text-emerald-400">
            <MapPin className="w-3 h-3" />
            {farm.city || 'Local Area'}
          </p>
          <h3 className="font-bold text-base leading-snug group-hover:text-emerald-300 transition-colors line-clamp-2">
            {farm.name}
          </h3>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-4 flex-1 flex flex-col gap-3">

        {/* Type tags */}
        {types.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {types.map((t) => (
              <span
                key={t}
                className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {farm.description && (
          <p className="text-gray-500 text-xs leading-relaxed line-clamp-3">
            {farm.description}
          </p>
        )}

        {/* Star rating */}
        {farm.avg_rating != null && farm.review_count != null && farm.review_count > 0 && (
          <div className="flex items-center gap-1.5">
            <StarRating rating={farm.avg_rating} size={12} />
            <span className="text-xs font-semibold text-gray-600">{farm.avg_rating.toFixed(1)}</span>
            <span className="text-xs text-gray-400">({farm.review_count})</span>
          </div>
        )}

        {/* Contact / hours indicators */}
        <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1.5 pt-2 border-t border-gray-50">
          {farm.opening_hours && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
              <Clock className="w-3 h-3 text-emerald-500" />
              {farm.opening_hours.split(/[\n;]/)[0].trim().slice(0, 28)}
            </span>
          )}
          {farm.phone && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
              <Phone className="w-3 h-3 text-emerald-500" />
              {farm.phone}
            </span>
          )}
          {farm.website && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
              <Globe className="w-3 h-3" />
              Website
            </span>
          )}
          {!farm.opening_hours && !farm.phone && !farm.website && (
            <span className="text-[11px] text-gray-300 italic">No contact info yet</span>
          )}
        </div>
        {farm.enrichment_source === 'google_places' && (
          <p className="text-[10px] text-gray-400 mt-1">Business information from Google</p>
        )}
        {farm.source === 'jecuisinelocal' && (
          <p className="text-[10px] text-gray-400 mt-1">Data from JeCuisineLocal</p>
        )}
      </div>
    </Link>
  )
}
