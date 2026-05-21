'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, ZoomControl } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import {
  Wheat,
  Egg, Milk, Beef, Fish, Carrot, Circle, Wine, Store, Leaf,
  Search, X, Locate, Map as MapIcon, List, Loader2,
  MapPin, User, Droplets, Clock, Phone, Globe, Camera,
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

// ─── Types ────────────────────────────────────────────────────────────────────

// SlimFarm: loaded for all farms on initial page load. Heavy fields omitted.
export interface SlimFarm {
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
  osm_id: string
  primary_tag: string | null
  farm_type: string[] | null
  enrichment_source: string | null
  source: string | null
  avg_rating?: number | null
  review_count?: number
}

// Farm: full type used by FarmModal. Extra fields are fetched on-demand.
export interface Farm extends SlimFarm {
  email: string | null
  description: string | null
  facebook: string | null
  instagram: string | null
  organic: string | null
  produce: string | null
  operator: string | null
  is_claimed?: boolean | null
}

interface AuthUser {
  id: string
  email: string
}

// ─── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'eggs',       label: 'Eggs',       color: '#eab308', Icon: Egg      },
  { id: 'dairy',      label: 'Dairy',      color: '#38bdf8', Icon: Milk     },
  { id: 'meat',       label: 'Meat',       color: '#ef4444', Icon: Beef     },
  { id: 'fish',       label: 'Fish',       color: '#2563eb', Icon: Fish     },
  { id: 'produce',    label: 'Produce',    color: '#10b981', Icon: Carrot   },
  { id: 'cheese',     label: 'Cheese',     color: '#f97316', Icon: Circle   },
  { id: 'wine',       label: 'Wine',       color: '#7c3aed', Icon: Wine     },
  { id: 'markets',    label: 'Markets',    color: '#92400e', Icon: Store    },
  { id: 'honey',      label: 'Honey',      color: '#d97706', Icon: Droplets },
  { id: 'organic',   label: 'Organic',    color: '#059669', Icon: Leaf     },
] as const

type CategoryId = (typeof CATEGORIES)[number]['id']
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c])) as Record<
  CategoryId,
  (typeof CATEGORIES)[number]
>

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
  const circle = small ? 18 : 34
  const stemW  = small ?  6 : 12
  const stemH  = small ?  5 : 10
  const border = small ? '2px' : '2.5px'
  const shadow = small
    ? '0 1px 4px rgba(0,0,0,0.3)'
    : '0 3px 12px rgba(0,0,0,0.3)'

  const icon = small ? '' : svgStr(nodes, 18)

  const head = (
    `<div style="width:${circle}px;height:${circle}px;background:${color};border-radius:50%;` +
    `border:${border} solid white;box-shadow:${shadow};` +
    `display:flex;align-items:center;justify-content:center;">${icon}</div>`
  )
  const stem = (
    `<div style="width:0;height:0;margin:0 auto;` +
    `border-left:${stemW / 2}px solid transparent;` +
    `border-right:${stemW / 2}px solid transparent;` +
    `border-top:${stemH}px solid ${color};"></div>`
  )
  return `<div style="line-height:0;">${head}${stem}</div>`
}

const ICON_CACHE = new Map<string, L.DivIcon>()

