'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Map, {
  Source, Layer, Marker,
  type MapRef,
  type MapLayerMouseEvent,
} from 'react-map-gl/maplibre'
import type { GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  Wheat, Locate, List, Loader2,
  MapPin, Clock, Phone, Globe,
} from 'lucide-react'
import { isOpenToday } from '@/lib/opening-hours'
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

// ─── Categories ───────────────────────────────────────────────────────────────

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
void CAT_COLOR // kept for future use

// ─── Pin marker SVG ───────────────────────────────────────────────────────────

function makePinSVG(color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 9.625 14 22 14 22S28 23.625 28 14C28 6.268 21.732 0 14 0z"
      fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="14" cy="14" r="5.5" fill="white"/>
  </svg>`
}

// MapLibre icon-image expression: maps category → pin-<category>
const ICON_IMAGE_EXPR = [
  'match', ['get', 'category'],
  ...CATEGORIES.flatMap(c => [c.id, `pin-${c.id}`]),
  'pin-default',
]

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
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null)
  const [showClaim, setShowClaim]       = useState(false)
  const [showAuth, setShowAuth]         = useState(false)
  const [authUser, setAuthUser]         = useState<AuthUser | null>(null)
  const [cursor, setCursor]             = useState('grab')
  const [iconsReady, setIconsReady]     = useState(false)

  const mapRef      = useRef<MapRef | null>(null)
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

  // ── URL search params ──────────────────────────────────────────────────────

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

  // ── Derived farms ──────────────────────────────────────────────────────────

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

  // Close modal if selected farm is filtered out
  useEffect(() => {
    if (selectedFarm && !filtered.some(f => f.osm_id === selectedFarm.osm_id)) {
      setSelectedFarm(null)
    }
  }, [filtered, selectedFarm])

  // ── GeoJSON for MapLibre source ────────────────────────────────────────────

  const farmsGeoJSON = useMemo((): GeoJSON.FeatureCollection => ({
    type: 'FeatureCollection',
    features: filtered.map(f => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [f.lng, f.lat] }, // MapLibre: [lng, lat]
      properties: {
        osm_id:   f.osm_id,
        name:     f.name,
        category: f.farm_type?.[0] ?? null,
      },
    })),
  }), [filtered])

  // ── Fly to targets ─────────────────────────────────────────────────────────

  const flyTargetKey = flyTarget?.key
  useEffect(() => {
    if (!flyTarget || !mapRef.current) return
    mapRef.current.flyTo({
      center: [flyTarget.pos[1], flyTarget.pos[0]], // [lng, lat]
      zoom: 14,
      duration: 1200,
    })
  }, [flyTargetKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userPos || !mapRef.current) return
    mapRef.current.flyTo({
      center: [userPos[1], userPos[0]], // [lng, lat]
      zoom: 12,
      duration: 1200,
    })
  }, [userPos])

  // ── Map load: globe + sky ──────────────────────────────────────────────────

  const handleMapLoad = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ml = mapRef.current?.getMap() as any
    if (!ml) return

    // Load pin images on demand: fires whenever a layer references an unknown image.
    // This is more reliable than a preload countdown — the layer renders immediately
    // and each icon fills in the first time it's needed.
    ml.on('styleimagemissing', (e: { id: string }) => {
      const id: string = e.id
      if (!id.startsWith('pin-')) return
      const catId = id.replace('pin-', '')
      const cat = CATEGORIES.find(c => c.id === catId)
      const color = cat?.color ?? '#94a3b8'
      const img = new Image(28, 36)
      img.onload = () => { if (!ml.hasImage(id)) ml.addImage(id, img, { pixelRatio: 1.5 }) }
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(makePinSVG(color))}`
    })

    setIconsReady(true)
  }, [])

  // ── Map click: cluster zoom or farm open ───────────────────────────────────

  const handleMapClick = useCallback(async (e: MapLayerMouseEvent) => {
    const features = e.features ?? []

    if (features.length === 0) {
      setSelectedFarm(null)
      setShowClaim(false)
      return
    }

    const feature = features[0]

    if (feature.layer.id === 'cluster-glow' || feature.layer.id === 'clusters') {
      const clusterId = feature.properties?.cluster_id as number | undefined
      if (clusterId == null) return
      try {
        const source = mapRef.current?.getSource('farms') as GeoJSONSource | undefined
        if (!source) return
        const zoom = await source.getClusterExpansionZoom(clusterId)
        const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates
        mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 800, essential: true })
      } catch { /* ignore */ }
      return
    }

    if (feature.layer.id === 'unclustered-point') {
      const osmId = feature.properties?.osm_id as string | undefined
      if (!osmId) return
      const farm = filtered.find(f => f.osm_id === osmId)
      if (farm) openFarm(farm)
    }
  }, [filtered, openFarm])

  // ── Geolocate ──────────────────────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="relative flex flex-col flex-1 min-h-0 overflow-hidden text-gray-900">

      {view === 'list' ? (
        <FarmListView farms={filtered} onSelect={farm => { openFarm(farm); setView('map') }} />
      ) : (
        <div className="flex-1 relative min-h-0">
          <style>{`
            .maplibregl-ctrl-attrib {
              background: rgba(255,255,255,0.78) !important;
              backdrop-filter: blur(8px) !important;
              border-radius: 10px !important;
              border: 1px solid rgba(0,0,0,0.07) !important;
              padding: 2px 8px !important;
              font-size: 10px !important;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
              margin: 0 8px 8px 0 !important;
            }
            .maplibregl-canvas { cursor: inherit; }
            .maplibregl-canvas-container { animation: mapFadeIn 0.6s ease; }
            @keyframes mapFadeIn { from { opacity: 0; } to { opacity: 1; } }
          `}</style>

          <Map
            ref={mapRef}
            initialViewState={{
              longitude: 5.2913,
              latitude:  52.1326,
              zoom:      7.5,
            }}
            style={{ width: '100%', height: '100%' }}
            mapStyle="https://tiles.openfreemap.org/styles/liberty"
            interactiveLayerIds={['cluster-glow', 'clusters', 'unclustered-point']}
            cursor={cursor}
            onLoad={handleMapLoad}
            onClick={handleMapClick}
            onMouseMove={(e) => setCursor(e.features && e.features.length > 0 ? 'pointer' : 'grab')}
            onMouseLeave={() => setCursor('grab')}
          >
            <Source
              id="farms"
              type="geojson"
              data={farmsGeoJSON}
              cluster
              clusterMaxZoom={13}
              clusterRadius={50}
            >
              {/* Cluster outer glow ring */}
              <Layer
                id="cluster-glow"
                type="circle"
                filter={['has', 'point_count']}
                paint={{
                  'circle-color':  'rgba(22, 104, 52, 0.18)',
                  'circle-radius': ['step', ['get', 'point_count'], 24, 20, 28, 100, 34],
                  'circle-blur':   0.4,
                  'circle-opacity': 1,
                  'circle-radius-transition': { duration: 400, delay: 0 },
                }}
              />
              {/* Cluster solid circle */}
              <Layer
                id="clusters"
                type="circle"
                filter={['has', 'point_count']}
                paint={{
                  'circle-color':        '#166834',
                  'circle-radius':       ['step', ['get', 'point_count'], 16, 20, 20, 100, 25],
                  'circle-stroke-width': 2.5,
                  'circle-stroke-color': '#ffffff',
                  'circle-opacity': 1,
                  'circle-radius-transition': { duration: 400, delay: 0 },
                }}
              />
              {/* Cluster count label */}
              <Layer
                id="cluster-count"
                type="symbol"
                filter={['has', 'point_count']}
                layout={{
                  'text-field': '{point_count_abbreviated}',
                  'text-font':  ['Open Sans Bold', 'Noto Sans Bold', 'Arial Unicode MS Bold'],
                  'text-size':  13,
                  'text-allow-overlap': true,
                }}
                paint={{
                  'text-color':   '#ffffff',
                  'text-opacity': 1,
                }}
              />
              {/* Individual farm pin markers — rendered once icons are loaded */}
              {iconsReady && (
                <Layer
                  id="unclustered-point"
                  type="symbol"
                  filter={['!', ['has', 'point_count']]}
                  layout={{
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    'icon-image':             ICON_IMAGE_EXPR as any,
                    'icon-size':              1,
                    'icon-anchor':            'bottom',
                    'icon-allow-overlap':     true,
                    'icon-ignore-placement':  true,
                  }}
                  paint={{
                    'icon-opacity': 1,
                  }}
                />
              )}
            </Source>

            {/* User position marker */}
            {userPos && (
              <Marker longitude={userPos[1]} latitude={userPos[0]}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#3b82f6',
                  border: '3px solid white',
                  boxShadow: '0 2px 8px rgba(59,130,246,0.5)',
                }} />
              </Marker>
            )}
          </Map>

          {/* Premium floating controls */}
          <div className="absolute bottom-6 right-4 z-[9000] flex flex-col gap-2 items-center">
            {/* Zoom pill */}
            <div className="flex flex-col rounded-2xl overflow-hidden border border-white/20 shadow-[0_4px_20px_rgba(0,0,0,0.3)] bg-white/90 backdrop-blur-sm">
              <button
                onClick={() => mapRef.current?.zoomIn()}
                className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors border-b border-gray-100 font-bold text-xl leading-none"
                title="Zoom in"
              >+</button>
              <button
                onClick={() => mapRef.current?.zoomOut()}
                className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors font-bold text-xl leading-none"
                title="Zoom out"
              >−</button>
            </div>

            {/* Geolocate */}
            <button
              onClick={handleGeolocate}
              disabled={geoLoading}
              className="w-10 h-10 rounded-2xl bg-white/90 backdrop-blur-sm border border-white/20 shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-700 transition-colors disabled:opacity-50"
              title="Find my location"
            >
              {geoLoading
                ? <Loader2 size={17} className="animate-spin text-emerald-600" />
                : <Locate size={17} className="text-gray-600" />
              }
            </button>

            {/* List view toggle (mobile) */}
            <button
              onClick={() => setView('list')}
              className="w-10 h-10 rounded-2xl bg-white/90 backdrop-blur-sm border border-white/20 shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-700 transition-colors sm:hidden"
              title="List view"
            >
              <List size={17} className="text-gray-600" />
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
