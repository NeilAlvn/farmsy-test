'use server'

import { createClient } from '@supabase/supabase-js'
import { logActivity } from '@/lib/activity'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function isPaid(status: string | null, endDate: string | null): boolean {
  if (status === 'active' || status === 'trialing') return true
  if (status === 'canceled' && endDate && new Date(endDate) > new Date()) return true
  return false
}

const MAX_IMAGES = 5

export interface SubmitResult { ok: boolean; error?: string }

// Creates a pending farm-shop submission from a subscriber. Verifies the caller
// via their Supabase access token, uploads up to 5 photos, and logs the event.
export async function submitFarmShop(formData: FormData): Promise<SubmitResult> {
  const token = String(formData.get('token') || '')
  if (!token) return { ok: false, error: 'Not signed in.' }

  const supabase = db()
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return { ok: false, error: 'Your session expired — please sign in again.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, subscription_end_date')
    .eq('id', user.id)
    .single()

  if (!isPaid(profile?.subscription_status ?? null, profile?.subscription_end_date ?? null)) {
    return { ok: false, error: 'A Farmsy subscription is required to add a farm shop.' }
  }

  const name = String(formData.get('name') || '').trim()
  if (!name) return { ok: false, error: 'Farm name is required.' }
  const city = String(formData.get('city') || '').trim()
  if (!city) return { ok: false, error: 'City is required.' }

  const str = (k: string) => {
    const v = String(formData.get(k) || '').trim()
    return v || null
  }
  const farmTypeRaw = String(formData.get('farm_type') || '').trim()
  const farmType = farmTypeRaw ? farmTypeRaw.split(',').map(s => s.trim()).filter(Boolean) : null
  const latRaw = String(formData.get('lat') || '').trim()
  const lngRaw = String(formData.get('lng') || '').trim()

  // Upload images (best-effort; a failed image doesn't abort the submission)
  const files = formData.getAll('images').filter((f): f is File => f instanceof File && f.size > 0).slice(0, MAX_IMAGES)
  const imageUrls: string[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `submissions/${user.id}/${Date.now()}-${i}.${ext}`
    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const { error: upErr } = await supabase.storage
        .from('farm-images')
        .upload(path, buffer, { contentType: file.type, upsert: true })
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('farm-images').getPublicUrl(path)
        imageUrls.push(publicUrl)
      }
    } catch { /* skip this image */ }
  }

  const { error } = await supabase.from('farm_submissions').insert({
    submitted_by: user.id,
    submitter_email: user.email ?? null,
    name,
    description: str('description'),
    farm_type: farmType,
    address: str('address'),
    city,
    postal_code: str('postal_code'),
    country: str('country'),
    lat: latRaw ? Number(latRaw) : null,
    lng: lngRaw ? Number(lngRaw) : null,
    phone: str('phone'),
    website: str('website'),
    email: str('email'),
    opening_hours: str('opening_hours'),
    image_urls: imageUrls,
    status: 'pending',
  })

  if (error) return { ok: false, error: 'Could not submit — please try again.' }

  await logActivity('submission_created', `New farm shop submitted: ${name}${city ? ` (${city})` : ''}`, {
    actor: user.email ?? user.id,
    meta: { name, city, images: imageUrls.length },
  })

  return { ok: true }
}
