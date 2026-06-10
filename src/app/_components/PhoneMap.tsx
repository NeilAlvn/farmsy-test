'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import { Search, Map as MapIcon, List, User, Wifi, BatteryFull, Signal } from 'lucide-react'

type Farm = {
  id: number
  name: string
  city: string
  country: 'NL' | 'BE'
  type: string
  lat: number
  lng: number
  highlighted?: boolean
}

const FARMS: Farm[] = [
  { id: 1,  name: 'Boerderij De Kievit',       city: 'Utrecht',    country: 'NL', type: 'Organic Dairy',  lat: 52.0907, lng: 5.1214, highlighted: true },
  { id: 2,  name: 'Hoeve Het Groene Land',      city: 'Amersfoort', country: 'NL', type: 'Vegetables',     lat: 52.1561, lng: 5.3878 },
  { id: 3,  name: 'Tuinderij Zonneveld',        city: 'Haarlem',    country: 'NL', type: 'Market Garden',  lat: 52.3874, lng: 4.6462 },
  { id: 4,  name: 'Boerderij De Eik',           city: 'Groningen',  country: 'NL', type: 'Dairy',          lat: 53.2194, lng: 6.5665 },
  { id: 5,  name: 'Hof van Eden',               city: 'Maastricht', country: 'NL', type: 'Orchard',        lat: 50.8514, lng: 5.6910 },
  { id: 6,  name: 'De Nieuwe Akker',            city: 'Eindhoven',  country: 'NL', type: 'Mixed Farm',     lat: 51.4416, lng: 5.4697 },
  { id: 7,  name: 'Bio Boerderij Klaver',       city: 'Zwolle',     country: 'NL', type: 'Organic',        lat: 52.5168, lng: 6.0830 },
  { id: 8,  name: 'Polder Producten',           city: 'Lelystad',   country: 'NL', type: 'Grains',         lat: 52.5185, lng: 5.4714 },
  { id: 9,  name: 'Boerderij De Klaproos',      city: 'Den Bosch',  country: 'NL', type: 'Berries',        lat: 51.6978, lng: 5.3037 },
  { id: 10, name: 'Hoeve De Linde',             city: 'Nijmegen',   country: 'NL', type: 'Cheese',         lat: 51.8126, lng: 5.8372 },
  { id: 11, name: 'Ferme du Vieux Moulin',      city: 'Liège',      country: 'BE', type: 'Dairy',          lat: 50.6326, lng: 5.5797 },
  { id: 12, name: "Boerderij 't Vlasveld",      city: 'Gent',       country: 'BE', type: 'Vegetables',     lat: 51.0543, lng: 3.7174 },
  { id: 13, name: 'Ferme de la Vallée',         city: 'Namur',      country: 'BE', type: 'Organic',        lat: 50.4674, lng: 4.8720 },
  { id: 14, name: 'Hoeve De Wilg',              city: 'Antwerp',    country: 'BE', type: 'Market Garden',  lat: 51.2194, lng: 4.4025 },
  { id: 15, name: 'Ferme des Quatre Saisons',   city: 'Charleroi',  country: 'BE', type: 'Mixed Farm',     lat: 50.4108, lng: 4.4446 },
  { id: 16, name: 'Boerderij Het Zwin',         city: 'Bruges',     country: 'BE', type: 'Sheep',          lat: 51.2093, lng: 3.2247 },
  { id: 17, name: 'Ferme Belle Vue',            city: 'Mons',       country: 'BE', type: 'Orchard',        lat: 50.4542, lng: 3.9514 },
  { id: 18, name: 'Tuinderij De Bron',          city: 'Leuven',     country: 'BE', type: 'Herbs',          lat: 50.8798, lng: 4.7005 },
]

