'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Search, Map as MapIcon, List, User, X } from 'lucide-react'
import Map, { Source, Layer, type MapRef, type MapLayerMouseEvent } from 'react-map-gl/maplibre'
import type { GeoJSONSource } from 'maplibre-gl'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import 'maplibre-gl/dist/maplibre-gl.css'

// ─── Categories & pin design (mirrors FarmMap.tsx) ────────────────────────────

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

const ICON_PATHS: Record<string, string> = {
  eggs:    `<path d="M12 2C8 2 4 8 4 14a8 8 0 0 0 16 0c0-6-4-12-8-12"/>`,
  dairy:   `<path d="M8 2h8"/><path d="M9 2v2.789a4 4 0 0 1-.672 2.219l-.656.984A4 4 0 0 0 7 10.212V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9.789a4 4 0 0 0-.672-2.219l-.656-.984A4 4 0 0 1 15 4.788V2"/><path d="M7 15a6.472 6.472 0 0 1 5 0 6.47 6.47 0 0 0 5 0"/>`,
  meat:    `<path d="M16.4 13.7A6.5 6.5 0 1 0 6.28 6.6c-1.1 3.13-.78 3.9-3.18 6.08A3 3 0 0 0 5 18c4 0 8.4-1.8 11.4-4.3"/><path d="m18.5 6 2.19 4.5a6.48 6.48 0 0 1-2.29 7.2C15.4 20.2 11 22 7 22a3 3 0 0 1-2.68-1.66L2.4 16.5"/><circle cx="12.5" cy="8.5" r="2.5"/>`,
  fish:    `<path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z"/><path d="M18 12v.5"/><path d="M16 17.93a9.77 9.77 0 0 1 0-11.86"/><path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33"/><path d="M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4"/><path d="m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98"/>`,
  produce: `<path d="M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.77 11.84 2.27 21.7 2.27 21.7zM8.64 14l-2.05-2.04M15.34 15l-2.46-2.46"/><path d="M22 9s-1.33-2-3.5-2C16.86 7 15 9 15 9s1.33 2 3.5 2S22 9 22 9z"/><path d="M15 2s-2 1.33-2 3.5S15 9 15 9s2-1.84 2-3.5C17 3.33 15 2 15 2z"/>`,
  cheese:  `<circle cx="12" cy="12" r="10"/>`,
  wine:    `<path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/>`,
  markets: `<path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/><path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"/><path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"/>`,
  honey:   `<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>`,
  organic: `<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>`,
}

function makePinSVG(color: string, catId?: string) {
  const iconPaths = catId ? (ICON_PATHS[catId] ?? '') : ''
  const iconSvg = iconPaths
    ? `<svg x="5" y="5" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">${iconPaths}</svg>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="62" viewBox="0 0 28 36"><path d="M14 0C6.268 0 0 6.268 0 14c0 9.625 14 22 14 22S28 23.625 28 14C28 6.268 21.732 0 14 0z" fill="${color}" stroke="white" stroke-width="2"/><circle cx="14" cy="14" r="9" fill="white"/>${iconSvg}</svg>`
}

const ICON_IMAGE_EXPR = [
  'match', ['get', 'category'],
  ...CATEGORIES.flatMap(c => [c.id, `pin-${c.id}`]),
  'pin-default',
]

// ─── Live clock ───────────────────────────────────────────────────────────────

function useLiveClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const fmt = () => {
      const n = new Date()
      return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
    }
    setTime(fmt())
    const msToNext = (60 - new Date().getSeconds()) * 1000
    const t = setTimeout(() => {
      setTime(fmt())
      const iv = setInterval(() => setTime(fmt()), 60_000)
      return () => clearInterval(iv)
    }, msToNext)
    return () => clearTimeout(t)
  }, [])
  return time
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Farm = {
  osm_id: string
  name: string
  city: string | null
  image: string | null
  farm_type: string[] | null
  lat: number
  lng: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhoneMap() {
  const router = useRouter()
  const mapRef = useRef<MapRef | null>(null)
  const time   = useLiveClock()

  const [geojson, setGeojson]     = useState<GeoJSON.FeatureCollection>({ type: 'FeatureCollection', features: [] })
  const [farmIndex, setFarmIndex] = useState<Record<string, Farm>>({})
  const [selected, setSelected]   = useState<Farm | null>(null)
  const [imgError, setImgError]   = useState(false)
  const [iconsReady, setIconsReady] = useState(false)
  const [cursor, setCursor]       = useState('grab')

  useEffect(() => {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    sb.rpc('get_farms_slim').limit(2000).then(({ data }) => {
      const rows = (data as Farm[]) ?? []
      const index: Record<string, Farm> = {}
      rows.forEach(f => { if (f.osm_id) index[f.osm_id] = f })
      setFarmIndex(index)
      setGeojson({
        type: 'FeatureCollection',
        features: rows
          .filter(f => f.lat != null && f.lng != null)
          .map(f => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [f.lng, f.lat] },
            properties: {
              osm_id:   f.osm_id,
              category: f.farm_type?.[0] ?? null,
            },
          })),
      })
    })
  }, [])

  // Load pin icons on map ready — same logic as FarmMap
  const handleMapLoad = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ml = mapRef.current?.getMap() as any
    if (!ml) return

    const entries = [
      ...CATEGORIES.map(c => ({ id: `pin-${c.id}`, color: c.color, catId: c.id })),
      { id: 'pin-default', color: '#94a3b8', catId: 'default' },
    ]

    let remaining = entries.length
    const done = () => { if (--remaining === 0) setIconsReady(true) }

    entries.forEach(({ id, color, catId }) => {
      if (ml.hasImage(id)) ml.removeImage(id)
      const img = new Image(48, 62)
      img.onload = () => { try { ml.addImage(id, img, { pixelRatio: 1.5 }) } catch { /* ignore */ } done() }
      img.onerror = done
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(makePinSVG(color, catId))}`
    })

    ml.on('styleimagemissing', (e: { id: string }) => {
      const id: string = e.id
      if (!id.startsWith('pin-') || ml.hasImage(id)) return
      const catId = id.replace('pin-', '')
      const cat   = CATEGORIES.find(c => c.id === catId)
      const color = cat?.color ?? '#94a3b8'
      const img   = new Image(48, 62)
      img.onload  = () => { try { ml.addImage(id, img, { pixelRatio: 1.5 }) } catch { /* ignore */ } }
      img.src     = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(makePinSVG(color, catId))}`
    })
  }, [])

  // Click: cluster → zoom in, pin → open card
  const handleClick = useCallback(async (e: MapLayerMouseEvent) => {
    const features = e.features ?? []

    if (features.length === 0) { setSelected(null); return }

    const feature = features[0]

    if (feature.layer.id === 'cluster-glow' || feature.layer.id === 'clusters') {
      const clusterId = feature.properties?.cluster_id as number | undefined
      if (clusterId == null) return
      try {
        const source = mapRef.current?.getSource('farms') as GeoJSONSource | undefined
        if (!source) return
        const zoom = await source.getClusterExpansionZoom(clusterId)
        const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates
        mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 600, essential: true })
      } catch { /* ignore */ }
      return
    }

    if (feature.layer.id === 'unclustered-point') {
      const osmId = feature.properties?.osm_id as string | undefined
      if (!osmId) return
      const farm = farmIndex[osmId]
      if (farm) { setImgError(false); setSelected(farm) }
    }
  }, [farmIndex])

  const typeLabel = selected?.farm_type?.[0]
    ? selected.farm_type[0].charAt(0).toUpperCase() + selected.farm_type[0].slice(1)
    : null

  return (
    <div style={{ minHeight: '580px' }}>
      <div className="relative z-0 mx-auto w-full max-w-[320px]">
        {/* Phone frame */}
        <div className="relative aspect-[9/19.5] rounded-[2.75rem] bg-neutral-900 p-[10px] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.35),0_18px_36px_-18px_rgba(56,80,40,0.25)] ring-1 ring-black/10">
          <span className="absolute -left-[3px] top-24 h-10 w-[3px] rounded-l bg-neutral-800" />
          <span className="absolute -left-[3px] top-40 h-16 w-[3px] rounded-l bg-neutral-800" />
          <span className="absolute -right-[3px] top-32 h-20 w-[3px] rounded-r bg-neutral-800" />

          {/* Screen */}
          <div className="relative h-full w-full overflow-hidden rounded-[2.15rem] bg-cream">
            <div className="absolute left-1/2 top-1.5 z-[1000] h-6 w-28 -translate-x-1/2 rounded-full bg-neutral-900" />

            {/* Status bar */}
            <div className="absolute left-0 right-0 top-0 z-[999] flex items-center justify-between px-6 pt-2 text-[11px] font-semibold text-neutral-900">
              <span suppressHydrationWarning>{time}</span>
              <div className="flex items-center gap-1">
                <SignalIcon />
                <WifiIcon />
                <BatteryIcon />
              </div>
            </div>

            {/* App header + search */}
            <div className="absolute left-0 right-0 top-9 z-[999] px-3 pt-3">
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="font-display text-base font-medium italic tracking-tight text-foreground">
                  Farmsy
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 ring-1 ring-black/5">
                  <Search className="h-3.5 w-3.5 text-foreground" strokeWidth={2} />
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 shadow-sm ring-1 ring-black/5 backdrop-blur">
                <Search className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
                <span className="text-[11px] text-muted-foreground">Find farms near you…</span>
              </div>
            </div>

            {/* Map */}
            <div className="absolute inset-0">
              <Map
                ref={mapRef}
                initialViewState={{ longitude: 5.2913, latitude: 52.1326, zoom: 6.8 }}
                style={{ width: '100%', height: '100%' }}
                mapStyle="https://tiles.openfreemap.org/styles/liberty"
                interactiveLayerIds={['cluster-glow', 'clusters', 'unclustered-point']}
                cursor={cursor}
                onLoad={handleMapLoad}
                onClick={handleClick}
                onMouseMove={(e: any) => setCursor(e.features?.length ? 'pointer' : 'grab')}
                onMouseLeave={() => setCursor('grab')}
                attributionControl={false}
              >
                <Source id="farms" type="geojson" data={geojson} cluster clusterMaxZoom={13} clusterRadius={50}>
                  {/* Cluster glow ring */}
                  <Layer
                    id="cluster-glow"
                    type="circle"
                    filter={['has', 'point_count']}
                    paint={{
                      'circle-color':   'rgba(22, 104, 52, 0.18)',
                      'circle-radius':  ['step', ['get', 'point_count'], 24, 20, 28, 100, 34],
                      'circle-blur':    0.4,
                      'circle-opacity': 1,
                    }}
                  />
                  {/* Cluster solid */}
                  <Layer
                    id="clusters"
                    type="circle"
                    filter={['has', 'point_count']}
                    paint={{
                      'circle-color':        '#166834',
                      'circle-radius':       ['step', ['get', 'point_count'], 16, 20, 20, 100, 25],
                      'circle-stroke-width': 2.5,
                      'circle-stroke-color': '#ffffff',
                      'circle-opacity':      1,
                    }}
                  />
                  {/* Cluster count */}
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
                    paint={{ 'text-color': '#ffffff', 'text-opacity': 1 }}
                  />
                  {/* Farm pins — shown once icons are loaded */}
                  {iconsReady && (
                    <Layer
                      id="unclustered-point"
                      type="symbol"
                      filter={['!', ['has', 'point_count']]}
                      layout={{
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        'icon-image':            ICON_IMAGE_EXPR as any,
                        'icon-size':             1,
                        'icon-anchor':           'bottom',
                        'icon-allow-overlap':    true,
                        'icon-ignore-placement': true,
                      }}
                      paint={{ 'icon-opacity': 1 }}
                    />
                  )}
                </Source>
              </Map>
            </div>

            {/* 12,000+ pill */}
            <div className="pointer-events-none absolute right-3 top-32 z-[800] rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-semibold text-foreground shadow-md ring-1 ring-black/5">
              <span className="text-primary">12,000+</span> farms
            </div>

            {/* Farm card */}
            {selected && (
              <div className="absolute bottom-20 left-3 right-3 z-[900] overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/8">
                <div className="flex gap-3 p-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                    {selected.image && !imgError
                      ? <img src={selected.image} alt={selected.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" onError={() => setImgError(true)} />
                      : <div className="flex h-full w-full items-center justify-center text-xl">🌾</div>
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-medium tracking-tight text-foreground">{selected.name}</p>
                    {(selected.city || typeLabel) && (
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                        {[selected.city, typeLabel].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <button onClick={() => setSelected(null)} className="shrink-0 text-muted-foreground" aria-label="Close">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  onClick={() => router.push(`/map?id=${selected.osm_id}`)}
                  className="flex w-full items-center justify-center bg-primary py-2 text-[11px] font-semibold text-primary-foreground"
                >
                  View Farm →
                </button>
              </div>
            )}

            {/* Bottom nav */}
            <div className="absolute bottom-0 left-0 right-0 z-[999] border-t border-black/5 bg-white/95 backdrop-blur">
              <div className="flex items-center justify-around px-6 py-2.5 pb-4">
                <NavItem icon={<MapIcon className="h-4 w-4" strokeWidth={2} />} label="Map" active />
                <NavItem icon={<List className="h-4 w-4" strokeWidth={2} />} label="List" />
                <NavItem icon={<User className="h-4 w-4" strokeWidth={2} />} label="Profile" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function NavItem({ icon, label, active }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-0.5 ${active ? 'text-primary' : 'text-muted-foreground'}`}>
      {icon}
      <span className="text-[9px] font-medium">{label}</span>
    </div>
  )
}

function SignalIcon() {
  return (
    <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor">
      <rect x="0"  y="7"   width="2.5" height="4"   rx="0.8" />
      <rect x="4"  y="5"   width="2.5" height="6"   rx="0.8" />
      <rect x="8"  y="2.5" width="2.5" height="8.5" rx="0.8" />
      <rect x="12" y="0"   width="2.5" height="11"  rx="0.8" opacity="0.3" />
    </svg>
  )
}

function WifiIcon() {
  // viewBox cropped to content (y 3.8–11.9) so the icon aligns with Signal/Battery
  return (
    <svg width="16" height="11" viewBox="0 3.8 14 8.2" fill="none" stroke="currentColor" strokeLinecap="round">
      <path d="M5.23 9.23 A2.5 2.5 0 0 1 8.77 9.23"  strokeWidth="1.4" />
      <path d="M3.82 7.82 A4.5 4.5 0 0 1 10.18 7.82" strokeWidth="1.4" />
      <path d="M2.40 6.40 A6.5 6.5 0 0 1 11.60 6.40" strokeWidth="1.4" />
      <circle cx="7" cy="11" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

function BatteryIcon() {
  return (
    <svg width="22" height="11" viewBox="0 0 22 11" fill="none">
      <rect x="0.5" y="0.5" width="18" height="10" rx="3" stroke="currentColor" strokeOpacity="0.4" />
      <rect x="19.5" y="3.2" width="2" height="4.6" rx="1" fill="currentColor" fillOpacity="0.4" />
      <rect x="2" y="2" width="12" height="7" rx="2" fill="currentColor" />
    </svg>
  )
}
