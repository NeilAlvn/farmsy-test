'use client'

import { useEffect, useState } from 'react'
import Map, { Source, Layer } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { createClient } from '@supabase/supabase-js'

type FarmPin = { osm_id: string; lat: number; lng: number }

export default function LeafletPhoneMap({ height }: { height: number }) {
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection>({ type: 'FeatureCollection', features: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    sb.rpc('get_farms_slim').limit(2000).then(({ data }) => {
      const features = ((data as FarmPin[]) ?? [])
        .filter(f => f.lat != null && f.lng != null)
        .map(f => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [f.lng, f.lat] }, properties: {} }))
      setGeojson({ type: 'FeatureCollection', features })
      setLoading(false)
    })
  }, [])

  return (
    <div style={{ position: 'relative', height, width: '100%' }}>
      <Map
        initialViewState={{ longitude: 5.2913, latitude: 52.1326, zoom: 6.8 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
        scrollZoom={false}
        dragPan={false}
        dragRotate={false}
        doubleClickZoom={false}
        touchZoomRotate={false}
        keyboard={false}
        attributionControl={false}
      >
        <Source id="farms" type="geojson" data={geojson} cluster clusterMaxZoom={12} clusterRadius={40}>
          {/* Cluster circle */}
          <Layer id="clusters" type="circle" filter={['has', 'point_count']} paint={{
            'circle-color': '#3F5E3A',
            'circle-radius': ['step', ['get', 'point_count'], 8, 20, 11, 100, 14],
            'circle-opacity': 0.85,
          }} />
          {/* Cluster count */}
          <Layer id="cluster-count" type="symbol" filter={['has', 'point_count']} layout={{
            'text-field': '{point_count_abbreviated}',
            'text-font': ['Open Sans Bold'],
            'text-size': 9,
          }} paint={{ 'text-color': '#ffffff' }} />
          {/* Single farm dot */}
          <Layer id="unclustered" type="circle" filter={['!', ['has', 'point_count']]} paint={{
            'circle-color': '#3F5E3A',
            'circle-radius': 4,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
          }} />
        </Source>
      </Map>

      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(0.985 0.005 85 / 0.85)', zIndex: 10 }}>
          <div className="animate-spin" style={{ width: 20, height: 20, border: '2px solid #3F5E3A', borderTopColor: 'transparent', borderRadius: '50%' }} />
        </div>
      )}

      {!loading && geojson.features.length > 0 && (
        <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', backgroundColor: 'white', borderRadius: 20, padding: '4px 12px', fontSize: 10, fontWeight: 700, color: '#0F0F0F', boxShadow: '0 2px 12px rgba(0,0,0,0.15)', zIndex: 5, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#3F5E3A', display: 'inline-block' }} />
          {geojson.features.length.toLocaleString('nl-NL')}+ farms
        </div>
      )}
    </div>
  )
}
