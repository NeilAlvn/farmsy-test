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
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-500 hover:shadow-[0_16px_40px_-12px_rgba(0,0,0,0.1)]"
      onPointerOver={(e) => {
        const img = e.currentTarget.querySelector('img')
        if (img && img.naturalWidth === 0 && img.complete) e.currentTarget.style.display = 'none'
      }}
    >
      {/* ── Image ── */}
      <div className="relative h-40 shrink-0 overflow-hidden">
        <img
          src={farm.image}
          alt={farm.name}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          onError={(e) => {
            const card = e.currentTarget.closest('a')
            if (card) card.style.display = 'none'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        {farm.image?.includes('googleusercontent.com') && (
          <span className="absolute bottom-1 right-2 text-[9px] text-white/50">Photo: Google</span>
        )}

        <HeartButton osmId={farm.osm_id} className="absolute right-3 top-3" />

        {idx < 3 && (
          <div className="absolute left-3 top-3">
            <span className="rounded-lg bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm backdrop-blur-md" style={{ color: 'var(--primary)' }}>
              Top Pick
            </span>
          </div>
        )}

        {/* City + name over image */}
        <div className="absolute bottom-3 left-4 right-4 text-white">
          <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-white/70">
            <MapPin className="h-3 w-3" />
            {farm.city || 'Local Area'}
          </p>
          <h3 className="font-display text-base font-medium leading-snug tracking-tight transition-colors line-clamp-2 group-hover:text-white/90">
            {farm.name}
          </h3>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 flex-col gap-3 p-4">

        {/* Type tags */}
        {types.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {types.map(t => (
              <span
                key={t}
                className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.08)', color: 'var(--primary)' }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {farm.description && (
          <p className="line-clamp-3 text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            {farm.description}
          </p>
        )}

        {/* Star rating */}
        {farm.avg_rating != null && farm.review_count != null && farm.review_count > 0 && (
          <div className="flex items-center gap-1.5">
            <StarRating rating={farm.avg_rating} size={12} />
            <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{farm.avg_rating.toFixed(1)}</span>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>({farm.review_count})</span>
          </div>
        )}

        {/* Contact / hours */}
        <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1.5 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
          {farm.opening_hours && (
            <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
              <Clock className="h-3 w-3" style={{ color: 'var(--primary)' }} />
              {farm.opening_hours.split(/[\n;]/)[0].trim().slice(0, 28)}
            </span>
          )}
          {farm.phone && (
            <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
              <Phone className="h-3 w-3" style={{ color: 'var(--primary)' }} />
              {farm.phone}
            </span>
          )}
          {farm.website && (
            <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'var(--primary)' }}>
              <Globe className="h-3 w-3" />
              Website
            </span>
          )}
          {!farm.opening_hours && !farm.phone && !farm.website && (
            <span className="text-[11px] italic" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>No contact info yet</span>
          )}
        </div>

        {farm.enrichment_source === 'google_places' && (
          <p className="mt-1 text-[10px]" style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}>Business information from Google</p>
        )}
      </div>
    </Link>
  )
}
