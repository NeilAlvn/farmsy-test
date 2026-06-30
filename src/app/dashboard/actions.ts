'use server'

import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function verifyClaim(supabase: ReturnType<typeof db>, osmId: string, userId: string, userEmail: string) {
  const { data } = await supabase
    .from('farm_claims')
    .select('id')
    .eq('farm_osm_id', osmId)
    .eq('status', 'approved')
    .or(`user_id.eq.${userId},email.eq.${userEmail}`)
    .maybeSingle()
  return !!data
}

export interface ClaimedFarmSummary {
  osm_id: string
  name: string
  city: string | null
  image: string | null
}

export interface FarmEditData {
  osm_id: string
  name: string
  description: string | null
  phone: string | null
  website: string | null
  email: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  farm_type: string[] | null
  image: string | null
  opening_hours: string | null
}

// Lists the caller's approved farms. Runs with the service role so an approved
// claim is found by user_id OR email — the browser client can't, because RLS on
// farm_claims only exposes rows where user_id = auth.uid().
export async function getMyFarms(userId: string, userEmail: string): Promise<ClaimedFarmSummary[]> {
  const supabase = db()
  const { data: claims } = await supabase
    .from('farm_claims')
    .select('farm_osm_id')
    .eq('status', 'approved')
    .or(`user_id.eq.${userId},email.eq.${userEmail}`)

  const osmIds = [...new Set((claims ?? []).map((c: { farm_osm_id: string }) => c.farm_osm_id))]
  if (osmIds.length === 0) return []

  const { data } = await supabase
    .from('farms')
    .select('osm_id, name, city, image')
    .in('osm_id', osmIds)

  return (data ?? []) as ClaimedFarmSummary[]
}

// Returns the editable farm record only if the caller has an approved claim
// (matched by user_id OR email). null = no access / not found.
export async function getClaimedFarmDetail(
  osmId: string,
  userId: string,
  userEmail: string,
): Promise<FarmEditData | null> {
  const supabase = db()
  if (!(await verifyClaim(supabase, osmId, userId, userEmail))) return null

  const { data } = await supabase
    .from('farms')
    .select('osm_id, name, description, phone, website, email, address, city, postal_code, farm_type, image, opening_hours')
    .eq('osm_id', osmId)
    .maybeSingle()

  return (data as FarmEditData | null) ?? null
}

export interface FarmDetails {
  name: string
  description: string
  phone: string
  website: string
  email: string
  address: string
  city: string
  postal_code: string
  farm_type: string[]
}

export async function updateFarmDetails(
  osmId: string,
  userId: string,
  userEmail: string,
  details: FarmDetails,
): Promise<string | null> {
  const supabase = db()
  if (!(await verifyClaim(supabase, osmId, userId, userEmail))) return 'Unauthorized'

  const { error } = await supabase
    .from('farms')
    .update({
      name:         details.name        || null,
      description:  details.description || null,
      phone:        details.phone       || null,
      website:      details.website     || null,
      email:        details.email       || null,
      address:      details.address     || null,
      city:         details.city        || null,
      postal_code:  details.postal_code || null,
      farm_type:    details.farm_type.length > 0 ? details.farm_type : null,
    })
    .eq('osm_id', osmId)

  return error?.message ?? null
}

export async function updateFarmHours(
  osmId: string,
  userId: string,
  userEmail: string,
  openingHours: string,
): Promise<string | null> {
  const supabase = db()
  if (!(await verifyClaim(supabase, osmId, userId, userEmail))) return 'Unauthorized'

  const { error } = await supabase
    .from('farms')
    .update({ opening_hours: openingHours || null })
    .eq('osm_id', osmId)

  return error?.message ?? null
}

export async function uploadFarmImage(
  osmId: string,
  userId: string,
  userEmail: string,
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  const supabase = db()
  if (!(await verifyClaim(supabase, osmId, userId, userEmail))) return { error: 'Unauthorized' }

  const file = formData.get('image') as File | null
  if (!file || file.size === 0) return { error: 'No file provided' }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${osmId}/${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadErr } = await supabase.storage
    .from('farm-images')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadErr) return { error: uploadErr.message }

  const { data: { publicUrl } } = supabase.storage.from('farm-images').getPublicUrl(path)

  await supabase.from('farms').update({ image: publicUrl }).eq('osm_id', osmId)

  return { url: publicUrl }
}

export async function updateFarmImageUrl(
  osmId: string,
  userId: string,
  userEmail: string,
  imageUrl: string,
): Promise<string | null> {
  const supabase = db()
  if (!(await verifyClaim(supabase, osmId, userId, userEmail))) return 'Unauthorized'

  const { error } = await supabase
    .from('farms')
    .update({ image: imageUrl || null })
    .eq('osm_id', osmId)

  return error?.message ?? null
}
