'use client'

import { useEffect, useState, useRef } from 'react'
import {
  X, MapPin, Phone, Globe, Mail, Clock, Navigation, Flag, Shield,
  Wheat, Info, Star,
} from 'lucide-react'
import { Egg, Milk, Beef, Fish, Carrot, Circle, Wine, Store, Droplets, Leaf } from 'lucide-react'
import type { Farm } from './FarmMap'
import HeartButton from '@/app/_components/HeartButton'
import StarRating from '@/app/_components/StarRating'
import ShareButton from '@/app/_components/ShareButton'
import ReviewsSection from './ReviewsSection'
import { useTrip } from '@/app/_components/TripProvider'
import { Route, Check } from 'lucide-react'

const CATS = [
  { id: 'eggs',    label: 'Eggs',    color: '#eab308', Icon: Egg      },
  { id: 'dairy',   label: 'Dairy',   color: '#38bdf8', Icon: Milk     },
  { id: 'meat',    label: 'Meat',    color: '#ef4444', Icon: Beef     },
  { id: 'fish',    label: 'Fish',    color: '#2563eb', Icon: Fish     },
  { id: 'produce', label: 'Produce', color: '#10b981', Icon: Carrot   },
  { id: 'cheese',  label: 'Cheese',  color: '#f97316', Icon: Circle   },
  { id: 'wine',    label: 'Wine',    color: '#7c3aed', Icon: Wine     },
  { id: 'markets', label: 'Markets', color: '#92400e', Icon: Store    },
  { id: 'honey',   label: 'Honey',   color: '#d97706', Icon: Droplets },
  { id: 'organic', label: 'Organic', color: '#059669', Icon: Leaf     },
] as const

type Tab = 'info' | 'reviews'

interface Props {
  farm: Farm
  onClose: () => void
  onClaim: () => void
}

