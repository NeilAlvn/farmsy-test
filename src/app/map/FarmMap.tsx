'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import {
  Wheat,
  Egg, Milk, Beef, Fish, Carrot, Circle, Wine, Store, Leaf,
  Locate, Map as MapIcon, List, Loader2,
  MapPin, Droplets, Clock, Phone, Globe,
} from 'lucide-react'
import { isOpenToday } from '@/lib/opening-hours'
import 'leaflet/dist/leaflet.css'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css'
import { supabase } from '@/lib/supabase'
import FarmModal from './FarmModal'
import ClaimModal from './ClaimModal'
import AuthModal from './AuthModal'
import HeartButton from '@/app/_components/HeartButton'
import { useMapSearch } from './MapSearchContext'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SlimFarm {
  id: string
  name: string
  lat: number
  lng: number
  address: string | null
  city: string | null
  postal_code: string | null
  country: string | null
  website: string | null
  phone: string | null
  opening_hours: string | null
  image: string | null
  osm_id: string | null
  has_description: boolean
  primary_tag: string | null
  farm_type: string[] | null
  enrichment_source: string | null
  source: string | null
  avg_rating?: number | null
  review_count?: number
}

export interface Farm extends SlimFarm {
  email: string | null | undefined
  description: string | null | undefined
  facebook: string | null | undefined
  instagram: string | null | undefined
  organic: string | null | undefined
  produce: string | null | undefined
  operator: string | null | undefined
  is_claimed?: boolean | null
}

interface AuthUser {
  id: string
  email: string
}

// ─── Categories (for marker icons) ───────────────────────────────────────────

const CATEGORIES = [
  { id: 'eggs',    color: '#eab308' },
  { id: 'dairy',   color: '#38bdf8' },
  { id: 'meat',    color: '#ef4444' },
  { id: 'fish',    color: '#2563eb' },
  { id: 'produce', color: '#10b981' },
  { id: 'cheese',  color: '#f97316' },
  { id: 'wine',    color: '#7c3aed' },
  { id: 'markets', color: '#92400e' },
  { id: 'honey',   color: '#d97706' },
  { id: 'organic', color: '#059669' },
] as const

type CategoryId = (typeof CATEGORIES)[number]['id']
const CAT_COLOR = Object.fromEntries(CATEGORIES.map(c => [c.id, c.color])) as Record<CategoryId, string>

// ─── Markers ──────────────────────────────────────────────────────────────────

type SvgNode = [string, Record<string, string>]

const ICON_NODES: Record<string, SvgNode[]> = {
  eggs: [
    ['path', { d: 'M12 2C8 2 4 8 4 14a8 8 0 0 0 16 0c0-6-4-12-8-12' }],
  ],
  __: [
    ['path', { d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }],
    ['polyline', { points: '9 22 9 12 15 12 15 22' }],
  ],
  dairy: [
    ['path', { d: 'M8 2h8' }],
    ['path', { d: 'M9 2v2.789a4 4 0 0 1-.672 2.219l-.656.984A4 4 0 0 0 7 10.212V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9.789a4 4 0 0 0-.672-2.219l-.656-.984A4 4 0 0 1 15 4.788V2' }],
    ['path', { d: 'M7 15a6.472 6.472 0 0 1 5 0 6.47 6.47 0 0 0 5 0' }],
  ],
  meat: [
    ['path', { d: 'M16.4 13.7A6.5 6.5 0 1 0 6.28 6.6c-1.1 3.13-.78 3.9-3.18 6.08A3 3 0 0 0 5 18c4 0 8.4-1.8 11.4-4.3' }],
    ['path', { d: 'm18.5 6 2.19 4.5a6.48 6.48 0 0 1-2.29 7.2C15.4 20.2 11 22 7 22a3 3 0 0 1-2.68-1.66L2.4 16.5' }],
    ['circle', { cx: '12.5', cy: '8.5', r: '2.5' }],
  ],
  fish: [
    ['path', { d: 'M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z' }],
    ['path', { d: 'M18 12v.5' }],
    ['path', { d: 'M16 17.93a9.77 9.77 0 0 1 0-11.86' }],
    ['path', { d: 'M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33' }],
    ['path', { d: 'M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4' }],
    ['path', { d: 'm16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98' }],
  ],
  produce: [
    ['path', { d: 'M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.77 11.84 2.27 21.7 2.27 21.7z' }],
    ['path', { d: 'M8.64 14l-2.05-2.04' }],
    ['path', { d: 'M15.34 15l-2.46-2.46' }],
    ['path', { d: 'M22 9s-1.33-2-3.5-2C16.86 7 15 9 15 9s1.33 2 3.5 2S22 9 22 9z' }],
    ['path', { d: 'M15 2s-2 1.33-2 3.5S15 9 15 9s2-1.84 2-3.5C17 3.33 15 2 15 2z' }],
  ],
  cheese: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
  ],
  wine: [
    ['path', { d: 'M8 22h8' }],
    ['path', { d: 'M7 10h10' }],
    ['path', { d: 'M12 15v7' }],
    ['path', { d: 'M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z' }],
  ],
  markets: [
    ['path', { d: 'M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5' }],
    ['path', { d: 'M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244' }],
    ['path', { d: 'M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05' }],
  ],
  honey: [
    ['path', { d: 'M12 2c0 0-7 7.5-7 13a7 7 0 0 0 14 0c0-5.5-7-13-7-13z' }],
  ],
}