export default function PhoneMap() {
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [LeafletMod, setLeafletMod] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [RL, setRL] = useState<any>(null)
  const [selected, setSelected] = useState<Farm | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([import('leaflet'), import('react-leaflet')]).then(([L, rl]) => {
      if (!active) return
      setLeafletMod(L)
      setRL(rl)
      setMounted(true)
    })
    return () => { active = false }
  }, [])

  return (
    <div style={{ minHeight: '580px' }}>
    <div className="relative z-0 mx-auto w-full max-w-[320px]">
      {/* Phone frame */}
      <div className="relative aspect-[9/19.5] rounded-[2.75rem] bg-neutral-900 p-[10px] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.35),0_18px_36px_-18px_rgba(56,80,40,0.25)] ring-1 ring-black/10">
        {/* Side buttons */}
        <span className="absolute -left-[3px] top-24 h-10 w-[3px] rounded-l bg-neutral-800" />
        <span className="absolute -left-[3px] top-40 h-16 w-[3px] rounded-l bg-neutral-800" />
        <span className="absolute -right-[3px] top-32 h-20 w-[3px] rounded-r bg-neutral-800" />

        {/* Screen */}
        <div className="relative h-full w-full overflow-hidden rounded-[2.15rem] bg-cream">
          {/* Notch */}
          <div className="absolute left-1/2 top-1.5 z-[1000] h-6 w-28 -translate-x-1/2 rounded-full bg-neutral-900" />

          {/* Status bar */}
          <div className="absolute left-0 right-0 top-0 z-[999] flex items-center justify-between px-6 pt-2 text-[11px] font-semibold text-neutral-900">
            <span>15:40</span>
            <div className="flex items-center gap-1">
              <Signal className="h-3 w-3" strokeWidth={2.5} />
              <Wifi className="h-3 w-3" strokeWidth={2.5} />
              <BatteryFull className="h-3.5 w-3.5" strokeWidth={2.5} />
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
            {mounted && LeafletMod && RL ? (
              <LeafletInner
                L={LeafletMod}
                RL={RL}
                onSelect={setSelected}
                selectedId={selected?.id ?? null}
              />
            ) : (
              <div className="h-full w-full bg-cream" />
            )}
          </div>

          {/* 12,000+ overlay */}
          <div className="pointer-events-none absolute right-3 top-32 z-[800] rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-semibold text-foreground shadow-md ring-1 ring-black/5">
            <span className="text-primary">12,000+</span> farms
          </div>

          {/* Floating farm card */}
          {selected && (
            <div className="absolute bottom-20 left-3 right-3 z-[900] rounded-2xl bg-white/98 p-3 shadow-xl ring-1 ring-black/5 backdrop-blur">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-medium tracking-tight text-foreground">
                    {selected.name}
                  </p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {selected.city}, {selected.country} · {selected.type}
                  </p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <button className="mt-2.5 inline-flex w-full items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground">
                View Farm
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

function LeafletInner({
  L,
  RL,
  onSelect,
  selectedId,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  L: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RL: any
  onSelect: (f: Farm) => void
  selectedId: number | null
}) {
  const { MapContainer, TileLayer, Marker } = RL

  const makeIcon = (highlighted: boolean, active: boolean) => {
    const size = active ? 30 : highlighted ? 26 : 22
    const color = active ? '#2d5a2d' : highlighted ? '#3a6b3a' : '#5a7d5a'
    const ring = active ? 'rgba(45,90,45,0.25)' : 'rgba(90,125,90,0.18)'
    const html = `
      <div style="
        width:${size}px;height:${size}px;border-radius:9999px;
        background:${color};border:2px solid #fdfbf5;
        box-shadow:0 0 0 4px ${ring}, 0 2px 6px rgba(0,0,0,0.2);
        display:flex;align-items:center;justify-content:center;">
        <div style="width:6px;height:6px;border-radius:9999px;background:#fdfbf5"></div>
      </div>`
    return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
  }

  return (
    <MapContainer
      center={[51.5, 4.9]}
      zoom={7}
      minZoom={6}
      maxZoom={11}
      zoomControl={false}
      attributionControl={false}
      style={{ width: '100%', height: '100%', background: 'oklch(0.94 0.025 85)' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        subdomains={['a', 'b', 'c', 'd']}
      />
      {FARMS.map(f => (
        <Marker
          key={f.id}
          position={[f.lat, f.lng]}
          icon={makeIcon(!!f.highlighted, selectedId === f.id)}
          eventHandlers={{ click: () => onSelect(f) }}
        />
      ))}
    </MapContainer>
  )
}