export default function FarmModal({ farm, onClose, onClaim }: Props) {
  const [visible, setVisible]   = useState(false)
  const [tab, setTab]           = useState<Tab>('info')
  const [tabFade, setTabFade]   = useState(true)
  const fadeTimer               = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { addFarm, removeFarm, hasFarm } = useTrip()
  const inTrip = hasFarm(farm.osm_id)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  function switchTab(newTab: Tab) {
    if (newTab === tab) return
    clearTimeout(fadeTimer.current)
    setTabFade(false)
    fadeTimer.current = setTimeout(() => {
      setTab(newTab)
      setTabFade(true)
    }, 150)
  }

  const allCats = (farm.farm_type ?? [])
    .map(t => CATS.find(c => c.id === t))
    .filter((c): c is typeof CATS[number] => c !== undefined)
  const cat = allCats[0] ?? null
  const color = cat?.color ?? '#22c55e'
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${farm.lat},${farm.lng}`
  const fullAddress = [farm.address, farm.city, farm.postal_code, farm.country].filter(Boolean).join(', ')
  const hasRating = farm.avg_rating != null && farm.review_count != null && farm.review_count > 0
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/map?id=${farm.osm_id}`
    : `/map?id=${farm.osm_id}`

  return (
    <div
      className={`fixed inset-0 z-[10000] flex items-end sm:items-center justify-center sm:p-4 transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      {/* Card */}
      <div
        className={`relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[92vh] sm:h-[88vh] transition-all duration-300 ease-out ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
        }`}
      >

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div className="relative h-44 shrink-0 overflow-hidden flex items-center justify-center bg-gray-100">
          {farm.image ? (
            <>
              <img src={farm.image} alt={farm.name} className="w-full h-full object-cover" />
              {allCats.length > 0 && (
                <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
                  {allCats.map(c => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm"
                      style={{ background: c.color }}
                    >
                      <c.Icon size={10} />
                      {c.label}
                    </span>
                  ))}
                </div>
              )}
              {farm.image.includes('googleusercontent.com') && (
                <span className="absolute bottom-1.5 right-2 text-[9px] text-white/60">Photo: Google</span>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                {cat ? <cat.Icon size={32} style={{ color }} /> : <Wheat size={32} className="text-gray-400" />}
              </div>
              {allCats.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {allCats.map(c => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-white"
                      style={{ background: c.color }}
                    >
                      <c.Icon size={10} />
                      {c.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white hover:bg-gray-50 border border-gray-200 flex items-center justify-center transition-colors shadow-sm"
          >
            <X size={16} className="text-gray-500" />
          </button>
          <HeartButton osmId={farm.osm_id} className="absolute top-3 left-3" />
        </div>

        {/* ── Name + rating strip ───────────────────────────────────────────── */}
        <div className="px-5 pt-4 pb-3 shrink-0">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-bold text-gray-900 leading-snug">{farm.name}</h2>
            <ShareButton
              url={shareUrl}
              title={farm.name}
              text={`Check out ${farm.name} on Farmsy`}
              className="shrink-0 mt-0.5"
            />
          </div>
          {fullAddress && (
            <p className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
              <MapPin size={12} className="text-gray-400 shrink-0" />
              {fullAddress}
            </p>
          )}
          {hasRating && (
            <button
              onClick={() => switchTab('reviews')}
              className="flex items-center gap-1.5 mt-2 hover:opacity-70 transition-opacity"
            >
              <StarRating rating={farm.avg_rating!} size={13} />
              <span className="text-sm font-semibold text-gray-700">{farm.avg_rating!.toFixed(1)}</span>
              <span className="text-xs text-gray-400">({farm.review_count} review{farm.review_count === 1 ? '' : 's'})</span>
            </button>
          )}
        </div>

        {/* ── Tab bar ───────────────────────────────────────────────────────── */}
        <div className="flex border-b border-gray-100 shrink-0 px-2">
          {([
            { id: 'info',    label: 'Info',    Icon: Info },
            { id: 'reviews', label: 'Reviews', Icon: Star },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => switchTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                tab === id
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon size={13} />
              {label}
              {id === 'reviews' && farm.review_count != null && farm.review_count > 0 && (
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full leading-none">
                  {farm.review_count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab content ───────────────────────────────────────────────────── */}
        {/*
          Single overflow-y-auto container stays in normal flow (gives flex-1 its height).
          Both panels are always mounted so ReviewsSection preloads immediately.
          The fade wrapper briefly goes opacity-0 while the hidden class toggles,
          giving a clean cross-fade without any absolute-positioning hacks.
        */}
        <div className="flex-1 overflow-y-auto">
          <div className={`transition-opacity duration-150 ${tabFade ? 'opacity-100' : 'opacity-0'}`}>

            <div className={tab === 'info' ? 'p-5 space-y-4' : 'hidden'}>
              {farm.description && (
                <p className="text-sm text-gray-600 leading-relaxed">{farm.description}</p>
              )}

              {farm.opening_hours && (
                <>
                  {farm.description && <div className="h-px bg-gray-100" />}
                  <div>
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
                      <Clock size={12} /> Opening hours
                    </h3>
                    <div className="space-y-1">
                      {farm.opening_hours.split(/[\n;]/).map((seg, i) => (
                        <p key={i} className="text-sm text-gray-700 font-mono leading-relaxed">{seg.trim()}</p>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {(farm.phone || farm.website || farm.email) && (
                <>
                  <div className="h-px bg-gray-100" />
                  <div className="space-y-2.5">
                    {farm.phone && (
                      <a href={`tel:${farm.phone}`} className="flex items-center gap-3 group">
                        <span className="w-9 h-9 rounded-xl bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center shrink-0 transition-colors">
                          <Phone size={15} className="text-gray-500" />
                        </span>
                        <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{farm.phone}</span>
                      </a>
                    )}
                    {farm.website && (
                      <a href={farm.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">
                        <span className="w-9 h-9 rounded-xl bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center shrink-0 transition-colors">
                          <Globe size={15} className="text-gray-500" />
                        </span>
                        <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors flex-1 truncate">
                          {farm.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </span>
                      </a>
                    )}
                    {farm.email && (
                      <a href={`mailto:${farm.email}`} className="flex items-center gap-3 group">
                        <span className="w-9 h-9 rounded-xl bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center shrink-0 transition-colors">
                          <Mail size={15} className="text-gray-500" />
                        </span>
                        <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors flex-1 truncate">{farm.email}</span>
                      </a>
                    )}
                  </div>
                </>
              )}

              {farm.enrichment_source === 'google_places' && (
                <div className="flex flex-col gap-0.5 pt-1">
                  <p className="text-xs text-gray-300">Business information from Google</p>
                </div>
              )}
            </div>

            <div className={tab === 'reviews' ? 'p-5' : 'hidden'}>
              <ReviewsSection farmOsmId={farm.osm_id} />
            </div>

          </div>
        </div>

        {/* ── Actions footer (always visible) ──────────────────────────────── */}
        <div className="shrink-0 px-5 pt-3 pb-6 space-y-2.5 border-t border-gray-100 bg-white">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-gray-900 hover:bg-gray-700 text-white text-sm font-bold transition-colors"
          >
            <Navigation size={16} />
            Get directions
          </a>

          <button
            onClick={() => {
              if (inTrip) {
                removeFarm(farm.osm_id)
              } else {
                addFarm({
                  osmId: farm.osm_id,
                  name: farm.name,
                  lat: farm.lat,
                  lng: farm.lng,
                  city: farm.city,
                  image: farm.image,
                  farmType: farm.farm_type,
                })
              }
            }}
            className={`flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-sm font-bold transition-colors ${
              inTrip
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {inTrip ? <><Check size={16} /> In your trip</> : <><Route size={16} /> Add to trip</>}
          </button>

          {!farm.is_claimed && (
            <button
              onClick={onClaim}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors"
            >
              <Shield size={16} />
              Claim this farm
            </button>
          )}

          <div className="flex justify-center pt-0.5">
            <a
              href="mailto:info@farmsy.nl?subject=Incorrect farm info"
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Flag size={11} />
              Report incorrect info
            </a>
          </div>
        </div>

      </div>
    </div>
  )
}
