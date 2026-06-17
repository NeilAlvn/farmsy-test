'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Wheat, ChevronRight, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ContentLayout from '@/app/_components/ContentLayout'

interface ClaimedFarm {
  osm_id: string
  name: string
  city: string | null
  image: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const [farms, setFarms] = useState<ClaimedFarm[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/auth/signin?redirect=/dashboard')
        return
      }

      const { data: claims } = await supabase
        .from('farm_claims')
        .select('farm_osm_id')
        .eq('status', 'approved')
        .or(`user_id.eq.${session.user.id},email.eq.${session.user.email}`)

      if (!claims || claims.length === 0) {
        setLoading(false)
        return
      }

      const osmIds = claims.map((c: { farm_osm_id: string }) => c.farm_osm_id)

      if (osmIds.length === 1) {
        router.replace(`/dashboard/${osmIds[0]}`)
        return
      }

      const { data: farmData } = await supabase
        .from('farms')
        .select('osm_id, name, city, image')
        .in('osm_id', osmIds)

      setFarms((farmData ?? []) as ClaimedFarm[])
      setLoading(false)
    })
  }, [router])

  if (loading) {
    return (
      <ContentLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 size={22} className="animate-spin text-gray-300" />
        </div>
      </ContentLayout>
    )
  }

  if (farms.length === 0) {
    return (
      <ContentLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-24">
          <div className="w-20 h-20 rounded-3xl bg-white border border-gray-100 shadow-sm flex items-center justify-center mb-6">
            <Shield size={36} className="text-gray-200" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No farms yet</h2>
          <p className="text-gray-400 text-sm mb-8 max-w-xs">
            You don&apos;t have any approved farm claims yet. Find your farm on the map and submit a claim.
          </p>
          <Link
            href="/map"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-full transition-colors shadow-md shadow-emerald-600/20"
          >
            <Wheat size={16} />
            Find farms
          </Link>
        </div>
      </ContentLayout>
    )
  }

  return (
    <ContentLayout>
      <section className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white py-16 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="max-w-3xl mx-auto relative">
          <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest mb-3">Farm Dashboard</p>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Your Farms</h1>
          <p className="text-emerald-100/70">{farms.length} claimed farm{farms.length === 1 ? '' : 's'}</p>
        </div>
      </section>

      <div className="py-12 px-4 bg-gray-50 min-h-[50vh]">
        <div className="max-w-2xl mx-auto space-y-3">
          {farms.map(farm => (
            <Link
              key={farm.osm_id}
              href={`/dashboard/${farm.osm_id}`}
              className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-all group"
            >
              <div className="w-14 h-14 rounded-xl bg-gray-100 shrink-0 overflow-hidden flex items-center justify-center">
                {farm.image
                  ? <img src={farm.image} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none' }} />
                  : <Wheat size={24} className="text-gray-300" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate">{farm.name}</p>
                {farm.city && <p className="text-sm text-gray-400 mt-0.5">{farm.city}</p>}
              </div>
              <ChevronRight size={18} className="text-gray-300 group-hover:text-emerald-500 transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </ContentLayout>
  )
}