function svgStr(nodes: SvgNode[], size: number): string {
  const children = nodes
    .map(([tag, attrs]) =>
      `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`
    )
    .join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 24 24" fill="none" stroke="white" ` +
    `stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">` +
    children +
    `</svg>`
  )
}

function markerHtml(color: string, nodes: SvgNode[], small: boolean): string {
  const circle = small ? 20 : 38
  const stemW  = small ?  7 : 13
  const stemH  = small ?  5 : 10
  const shadow = small
    ? `0 2px 8px ${color}55, 0 1px 3px rgba(0,0,0,0.18)`
    : `0 4px 18px ${color}66, 0 2px 6px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.25)`
  const icon = small ? '' : svgStr(nodes, 18)
  const head = (
    `<div style="width:${circle}px;height:${circle}px;background:${color};border-radius:50%;` +
    `border:2.5px solid white;box-shadow:${shadow};` +
    `display:flex;align-items:center;justify-content:center;">${icon}</div>`
  )
  const stem = (
    `<div style="width:0;height:0;margin:0 auto;` +
    `border-left:${stemW / 2}px solid transparent;` +
    `border-right:${stemW / 2}px solid transparent;` +
    `border-top:${stemH}px solid ${color};` +
    `filter:drop-shadow(0 2px 2px rgba(0,0,0,0.12));"></div>`
  )
  return `<div style="line-height:0;cursor:pointer;">${head}${stem}</div>`
}

const ICON_CACHE = new Map<string, L.DivIcon>()

function farmIcon(farmType: string | null | undefined, small: boolean): L.DivIcon {
  const key = `${farmType ?? '__'}:${small ? 's' : 'l'}`
  if (!ICON_CACHE.has(key)) {
    const color = (farmType != null ? CAT_COLOR[farmType as CategoryId] : null) ?? '#94a3b8'
    const nodes = (farmType != null ? ICON_NODES[farmType] as SvgNode[] | undefined : undefined)
                  ?? ICON_NODES['__']
    const circle = small ? 20 : 38
    const stemH  = small ?  5 : 10
    const totalH = circle + stemH
    ICON_CACHE.set(key, L.divIcon({
      className: '',
      html: markerHtml(color, nodes, small),
      iconSize:   [circle, totalH],
      iconAnchor: [circle / 2, totalH],
    }))
  }
  return ICON_CACHE.get(key)!
}

const USER_ICON = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.5)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

// ─── Map event handler ────────────────────────────────────────────────────────

function MapEventHandler({
  flyTarget,
  userPos,
  onBoundsInit,
  onBoundsChange,
  onZoomChange,
  onMapClick,
}: {
  flyTarget: { pos: [number, number]; key: number } | null
  userPos: [number, number] | null
  onBoundsInit: (b: L.LatLngBounds) => void
  onBoundsChange: (b: L.LatLngBounds) => void
  onZoomChange: (z: number) => void
  onMapClick: () => void
}) {
  const map = useMap()

  useEffect(() => {
    onBoundsInit(map.getBounds())
  }, [])

  useMapEvents({
    moveend: () => onBoundsChange(map.getBounds()),
    zoomend: () => {
      onZoomChange(map.getZoom())
      onBoundsChange(map.getBounds())
    },
    click: () => onMapClick(),
  })

  useEffect(() => {
    if (flyTarget) map.flyTo(flyTarget.pos, 14, { duration: 0.8 })
  }, [flyTarget?.key])

  useEffect(() => {
    if (userPos) map.flyTo(userPos, 12, { duration: 1.2 })
  }, [userPos])

  return null
}

