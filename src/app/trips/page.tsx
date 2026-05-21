'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Route, Plus, Trash2, Loader2, MapPin, Calendar, ExternalLink,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ContentLayout from '@/app/_components/ContentLayout'

interface Trip {
  id: string
  name: string
  created_at: string
  updated_at: string
  farm_count: number
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-NL', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export default function TripsPage() {
  const router = useRouter()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/auth/signin?redirect=/trips')
        return
      }

      const { data } = await supabase
        .from('trips')
        .select('id, name, created_at, updated_at, trip_farms(count)')
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false })

      if (data) {
        setTrips(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data as any[]).map(t => ({
            id: t.id,
            name: t.name,
            created_at: t.created_at,
            updated_at: t.updated_at,
            farm_count: (t.trip_farms?.[0] as { count: number } | undefined)?.count ?? 0,
          }))
        )
      }
      setLoading(false)
    })
  }, [router])

  async function deleteTrip(id: string) {
    if (!confirm('Delete this trip?')) return
    setDeleting(id)
    await supabase.from('trips').delete().eq('id', id)
    setTrips(prev => prev.filter(t => t.id !== id))
    setDeleting(null)
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

  return (
    <ContentLayout>

      {/* Hero */}
      <section className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="max-w-3xl mx-auto relative">
          <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest mb-3">Your routes</p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 flex items-center gap-4">
            My Trips
            <Route size={36} />
          </h1>
          <p className="text-emerald-100/70 text-lg">
            {trips.length === 0
              ? 'Plan and save your farm visit routes.'
              : `${trips.length} saved trip${trips.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </section>

      <div className="py-12 px-4 bg-gray-50 min-h-[50vh]">
        <div className="max-w-3xl mx-auto">

          <div className="mb-8">
            <Link
              href="/trips/new"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-full transition-colors shadow-md shadow-emerald-600/20"
            >
              <Plus size={16} />
              Plan new trip
            </Link>
          </div>

          {trips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 rounded-3xl bg-white border border-gray-100 shadow-sm flex items-center justify-center mb-6">
                <Route size={36} className="text-gray-200" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">No trips yet</h2>
              <p className="text-gray-400 text-sm mb-8 max-w-xs">
                Explore farms on the map, tap <strong className="text-gray-600">Add to trip</strong>, then save your route here.
              </p>
              <Link
                href="/map"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                Explore farms <ExternalLink size={14} />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {trips.map(trip => (
                <div
                  key={trip.id}
                  className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <Route size={20} className="text-emerald-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">{trip.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <MapPin size={11} />
                        {trip.farm_count} farm{trip.farm_count === 1 ? '' : 's'}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Calendar size={11} />
                        {fmt(trip.updated_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/trips/${trip.id}`}
                      className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-sm font-semibold text-gray-600 transition-colors"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => deleteTrip(trip.id)}
                      disabled={deleting === trip.id}
                      className="p-2 rounded-xl hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors disabled:opacity-50"
                      aria-label="Delete trip"
                    >
                      {deleting === trip.id
                        ? <Loader2 size={16} className="animate-spin" />
                        : <Trash2 size={16} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </ContentLayout>
  )
}
