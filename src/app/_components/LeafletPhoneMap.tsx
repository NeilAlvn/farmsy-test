'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import { createClient } from '@supabase/supabase-js'

type FarmPin = {
  osm_id: string
  name: string
  city: string | null
  lat: number
  lng: number
  farm_type: string[] | null
}

export default function LeafletPhoneMap({ height }: { height: number }) {
  const [farms, setFarms] = useState<FarmPin[]>([])
  const [loading, setLoading] = useState(true)

  const farmIcon = useMemo(
    () =>
      L.divIcon({
        className: '',
        html: '<div style="width:8px;height:8px;background:#3F5E3A;border-radius:50%;border:1.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.25)"></div>',
        iconSize: [8, 8],
        iconAnchor: [4, 4],
      }),
    [],
  )

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    supabase
      .rpc('get_farms_slim')
      .limit(1000)
      .then(({ data }) => {
        const valid = ((data as FarmPin[]) ?? []).filter(
          f => f.lat != null && f.lng != null,
        )
        setFarms(valid)
        setLoading(false)
      })
  }, [])

  return (
    <div style={{ position: 'relative', height, width: '100%' }}>
      <MapContainer
        center={[52.2, 5.3]}
        zoom={7}
        minZoom={6}
        maxZoom={14}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        {farms.length > 0 && (
          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={40}
            showCoverageOnHover={false}
          >
            {farms.map(farm => (
              <Marker
                key={farm.osm_id}
                position={[farm.lat, farm.lng]}
                icon={farmIcon}
              >
                <Popup>
                  <div style={{ padding: '6px 10px', minWidth: 140, maxWidth: 180 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 12,
                        color: '#0F0F0F',
                        marginBottom: 3,
                        lineHeight: 1.3,
                      }}
                    >
                      {farm.name}
                    </div>
                    {farm.city && (
                      <div style={{ fontSize: 10, color: '#6B6B6B', marginBottom: 5 }}>
                        📍 {farm.city}
                      </div>
                    )}
                    {farm.farm_type?.[0] && (
                      <span
                        style={{
                          backgroundColor: '#E8EDE5',
                          color: '#3F5E3A',
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 20,
                        }}
                      >
                        {farm.farm_type[0]}
                      </span>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        )}
      </MapContainer>

      {/* Loading overlay */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'oklch(0.985 0.005 85 / 0.9)',
            backdropFilter: 'blur(2px)',
            zIndex: 1000,
          }}
        >
          <div
            className="animate-spin"
            style={{
              width: 22,
              height: 22,
              border: '2px solid #3F5E3A',
              borderTopColor: 'transparent',
              borderRadius: '50%',
            }}
          />
        </div>
      )}

      {/* Farm count badge */}
      {!loading && farms.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'white',
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: 10,
            fontWeight: 700,
            color: '#0F0F0F',
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            zIndex: 500,
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: '#3F5E3A',
              display: 'inline-block',
            }}
          />
          {farms.length.toLocaleString('nl-NL')}+ farms
        </div>
      )}
    </div>
  )
}
