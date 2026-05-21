'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface ViewFarm {
  id: string
  farm_lat: number
  farm_lng: number
}

function numberIcon(n: number): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <div style="width:32px;height:38px;display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.25));">
        <div style="width:32px;height:32px;background:#059669;border-radius:50%;border:2.5px solid white;display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:900;font-family:sans-serif;">${n}</div>
        <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:6px solid #059669;"></div>
      </div>
    `,
    iconSize: [32, 38],
    iconAnchor: [16, 38],
  })
}

function FitBounds({ farms }: { farms: ViewFarm[] }) {
  const map = useMap()
  useEffect(() => {
    if (farms.length === 0) return
    if (farms.length === 1) {
      map.setView([farms[0].farm_lat, farms[0].farm_lng], 13)
      return
    }
    const bounds = L.latLngBounds(farms.map(f => [f.farm_lat, f.farm_lng] as [number, number]))
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function TripViewMap({ farms }: { farms: ViewFarm[] }) {
  const center: [number, number] = farms.length > 0
    ? [farms[0].farm_lat, farms[0].farm_lng]
    : [52.1326, 5.2913]

  const positions = farms.map(f => [f.farm_lat, f.farm_lng] as [number, number])

  return (
    <MapContainer
      center={center}
      zoom={8}
      style={{ height: '100%', width: '100%' }}
      zoomControl
      scrollWheelZoom
    >
      <FitBounds farms={farms} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      {farms.map((farm, i) => (
        <Marker
          key={farm.id}
          position={[farm.farm_lat, farm.farm_lng]}
          icon={numberIcon(i + 1)}
        />
      ))}
      {positions.length > 1 && (
        <Polyline
          positions={positions}
          pathOptions={{ color: '#059669', weight: 3, opacity: 0.75, dashArray: '8, 6' }}
        />
      )}
    </MapContainer>
  )
}
