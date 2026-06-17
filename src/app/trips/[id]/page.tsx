'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  Route, MapPin, Map as MapIcon, Link2, CheckCircle2,
  ArrowRight, Loader2, Plus, Wheat,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ContentLayout from '@/app/_components/ContentLayout'
import { useTrip } from '@/app/_components/TripProvider'
import type { ViewFarm } from './TripViewMap'

const TripViewMap = dynamic(() => import('./TripViewMap'), { ssr: false })

interface TripFarmRow extends ViewFarm {
  farm_osm_id: string
  farm_name: string
  farm_city: string | null
  farm_image: string | null
  sort_order: number
}

interface Trip {
  id: string
  name: string
  created_at: string
  farms: TripFarmRow[]
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function buildGoogleMapsUrl(farms: TripFarmRow[]) {
  if (farms.length === 0) return ''
  if (farms.length === 1) return `https://www.google.com/maps/search/?api=1&query=${farms[0].farm_lat},${farms[0].farm_lng}`
  const origin = `${farms[0].farm_lat},${farms[0].farm_lng}`
  const dest = `${farms[farms.length - 1].farm_lat},${farms[farms.length - 1].farm_lng}`
  const middle = farms.slice(1, -1).map(f => `${f.farm_lat},${f.farm_lng}`).join('|')
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`
  if (middle) url += `&waypoints=${encodeURIComponent(middle)}`
  return url
}

export default function TripViewPage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params?.id as string

  const [trip, setTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)

  const { addFarm } = useTrip()

  useEffect(() => {
    if (!tripId) return

    supabase
      .from('trips')
      .select('id, name, created_at')
      .eq('id', tripId)
      .maybeSingle()
      .then(async ({ data: tripData, error }) => {
        if (error || !tripData) {
          setNotFound(true)
          setLoading(false)
          return
        }

        const { data: farms } = await supabase
          .from('trip_farms')
          .select('id, farm_osm_id, farm_name, farm_lat, farm_lng, farm_city, farm_image, sort_order')
          .eq('trip_id', tripId)
          .order('sort_order')

        setTrip({
          id: tripData.id,
          name: tripData.name,
          created_at: tripData.created_at,
          farms: (farms ?? []) as TripFarmRow[],
        })
        setLoading(false)
      })
  }, [tripId])

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  function copyToMyTrip() {
    if (!trip) return
    for (const farm of trip.farms) {
      addFarm({
        osmId: farm.farm_osm_id,
        name: farm.farm_name,
        lat: farm.farm_lat,
        lng: farm.farm_lng,
        city: farm.farm_city,
        image: farm.farm_image,
        farmType: null,
      })
    }
    router.push('/trips/new')
  }

  if (loading) {
    return (
      <ContentLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 size={22} className="animate-spin text-gray-300" />
        </div>
      </ContentLayout>
    )
  }

  if (notFound || !trip) {
    return (
      <ContentLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-24">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-5">
            <Wheat size={28} className="text-gray-200" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Trip not found</h2>
          <p className="text-gray-400 text-sm mb-6 max-w-xs">
            This trip may have been deleted or the link is incorrect.
          </p>
          <Link href="/trips" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
            My trips
          </Link>
        </div>
      </ContentLayout>
    )
  }

  const distance = trip.farms.reduce((total, f, i) => {
    if (i === 0) return 0
    return total + haversineKm(trip.farms[i - 1].farm_lat, trip.farms[i - 1].farm_lng, f.farm_lat, f.farm_lng)
  }, 0)

  return (
    <ContentLayout>

      {/* Hero */}
      <section className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white py-16 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="max-w-6xl mx-auto relative">
          <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest mb-3">Farm visit plan</p>
          <h1 className="text-4xl font-extrabold tracking-tight mb-3 flex items-center gap-3">
            <Route size={30} />
            {trip.name}
          </h1>
          <div className="flex items-center gap-5 text-sm text-emerald-100/70">
            <span className="flex items-center gap-1.5">
              <MapPin size={13} />
              {trip.farms.length} farm{trip.farms.length === 1 ? '' : 's'}
            </span>
            {trip.farms.length > 1 && (
              <span>~{distance.toFixed(1)} km route</span>
            )}
          </div>
        </div>
      </section>

      {/* Action bar */}
      <div className="bg-white border-b border-gray-100 sticky top-16 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <button
            onClick={copyLink}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all border ${
              copied
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-white border-gray-200 text-gray-700 hover:border-emerald-300 hover:text-emerald-700'
            }`}
          >
            {copied ? <CheckCircle2 size={14} /> : <Link2 size={14} />}
            {copied ? 'Copied!' : 'Copy share link'}
          </button>

          {trip.farms.length >= 2 && (
            <a
              href={buildGoogleMapsUrl(trip.farms)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-white border border-gray-200 text-gray-700 hover:border-gray-300 transition-colors"
            >
              <MapIcon size={14} />
              Open in Google Maps
            </a>
          )}

          <button
            onClick={copyToMyTrip}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm shadow-emerald-600/20"
          >
            <Plus size={14} />
            Copy to my trip
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-gray-50 py-8 px-4 min-h-[50vh]">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">

          {/* Farm list */}
          <div className="lg:w-[380px] shrink-0">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <h2 className="text-sm font-bold text-gray-900">Stops</h2>
              </div>

              {trip.farms.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400">
                  No farms in this trip.
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {trip.farms.map((farm, i) => (
                    <div key={farm.id} className="flex items-center gap-3 px-4 py-4">
                      <div className="w-7 h-7 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                        {i + 1}
                      </div>

                      {farm.farm_image && (
                        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                          <img
                            src={farm.farm_image}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                            onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none' }}
                          />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{farm.farm_name}</p>
                        {farm.farm_city && <p className="text-xs text-gray-400">{farm.farm_city}</p>}
                      </div>

                      <Link
                        href={`/map?id=${farm.farm_osm_id}`}
                        className="p-2 rounded-lg hover:bg-emerald-50 text-gray-300 hover:text-emerald-600 transition-colors shrink-0"
                        title="View on map"
                      >
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 min-h-[400px] lg:min-h-0">
            <div className="sticky top-28 h-[60vh] max-h-[560px] rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
              <TripViewMap farms={trip.farms} />
            </div>
          </div>

        </div>
      </div>

    </ContentLayout>
  )
}
