'use server'

import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface ClaimRow {
  id: string
  farm_osm_id: string
  farm_name: string
  farm_city: string | null
  full_name: string
  email: string
  phone: string
  verification_method: 'email' | 'kvk'
  kvk_number: string | null
  message: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  rejection_reason: string | null
}

export interface FarmAdminRow {
  osm_id: string
  name: string
  city: string | null
  country: string | null
  farm_type: string | null
  is_claimed: boolean | null
}

export async function getClaims(): Promise<ClaimRow[]> {
  const supabase = db()

  const { data: claims, error } = await supabase
    .from('farm_claims')
    .select('*')
    .order('created_at', { ascending: false })
    .range(0, 9999)

  if (error || !claims) return []

  const osmIds = [...new Set((claims as ClaimRow[]).map(c => c.farm_osm_id))]
  const { data: farms } = await supabase
    .from('farms')
    .select('osm_id, name, city')
    .in('osm_id', osmIds)

  const farmMap: Record<string, { name: string; city: string | null }> = {}
  for (const f of (farms ?? []) as FarmAdminRow[]) farmMap[f.osm_id] = f

  return (claims as ClaimRow[]).map(c => ({
    ...c,
    farm_name: farmMap[c.farm_osm_id]?.name ?? c.farm_osm_id,
    farm_city: farmMap[c.farm_osm_id]?.city ?? null,
  }))
}

export async function getFarmsAdmin(): Promise<{ farms: FarmAdminRow[]; pendingCount: number }> {
  const supabase = db()

  const all: FarmAdminRow[] = []
  const PAGE = 1000
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('farms')
      .select('osm_id, name, city, country, farm_type, is_claimed')
      .order('name')
      .range(from, from + PAGE - 1)

    if (error || !data) break
    all.push(...(data as FarmAdminRow[]))
    if (data.length < PAGE) break
    from += PAGE
  }

  const { count: pendingCount } = await supabase
    .from('farm_claims')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  return { farms: all, pendingCount: pendingCount ?? 0 }
}

export async function approveClaim(
  claimId: string,
  farmOsmId: string,
  reviewedBy: string,
): Promise<string | null> {
  const supabase = db()

  const { error: e1 } = await supabase
    .from('farm_claims')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy || null,
    })
    .eq('id', claimId)

  if (e1) return e1.message

  const { error: e2 } = await supabase
    .from('farms')
    .update({ is_claimed: true })
    .eq('osm_id', farmOsmId)

  return e2?.message ?? null
}

export async function rejectClaim(
  claimId: string,
  reason: string,
  reviewedBy: string,
): Promise<string | null> {
  const supabase = db()

  const { error } = await supabase
    .from('farm_claims')
    .update({
      status: 'rejected',
      rejection_reason: reason || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy || null,
    })
    .eq('id', claimId)

  return error?.message ?? null
}

export async function deleteFarm(osmId: string): Promise<string | null> {
  const supabase = db()
  const { error } = await supabase.from('farms').delete().eq('osm_id', osmId)
  return error?.message ?? null
}
