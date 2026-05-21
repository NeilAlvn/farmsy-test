'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  Route, GripVertical, X, MapPin, Save, Map as MapIcon,
  ArrowRight, Loader2, CheckCircle2, AlertCircle, Plus, Wheat,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTrip, type TripFarm } from '@/app/_components/TripProvider'
import ContentLayout from '@/app/_components/ContentLayout'

const TripMap = dynamic(() => import('./TripMap'), { ssr: false })

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function totalKm(farms: TripFarm[]) {
  let total = 0
  for (let i = 1; i < farms.length; i++) {
    total += haversineKm(farms[i - 1].lat, farms[i - 1].lng, farms[i].lat, farms[i].lng)
  }
  return total
}

function buildGoogleMapsUrl(farms: TripFarm[]) {
  if (farms.length === 0) return ''
  if (farms.length === 1) return `https://www.google.com/maps/search/?api=1&query=${farms[0].lat},${farms[0].lng}`
  const origin = `${farms[0].lat},${farms[0].lng}`
  const dest = `${farms[farms.length - 1].lat},${farms[farms.length - 1].lng}`
  const middle = farms.slice(1, -1).map(f => `${f.lat},${f.lng}`).join('|')
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`
  if (middle) url += `&waypoints=${encodeURIComponent(middle)}`
  return url
}

export default function TripBuilderPage() {
  const router = useRouter()
  const { pendingFarms, removeFarm, reorder, clear } = useTrip()

  const [tripName, setTripName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // HTML5 drag-and-drop state
  // dragIdxRef for synchronous access in handlers; dragging state for re-render-driven opacity
  const dragIdxRef = useRef<number | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const distance = totalKm(pendingFarms)

  function handleDragStart(i: number) {
    dragIdxRef.current = i
    setDragging(i)
  }

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault()
    if (dragIdxRef.current !== i) setDragOverIdx(i)
  }

  function handleDrop(i: number) {
    if (dragIdxRef.current !== null && dragIdxRef.current !== i) {
      reorder(dragIdxRef.current, i)
    }
    dragIdxRef.current = null
    setDragging(null)
    setDragOverIdx(null)
  }

  function handleDragEnd() {
    dragIdxRef.current = null
    setDragging(null)
    setDragOverIdx(null)
  }

  async function saveTrip() {
    if (!tripName.trim()) {
      setSaveMsg({ type: 'err', text: 'Please give your trip a name.' })
      return
    }
    if (pendingFarms.length === 0) {
      setSaveMsg({ type: 'err', text: 'Add at least one farm before saving.' })
      return
    }

    setSaving(true)
    setSaveMsg(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push(`/auth/signin?redirect=/trips/new`)
      setSaving(false)
      return
    }

    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .insert({ user_id: session.user.id, name: tripName.trim() })
      .select('id')
      .single()

    if (tripErr || !trip) {
      setSaveMsg({ type: 'err', text: 'Could not save trip. Please try again.' })
      setSaving(false)
      return
    }

    const { error: farmsErr } = await supabase
      .from('trip_farms')
      .insert(
        pendingFarms.map((f, i) => ({
          trip_id: trip.id,
          farm_osm_id: f.osmId,
          farm_name: f.name,
          farm_lat: f.lat,
          farm_lng: f.lng,
          farm_city: f.city,
          farm_image: f.image,
          sort_order: i,
        }))
      )

    if (farmsErr) {
      await supabase.from('trips').delete().eq('id', trip.id)
      setSaveMsg({ type: 'err', text: 'Could not save farms. Please try again.' })
      setSaving(false)
      return
    }

    clear()
    setSaving(false)
    router.push(`/trips/${trip.id}`)
  }

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (pendingFarms.length === 0) {
    return (
      <ContentLayout>
        <section className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white py-20 px-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          <div className="max-w-3xl mx-auto relative">
            <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest mb-3">Plan your visit</p>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 flex items-center gap-4">
              Trip Builder
              <Route size={36} />
            </h1>
            <p className="text-emerald-100/70 text-lg">Build your perfect farm route.</p>
          </div>
        </section>

        <div className="py-24 px-4 bg-gray-50 flex flex-col items-center text-center min-h-[50vh]">
          <div className="w-20 h-20 rounded-3xl bg-white border border-gray-100 shadow-sm flex items-center justify-center mb-6">
            <Wheat size={36} className="text-gray-200" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No farms added yet</h2>
          <p className="text-gray-400 text-sm mb-8 max-w-xs">
            Open a farm on the map and tap <strong className="text-gray-600">Add to trip</strong> to start building your route.
          </p>
          <Link
            href="/map"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-full transition-colors shadow-md shadow-emerald-600/20"
          >
            <MapPin size={16} />
            Explore farms
            <ArrowRight size={16} />
          </Link>
        </div>
      </ContentLayout>
    )
  }

  // ── Builder UI ──────────────────────────────────────────────────────────────

  return (
    <ContentLayout>

      {/* Hero */}
      <section className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white py-10 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="max-w-6xl mx-auto relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest mb-2">Plan your visit</p>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <Route size={26} />
              Trip Builder
            </h1>
            <p className="text-emerald-100/70 text-sm mt-2">
              {pendingFarms.length} farm{pendingFarms.length === 1 ? '' : 's'}
              {pendingFarms.length > 1 && ` · ~${distance.toFixed(0)} km`}
            </p>
          </div>
          <Link
            href="/map"
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-bold px-4 py-2.5 rounded-full transition-colors border border-white/20 self-start sm:self-auto"
          >
            <Plus size={15} />
            Add more farms
          </Link>
        </div>
      </section>

      <div className="bg-gray-50 min-h-[70vh]">
        <div className="max-w-6xl mx-auto px-4 py-8">

          {saveMsg && (
            <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-medium mb-6 ${
              saveMsg.type === 'ok'
                ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                : 'bg-red-50 border border-red-100 text-red-600'
            }`}>
              {saveMsg.type === 'ok'
                ? <CheckCircle2 size={15} className="shrink-0" />
                : <AlertCircle size={15} className="shrink-0" />}
              {saveMsg.text}
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-6">

            {/* ── Left: controls ──────────────────────────────────────────── */}
            <div className="lg:w-[380px] shrink-0 flex flex-col gap-4">

              {/* Trip name */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Trip name
                </label>
                <input
                  type="text"
                  value={tripName}
                  onChange={e => setTripName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveTrip() }}
                  placeholder="e.g. Weekend farm tour"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                />
              </div>

              {/* Farm list */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-900">Stops</h2>
                  <span className="text-xs text-gray-400">{pendingFarms.length} farm{pendingFarms.length === 1 ? '' : 's'}</span>
                </div>

                <div className="divide-y divide-gray-50">
                  {pendingFarms.map((farm, i) => (
                    <div
                      key={farm.osmId}
                      draggable
                      onDragStart={() => handleDragStart(i)}
                      onDragOver={e => handleDragOver(e, i)}
                      onDrop={() => handleDrop(i)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-3 px-4 py-3 select-none transition-all cursor-grab active:cursor-grabbing ${
                        dragOverIdx === i
                          ? 'bg-emerald-50 border-l-4 border-emerald-400'
                          : 'border-l-4 border-transparent'
                      }`}
                      style={{ opacity: dragging === i ? 0.35 : 1 }}
                    >
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                        {i + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{farm.name}</p>
                        {farm.city && <p className="text-xs text-gray-400">{farm.city}</p>}
                      </div>

                      <GripVertical size={16} className="text-gray-300 shrink-0" />

                      <button
                        onMouseDown={e => e.stopPropagation()}
                        onClick={() => removeFarm(farm.osmId)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors shrink-0"
                        aria-label="Remove farm"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {pendingFarms.length > 1 && (
                  <div className="px-5 py-3 bg-gray-50/60 border-t border-gray-50">
                    <p className="text-[11px] text-gray-400">Drag farms to reorder your route</p>
                  </div>
                )}
              </div>

              {/* Distance */}
              {pendingFarms.length > 1 && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4">
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">
                    Estimated route distance
                  </p>
                  <p className="text-2xl font-black text-emerald-700">
                    {distance.toFixed(1)} <span className="text-base font-bold">km</span>
                  </p>
                  <p className="text-[11px] text-emerald-600/50 mt-0.5">Straight-line between stops</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={saveTrip}
                  disabled={saving || !tripName.trim()}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors shadow-md shadow-emerald-600/20"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save trip
                </button>

                {pendingFarms.length >= 2 && (
                  <a
                    href={buildGoogleMapsUrl(pendingFarms)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-gray-900 hover:bg-gray-700 text-white text-sm font-bold transition-colors"
                  >
                    <MapIcon size={16} />
                    Open in Google Maps
                  </a>
                )}

                <button
                  onClick={clear}
                  className="py-1 text-sm text-gray-400 hover:text-red-500 transition-colors"
                >
                  Clear all farms
                </button>
              </div>
            </div>

            {/* ── Right: map ──────────────────────────────────────────────── */}
            <div className="flex-1 min-h-[400px] lg:min-h-0">
              <div className="sticky top-24 h-[70vh] max-h-[640px] rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
                <TripMap farms={pendingFarms} />
              </div>
            </div>

          </div>
        </div>
      </div>
    </ContentLayout>
  )
}
