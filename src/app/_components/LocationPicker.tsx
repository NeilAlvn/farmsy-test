'use client'

import { useEffect, useRef } from 'react'
import Map, { Marker, type MapRef, type MapLayerMouseEvent } from 'react-map-gl/maplibre'
import type { MarkerDragEvent } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MapPin } from 'lucide-react'

interface Props {
  lat: number | null
  lng: number | null
  // Bumped by the parent (e.g. after an address-autocomplete pick) to recenter
  // the map on the current lat/lng. Dragging/clicking does NOT bump this.
  flyKey: number
  onChange: (lat: number, lng: number) => void
}

export default function LocationPicker({ lat, lng, flyKey, onChange }: Props) {
  const mapRef = useRef<MapRef | null>(null)
  const has = lat != null && lng != null

  // Recenter when the parent asks (address selected).
  useEffect(() => {
    if (flyKey === 0 || lat == null || lng == null) return
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 800 })
  }, [flyKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = (e: MapLayerMouseEvent) => onChange(e.lngLat.lat, e.lngLat.lng)
  const handleDragEnd = (e: MarkerDragEvent) => onChange(e.lngLat.lat, e.lngLat.lng)

  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)' }}>
      <Map
        ref={mapRef}
        initialViewState={{ longitude: lng ?? 5.2913, latitude: lat ?? 52.1326, zoom: has ? 14 : 6 }}
        style={{ width: '100%', height: 280 }}
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
        onClick={handleClick}
        cursor="crosshair"
      >
        {has && (
          <Marker longitude={lng!} latitude={lat!} draggable anchor="bottom" onDragEnd={handleDragEnd}>
            <MapPin size={32} fill="#3F5E3A" stroke="#ffffff" strokeWidth={1.5} className="drop-shadow" />
          </Marker>
        )}
      </Map>
    </div>
  )
}