function farmIcon(farmType: string | null | undefined, small: boolean): L.DivIcon {
  const key = `${farmType ?? '__'}:${small ? 's' : 'l'}`
  if (!ICON_CACHE.has(key)) {
    const cat   = farmType ? CAT_MAP[farmType as CategoryId] : null
    const color = cat?.color ?? '#94a3b8'
    const nodes = (farmType != null ? ICON_NODES[farmType] as SvgNode[] | undefined : undefined)
                  ?? ICON_NODES['__']
    const circle = small ? 18 : 34
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
    <div className="flex-1 overflow-y-auto bg-gray-50 min-h-0 pt-32">
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
                    key={farm.osm_id}
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

                      <HeartButton osmId={farm.osm_id} className="absolute top-3 right-3" />

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
                      {farm.source === 'jecuisinelocal' && (
                        <p className="text-[10px] text-gray-400 mt-1">Data from JeCuisineLocal</p>
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
  const [selected, setSelected]           = useState<Set<CategoryId>>(new Set())
  const [query, setQuery]                 = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [flyTarget, setFlyTarget]         = useState<{ pos: [number, number]; key: number } | null>(null)
  const [userPos, setUserPos]             = useState<[number, number] | null>(null)
  const [geoLoading, setGeoLoading]       = useState(false)
  const [view, setView]                   = useState<'map' | 'list'>('map')
  const [zoom, setZoom]                   = useState(7)
  const [bounds, setBounds]               = useState<L.LatLngBounds | null>(null)
  const [selectedFarm, setSelectedFarm]   = useState<Farm | null>(null)
  const [showClaim, setShowClaim]         = useState(false)
  const [showAuth, setShowAuth]           = useState(false)
  const [authUser, setAuthUser]           = useState<AuthUser | null>(null)
  const [filterOpenToday, setFilterOpenToday] = useState(false)
  const [filterHasPhotos, setFilterHasPhotos] = useState(false)

  const searchRef  = useRef<HTMLDivElement>(null)
  const flyKeyRef  = useRef(0)
  const boundsTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

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
    // Show modal immediately with what we have
    setSelectedFarm({ ...slim, email: null, description: null, facebook: null, instagram: null, organic: null, produce: null, operator: null })
    setShowClaim(false)

    // Fetch deferred fields in background
    try {
      const res = await fetch(`/api/farm/${encodeURIComponent(slim.osm_id)}`)
      if (res.ok) {
        const details = await res.json() as { description: string | null; email: string | null; facebook: string | null; instagram: string | null; organic: string | null; produce: string | null; operator: string | null }
        setSelectedFarm(prev => prev?.osm_id === slim.osm_id ? { ...prev, ...details } : prev)
      }
    } catch { /* ignore — modal already shows slim data */ }
  }, [])

  // ── Handle URL Search Params ───────────────────────────────────────────────

  useEffect(() => {
    const id       = searchParams.get('id')
    const category = searchParams.get('category')
    const q        = searchParams.get('q')

    if (id) {
      const farm = farms.find(f => f.osm_id === id)
      if (farm) {
        openFarm(farm)
        setFlyTarget({ pos: [farm.lat, farm.lng], key: Date.now() })
      }
    }
    if (category) setSelected(new Set([category as CategoryId]))
    if (q) setQuery(q)
  }, [searchParams, farms, openFarm])

  // ── Available categories ───────────────────────────────────────────────────

  const availableCategories = useMemo(() => {
    const inFarms = new Set<string>()
    for (const farm of farms) {
      for (const t of farm.farm_type ?? []) inFarms.add(t)
    }
    return CATEGORIES.filter(c => inFarms.has(c.id))
  }, [farms])

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

  const suggestions = useMemo(() => {
    if (query.trim().length < 2) return []
    const q = query.toLowerCase()
    return farms
      .filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.city?.toLowerCase().includes(q) ||
        f.address?.toLowerCase().includes(q),
      )
      .slice(0, 6)
  }, [farms, query])

  const smallMarkers = zoom < 10

  const markerElements = useMemo(() => {
    return visible.map(farm => (
      <Marker
        key={farm.osm_id}
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
  }, [visible, smallMarkers, openFarm])

  const handleBoundsInit   = useCallback((b: L.LatLngBounds) => { setBounds(b) }, [])
  const handleBoundsChange = useCallback((b: L.LatLngBounds) => {
    clearTimeout(boundsTimer.current)
    boundsTimer.current = setTimeout(() => setBounds(b), 250)
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
  }, [])

  const toggleCategory = useCallback((id: CategoryId) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const handleSuggestionClick = useCallback((farm: SlimFarm) => {
    setQuery(farm.name)
    setShowSuggestions(false)
    flyKeyRef.current += 1
    setFlyTarget({ pos: [farm.lat, farm.lng], key: flyKeyRef.current })
    setView('map')
  }, [])

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function closeFarmModal() {
    setSelectedFarm(null)
    setShowClaim(false)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white text-gray-900">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 z-[9999] absolute top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl pointer-events-none">
        <div className="flex flex-col gap-4 pointer-events-auto">
          {/* Search Bar */}
          <div ref={searchRef} className="relative group">
            <div className="flex items-center gap-3 bg-white/95 backdrop-blur-xl border border-gray-100 rounded-full px-5 py-2.5 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.15)] focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
              <div className="flex items-center gap-2 shrink-0 pr-2 border-r border-gray-100">
                <Wheat size={18} className="text-emerald-600" />
                <span className="hidden md:block font-bold text-xs tracking-tight">De Lokale Boer</span>
              </div>
              <Search size={16} className="text-gray-400 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setShowSuggestions(true) }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search for a farm..."
                className="flex-1 bg-transparent text-sm font-medium text-gray-800 placeholder-gray-400 outline-none"
              />
              <div className="flex items-center gap-2">
                {query && (
                  <button onClick={() => setQuery('')} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                    <X size={14} className="text-gray-400" />
                  </button>
                )}
                <button
                  onClick={handleGeolocate}
                  disabled={geoLoading}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors shrink-0"
                >
                  {geoLoading ? <Loader2 size={16} className="animate-spin text-emerald-600" /> : <Locate size={16} className="text-gray-400" />}
                </button>
                <div className="w-px h-4 bg-gray-200 shrink-0" />
                <button
                  onClick={() => setShowAuth(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors shrink-0 ${
                    authUser
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-gray-900 hover:bg-gray-700 text-white'
                  }`}
                >
                  {authUser ? (
                    <>
                      <span className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center text-white text-[9px] font-bold">
                        {authUser.email[0].toUpperCase()}
                      </span>
                      <span className="hidden sm:inline max-w-[80px] truncate">{authUser.email.split('@')[0]}</span>
                    </>
                  ) : (
                    <>
                      <User size={12} />
                      <span>Sign in</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-3 bg-white/95 backdrop-blur-xl border border-gray-100 rounded-[2rem] shadow-2xl overflow-hidden py-2">
                {suggestions.map(farm => (
                  <button
                    key={farm.osm_id}
                    onMouseDown={e => { e.preventDefault(); handleSuggestionClick(farm) }}
                    className="flex items-center gap-4 w-full px-6 py-3 hover:bg-emerald-50 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-200 transition-colors">
                      <MapPin size={14} className="text-emerald-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-800">{farm.name}</p>
                      {farm.city && <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">{farm.city}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Category Chips & Toggle Row */}
          <div className="flex flex-wrap items-center gap-2 px-1">
            <button
              onClick={() => setView(v => v === 'map' ? 'list' : 'map')}
              className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-gray-900 text-white text-[11px] font-bold shadow-lg hover:bg-gray-800 transition-all shrink-0"
            >
              {view === 'map' ? <><List size={13} /> List</> : <><MapIcon size={13} /> Map</>}
            </button>

            <div className="w-px h-4 bg-gray-300/60 shrink-0" />

            <button
              onClick={() => setSelected(new Set())}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-bold transition-all shadow-sm shrink-0 border ${
                selected.size === 0
                  ? 'bg-gray-900 border-gray-900 text-white'
                  : 'bg-white border-transparent text-gray-600 hover:border-gray-200'
              }`}
            >
              All
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                selected.size === 0 ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {farms.length.toLocaleString('nl-NL')}
              </span>
            </button>

            {availableCategories.map(cat => {
              const active = selected.has(cat.id)
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  style={active ? { background: cat.color, borderColor: cat.color } : {}}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-bold transition-all shadow-sm shrink-0 border ${
                    active
                      ? 'text-white'
                      : 'bg-white border-transparent text-gray-600 hover:border-gray-200'
                  }`}
                >
                  <cat.Icon size={13} />
                  {cat.label}
                </button>
              )
            })}

            <div className="w-px h-4 bg-gray-300/60 shrink-0" />

            <button
              onClick={() => setFilterOpenToday(v => !v)}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-bold transition-all shadow-sm shrink-0 border ${
                filterOpenToday
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white border-transparent text-gray-600 hover:border-gray-200'
              }`}
            >
              <Clock size={13} />
              Open today
            </button>

            <button
              onClick={() => setFilterHasPhotos(v => !v)}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-bold transition-all shadow-sm shrink-0 border ${
                filterHasPhotos
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white border-transparent text-gray-600 hover:border-gray-200'
              }`}
            >
              <Camera size={13} />
              Has photos
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      {view === 'list' ? (
        <FarmListView farms={filtered} onSelect={farm => { openFarm(farm); setView('map') }} />
      ) : (
        <div className="flex-1 relative min-h-0">
          <MapContainer
            center={[52.1326, 5.2913]}
            zoom={7}
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
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            <ZoomControl position="bottomright" />

            <MarkerClusterGroup
              chunkedLoading
              maxClusterRadius={60}
              showCoverageOnHover={false}
            >
              {markerElements}
            </MarkerClusterGroup>

            {userPos && <Marker position={userPos} icon={USER_ICON} />}
          </MapContainer>
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