// ─── List view ────────────────────────────────────────────────────────────────

function FarmListView({ farms, onSelect }: { farms: SlimFarm[]; onSelect: (farm: SlimFarm) => void }) {
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 min-h-0">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {farms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-300">
            <MapPin size={48} className="mb-4 opacity-20" />
            <p className="text-lg font-medium">No results found</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Discover farms</h2>
              <p className="text-sm font-medium text-gray-400">
                {farms.length.toLocaleString()} results
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {farms.map((farm, idx) => {
                const types = farm.farm_type ?? []
                return (
                  <div
                    key={farm.osm_id ?? farm.id}
                    onClick={() => onSelect(farm)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(farm) }}
                    className="cursor-pointer text-left bg-white rounded-3xl border border-gray-100 overflow-hidden hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.12)] transition-all duration-500 flex flex-col group"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden">
                      {farm.image ? (
                        <img
                          src={farm.image}
                          alt={farm.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          onError={(e) => {
                            const wrapper = e.currentTarget.parentElement
                            if (wrapper) wrapper.style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-emerald-50 flex items-center justify-center">
                          <Wheat size={40} className="text-emerald-200" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      {farm.image?.includes('googleusercontent.com') && (
                        <span className="absolute bottom-1 right-2 text-[9px] text-white/60">Photo: Google</span>
                      )}

                      <HeartButton osmId={farm.osm_id!} className="absolute top-3 right-3" />

                      {idx < 3 && (
                        <div className="absolute top-3 left-3">
                          <span className="bg-white/90 backdrop-blur-md text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest shadow-sm">
                            Top Pick
                          </span>
                        </div>
                      )}

                      <div className="absolute bottom-3 left-4 right-4 text-white">
                        <p className="text-xs font-bold flex items-center gap-1 mb-1 text-emerald-400">
                          <MapPin size={12} />
                          {farm.city || farm.address || 'Local Area'}
                        </p>
                        <h3 className="font-bold text-base leading-snug group-hover:text-emerald-300 transition-colors line-clamp-2">
                          {farm.name}
                        </h3>
                      </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col gap-3">
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

                      <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1.5 pt-2 border-t border-gray-50">
                        {farm.opening_hours && (
                          <span className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
                            <Clock size={12} className="text-emerald-500" />
                            {farm.opening_hours.split(/[\n;]/)[0].trim().slice(0, 28)}
                          </span>
                        )}
                        {farm.phone && (
                          <span className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
                            <Phone size={12} className="text-emerald-500" />
                            {farm.phone}
                          </span>
                        )}
                        {farm.website && (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                            <Globe size={12} />
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
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FarmMap({ farms }: { farms: SlimFarm[] }) {
  const {
    query, selected, setSelected, filterOpenToday, filterHasPhotos,
    view, setView, flyTarget, setFlyTarget,
  } = useMapSearch()

  const [userPos, setUserPos]           = useState<[number, number] | null>(null)
  const [geoLoading, setGeoLoading]     = useState(false)
  const [zoom, setZoom]                 = useState(7)
  const [bounds, setBounds]             = useState<L.LatLngBounds | null>(null)
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null)
  const [showClaim, setShowClaim]       = useState(false)
  const [showAuth, setShowAuth]         = useState(false)
  const [authUser, setAuthUser]         = useState<AuthUser | null>(null)

  const boundsTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const mapRef      = useRef<L.Map | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAuthUser({ id: session.user.id, email: session.user.email ?? '' })
      }
    })
  }, [])

  // ── On-demand detail fetch ─────────────────────────────────────────────────

  const openFarm = useCallback(async (slim: SlimFarm) => {
    setSelectedFarm({ ...slim, email: undefined, description: undefined, facebook: undefined, instagram: undefined, organic: undefined, produce: undefined, operator: undefined })
    setShowClaim(false)

    try {
      const res = await fetch(`/api/farm/${encodeURIComponent(slim.osm_id!)}`)
      if (res.ok) {
        const details = await res.json() as { description: string | null; email: string | null; facebook: string | null; instagram: string | null; organic: string | null; produce: string | null; operator: string | null }
        setSelectedFarm(prev => prev?.osm_id === slim.osm_id ? { ...prev, ...details } : prev)
      }
    } catch { /* ignore */ }
  }, [])

  // ── Handle URL search params ───────────────────────────────────────────────

  useEffect(() => {
    const id       = searchParams.get('id')
    const category = searchParams.get('category')

    if (id) {
      const farm = farms.find(f => f.osm_id === id)
      if (farm) {
        openFarm(farm)
        setFlyTarget({ pos: [farm.lat, farm.lng], key: Date.now() })
      }
    }
    if (category) setSelected(new Set([category as CategoryId]))
  }, [searchParams, farms, openFarm, setFlyTarget, setSelected])

  // ── Derived farms ───────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = farms
    if (selected.size > 0) {
      result = result.filter(f => f.farm_type?.some(t => selected.has(t as CategoryId)))
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.city?.toLowerCase().includes(q) ||
        f.address?.toLowerCase().includes(q),
      )
    }
    if (filterOpenToday) result = result.filter(f => isOpenToday(f.opening_hours))
    if (filterHasPhotos) result = result.filter(f => !!f.image)
    return result
  }, [farms, selected, query, filterOpenToday, filterHasPhotos])

  const visible = useMemo(() => {
    if (!bounds) return []
    const s = bounds.getSouth() - (bounds.getNorth() - bounds.getSouth()) * 0.2
    const n = bounds.getNorth() + (bounds.getNorth() - bounds.getSouth()) * 0.2
    const w = bounds.getWest()  - (bounds.getEast()  - bounds.getWest())  * 0.2
    const e = bounds.getEast()  + (bounds.getEast()  - bounds.getWest())  * 0.2
    return filtered.filter(f => f.lat >= s && f.lat <= n && f.lng >= w && f.lng <= e)
  }, [filtered, bounds])

  const smallMarkers = zoom < 10

  const markersToRender = useMemo(() => {
    if (zoom < 9 && visible.length > 1500) {
      const step = Math.ceil(visible.length / 1500)
      return visible.filter((_, i) => i % step === 0)
    }
    return visible
  }, [visible, zoom])

  const markerElements = useMemo(() => {
    return markersToRender.map(farm => (
      <Marker
        key={farm.osm_id ?? farm.id}
        position={[farm.lat, farm.lng]}
        icon={farmIcon(farm.farm_type?.[0], smallMarkers)}
        eventHandlers={{
          click: e => {
            e.originalEvent.stopPropagation()
            openFarm(farm)
          },
        }}
      />
    ))
  }, [markersToRender, smallMarkers, openFarm])

  const handleBoundsInit   = useCallback((b: L.LatLngBounds) => { setBounds(b) }, [])
  const handleBoundsChange = useCallback((b: L.LatLngBounds) => {
    clearTimeout(boundsTimer.current)
    boundsTimer.current = setTimeout(() => setBounds(b), 400)
  }, [])

  useEffect(() => {
    if (selectedFarm && !filtered.some(f => f.osm_id === selectedFarm.osm_id)) {
      setSelectedFarm(null)
    }
  }, [filtered, selectedFarm])

  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserPos([pos.coords.latitude, pos.coords.longitude])
        setView('map')
        setGeoLoading(false)
      },
      () => setGeoLoading(false),
      { timeout: 10000 },
    )
  }, [setView])

  function closeFarmModal() {
    setSelectedFarm(null)
    setShowClaim(false)
  }

  return (
    <div className="relative flex flex-col flex-1 min-h-0 overflow-hidden bg-white text-gray-900">

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      {view === 'list' ? (
        <FarmListView farms={filtered} onSelect={farm => { openFarm(farm); setView('map') }} />
      ) : (
        <div className="flex-1 relative min-h-0">
          {/* Premium tile / marker CSS overrides */}
          <style>{`
            .leaflet-tile { transition: opacity 0.25s ease; }
            .leaflet-control-attribution {
              background: rgba(255,255,255,0.82) !important;
              backdrop-filter: blur(8px) !important;
              border-radius: 10px !important;
              border: 1px solid rgba(0,0,0,0.07) !important;
              padding: 2px 8px !important;
              font-size: 10px !important;
              box-shadow: 0 2px 8px rgba(0,0,0,0.08) !important;
              margin: 0 8px 8px 0 !important;
            }
            .leaflet-marker-icon { transition: transform 0.15s ease, filter 0.15s ease; }
            .leaflet-marker-icon:hover { transform: scale(1.12) !important; filter: brightness(1.05); }
          `}</style>

          <MapContainer
            ref={mapRef}
            center={[52.1326, 5.2913]}
            zoom={7.5}
            minZoom={2}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            scrollWheelZoom
          >
            <MapEventHandler
              flyTarget={flyTarget}
              userPos={userPos}
              onBoundsInit={handleBoundsInit}
              onBoundsChange={handleBoundsChange}
              onZoomChange={setZoom}
              onMapClick={() => { setSelectedFarm(null); setShowClaim(false) }}
            />
            <TileLayer
              attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              noWrap
            />

            <MarkerClusterGroup
              chunkedLoading
              maxClusterRadius={60}
              showCoverageOnHover={false}
              iconCreateFunction={(cluster) => {
                const count = cluster.getChildCount()
                const size  = count > 100 ? 52 : count > 20 ? 46 : 40
                const fs    = count > 99 ? 11 : 13
                return L.divIcon({
                  className: '',
                  html: `<div style="width:${size}px;height:${size}px;background:linear-gradient(135deg,#3d9e58 0%,#276d3c 100%);border-radius:50%;border:3px solid white;box-shadow:0 4px 16px rgba(39,109,60,0.45),0 2px 6px rgba(0,0,0,0.12);display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:${fs}px;font-family:-apple-system,sans-serif;letter-spacing:-0.5px;">${count}</div>`,
                  iconSize:   [size, size],
                  iconAnchor: [size / 2, size / 2],
                })
              }}
            >
              {markerElements}
            </MarkerClusterGroup>

            {userPos && <Marker position={userPos} icon={USER_ICON} />}
          </MapContainer>

          {/* Premium floating controls — bottom right */}
          <div className="absolute bottom-6 right-4 z-[9000] flex flex-col gap-2 items-center">
            {/* Zoom pill */}
            <div className="flex flex-col rounded-2xl overflow-hidden border border-gray-100/80 shadow-[0_4px_20px_rgba(0,0,0,0.12)] bg-white/95 backdrop-blur-sm">
              <button
                onClick={() => mapRef.current?.zoomIn()}
                className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-emerald-50 hover:text-emerald-700 transition-colors border-b border-gray-100 font-bold text-xl leading-none"
                title="Zoom in"
              >+</button>
              <button
                onClick={() => mapRef.current?.zoomOut()}
                className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-emerald-50 hover:text-emerald-700 transition-colors font-bold text-xl leading-none"
                title="Zoom out"
              >−</button>
            </div>

            {/* Geolocate */}
            <button
              onClick={handleGeolocate}
              disabled={geoLoading}
              className="w-10 h-10 rounded-2xl bg-white/95 backdrop-blur-sm border border-gray-100/80 shadow-[0_4px_20px_rgba(0,0,0,0.12)] flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-700 transition-colors disabled:opacity-50"
              title="Find my location"
            >
              {geoLoading
                ? <Loader2 size={17} className="animate-spin text-emerald-600" />
                : <Locate size={17} className="text-gray-500" />
              }
            </button>

            {/* List view toggle (mobile only) */}
            <button
              onClick={() => setView('list')}
              className="w-10 h-10 rounded-2xl bg-white/95 backdrop-blur-sm border border-gray-100/80 shadow-[0_4px_20px_rgba(0,0,0,0.12)] flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-700 transition-colors sm:hidden"
              title="List view"
            >
              <List size={17} className="text-gray-500" />
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {selectedFarm && !showClaim && (
        <FarmModal
          farm={selectedFarm}
          onClose={closeFarmModal}
          onClaim={() => setShowClaim(true)}
        />
      )}

      {selectedFarm && showClaim && (
        <ClaimModal
          farm={selectedFarm}
          onClose={() => setShowClaim(false)}
        />
      )}

      {showAuth && (
        <AuthModal
          user={authUser}
          onClose={() => setShowAuth(false)}
          onAuth={u => { setAuthUser(u); setShowAuth(false) }}
          onSignOut={() => { setAuthUser(null); setShowAuth(false) }}
        />
      )}
    </div>
  )
}
