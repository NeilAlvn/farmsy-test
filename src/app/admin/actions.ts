'use server'

import { createClient } from '@supabase/supabase-js'
import { sendContactReply } from '@/lib/email'
import { createNotification } from '@/lib/notifications'
import { logActivity } from '@/lib/activity'

const APP_URL = 'https://farmsy.app'

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

export interface EmailSubscriberRow {
  id: string
  email: string
  source: string | null
  status: string | null
  created_at: string
}

export async function getEmailSubscribers(): Promise<EmailSubscriberRow[]> {
  const supabase = db()
  const { data } = await supabase
    .from('email_subscribers')
    .select('id, email, source, status, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  return (data ?? []) as EmailSubscriberRow[]
}

// Unified "people" list for the overview: registered users + waiting-list
// signups in one table, deduped by email. A waiting-list email that already
// has an account is folded into that user's row (fromWaitlist=true) so the
// admin can see who converted.
export interface PeopleRow {
  id: string
  name: string
  email: string
  kind: 'user' | 'waitlist'
  status: string         // subscription status for users, 'waitlist' otherwise
  joined: string         // created_at
  fromWaitlist: boolean  // user who was also on the waiting list (i.e. converted)
}

export async function getPeople(): Promise<PeopleRow[]> {
  const supabase = db()

  const [{ data: profiles }, { data: subs }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, first_name, last_name, name, subscription_status, created_at')
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase
      .from('email_subscribers')
      .select('id, email, created_at')
      .order('created_at', { ascending: false })
      .limit(2000),
  ])

  const waitlistEmails = new Set(
    (subs ?? []).map((s: { email: string | null }) => (s.email ?? '').toLowerCase()).filter(Boolean)
  )

  const userEmails = new Set<string>()
  const rows: PeopleRow[] = []

  for (const p of (profiles ?? []) as Array<Record<string, unknown>>) {
    const email = (p.email as string | null) ?? ''
    if (email) userEmails.add(email.toLowerCase())
    rows.push({
      id: p.id as string,
      name:
        [p.first_name, p.last_name].filter(Boolean).join(' ') ||
        (p.name as string | null) ||
        email ||
        '—',
      email,
      kind: 'user',
      status: (p.subscription_status as string | null) ?? 'free',
      joined: p.created_at as string,
      fromWaitlist: email ? waitlistEmails.has(email.toLowerCase()) : false,
    })
  }

  // Waiting-list signups that never created an account.
  for (const s of (subs ?? []) as Array<Record<string, unknown>>) {
    const email = (s.email as string | null) ?? ''
    if (!email || userEmails.has(email.toLowerCase())) continue
    rows.push({
      id: `wl_${s.id as string}`,
      name: email,
      email,
      kind: 'waitlist',
      status: 'waitlist',
      joined: s.created_at as string,
      fromWaitlist: true,
    })
  }

  rows.sort((a, b) => new Date(b.joined).getTime() - new Date(a.joined).getTime())
  return rows
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

// Looks up the claimant + farm name so we can notify them by email / in-app.
async function getClaimContext(supabase: ReturnType<typeof db>, claimId: string, farmOsmId: string) {
  const [{ data: claim }, { data: farm }] = await Promise.all([
    supabase.from('farm_claims').select('email, full_name, user_id').eq('id', claimId).maybeSingle(),
    supabase.from('farms').select('name').eq('osm_id', farmOsmId).maybeSingle(),
  ])
  return {
    email: (claim?.email as string | null) ?? null,
    fullName: (claim?.full_name as string | null) ?? null,
    userId: (claim?.user_id as string | null) ?? null,
    farmName: (farm?.name as string | null) ?? 'your farm',
  }
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

  if (e2) return e2.message

  // Let the farmer know — email + in-app notification.
  const { email, fullName, userId, farmName } = await getClaimContext(supabase, claimId, farmOsmId)
  const firstName = fullName?.split(' ')[0] || 'there'

  if (email) {
    try {
      await sendContactReply(email, {
        subject: `Your claim for ${farmName} is approved 🎉`,
        body:
          `Hi ${firstName},\n\n` +
          `Good news — your claim for ${farmName} has been approved! ` +
          `You can now manage its details, photos, and opening hours from your dashboard:\n\n` +
          `${APP_URL}/dashboard\n\n` +
          `Sign in with this email address (${email}) to access it.\n\n` +
          `Thanks for being part of Farmsy!\n\nThe Farmsy Team`,
      })
    } catch { /* non-fatal */ }
  }

  if (userId) {
    try {
      await createNotification(
        userId,
        'claim_approved',
        'Farm claim approved 🎉',
        `Your claim for ${farmName} was approved. Manage it from your dashboard.`,
      )
    } catch { /* non-fatal */ }
  }

  await logActivity('claim_approved', `Claim approved: ${farmName}`, { actor: reviewedBy || 'admin', meta: { farmOsmId } })

  return null
}

export async function rejectClaim(
  claimId: string,
  reason: string,
  reviewedBy: string,
  farmOsmId?: string,
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

  if (error) return error.message

  // Notify the farmer their claim wasn't approved (with the reason, if given).
  const { email, fullName, userId, farmName } = await getClaimContext(supabase, claimId, farmOsmId ?? '')
  const firstName = fullName?.split(' ')[0] || 'there'

  if (email) {
    try {
      await sendContactReply(email, {
        subject: `Update on your claim for ${farmName}`,
        body:
          `Hi ${firstName},\n\n` +
          `Thanks for your interest in claiming ${farmName}. After review, we weren't able to approve this claim` +
          `${reason ? `:\n\n"${reason}"` : ' at this time.'}\n\n` +
          `If you believe this is a mistake or you can provide more proof of ownership, just reply to this email and we'll take another look.\n\n` +
          `The Farmsy Team`,
      })
    } catch { /* non-fatal */ }
  }

  if (userId) {
    try {
      await createNotification(
        userId,
        'claim_rejected',
        'Update on your farm claim',
        `Your claim for ${farmName} wasn't approved.${reason ? ` Reason: ${reason}` : ''} Reply to our email if you'd like us to take another look.`,
      )
    } catch { /* non-fatal */ }
  }

  await logActivity('claim_rejected', `Claim rejected: ${farmName}`, { actor: reviewedBy || 'admin', meta: { reason } })

  return null
}

export async function deleteFarm(osmId: string, actor?: string): Promise<string | null> {
  const supabase = db()

  const { data: farm } = await supabase.from('farms').select('name').eq('osm_id', osmId).maybeSingle()

  // Clean up the gallery (farm_images has no FK cascade), then the farm.
  await supabase.from('farm_images').delete().eq('farm_osm_id', osmId)
  const { error } = await supabase.from('farms').delete().eq('osm_id', osmId)
  if (error) return error.message

  await logActivity('farm_deleted', `Farm deleted: ${farm?.name ?? osmId}`, { actor: actor || 'admin', meta: { osmId } })
  return null
}

// ── Farm-shop submissions ────────────────────────────────────────────────────

export interface SubmissionRow {
  id: string
  submitted_by: string | null
  submitter_email: string | null
  name: string
  description: string | null
  farm_type: string[] | null
  address: string | null
  city: string | null
  postal_code: string | null
  country: string | null
  lat: number | null
  lng: number | null
  phone: string | null
  website: string | null
  email: string | null
  opening_hours: string | null
  image_urls: string[]
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_at: string | null
  rejection_reason: string | null
  approved_osm_id: string | null
}

export async function getSubmissions(): Promise<SubmissionRow[]> {
  const { data } = await db()
    .from('farm_submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)
  return (data ?? []) as SubmissionRow[]
}

// Geocodes a free-text address via Photon (the same open geocoder used at signup).
async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  if (!query.trim()) return null
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`)
    if (!res.ok) return null
    const j = await res.json() as { features?: Array<{ geometry?: { coordinates?: [number, number] } }> }
    const c = j.features?.[0]?.geometry?.coordinates
    if (c && c.length === 2) return { lng: c[0], lat: c[1] }
  } catch { /* ignore */ }
  return null
}

export async function approveSubmission(submissionId: string, reviewedBy: string): Promise<string | null> {
  const supabase = db()

  const { data: sub } = await supabase
    .from('farm_submissions')
    .select('*')
    .eq('id', submissionId)
    .maybeSingle()

  if (!sub) return 'Submission not found'
  if (sub.status === 'approved') return null

  const osmId = `sub_${(sub.id as string).replace(/-/g, '').slice(0, 16)}`

  // Resolve coordinates: use submitted ones, else geocode the address.
  let coords: { lat: number; lng: number } | null =
    (sub.lat != null && sub.lng != null) ? { lat: sub.lat as number, lng: sub.lng as number } : null
  if (!coords) {
    coords = await geocode([sub.address, sub.postal_code, sub.city, sub.country].filter(Boolean).join(', '))
  }

  const imageUrls = (sub.image_urls as string[] | null) ?? []

  const farmRow: Record<string, unknown> = {
    osm_id: osmId,
    name: sub.name,
    description: sub.description,
    farm_type: sub.farm_type,
    address: sub.address,
    city: sub.city,
    postal_code: sub.postal_code,
    country: sub.country,
    phone: sub.phone,
    website: sub.website,
    email: sub.email,
    opening_hours: sub.opening_hours,
    image: imageUrls[0] ?? null,
    is_published: true,
    is_claimed: false,
    enrichment_source: 'submission',
    source: 'submission',
  }
  if (coords) farmRow.location = `SRID=4326;POINT(${coords.lng} ${coords.lat})`

  const { error: farmErr } = await supabase.from('farms').insert(farmRow)
  if (farmErr) return farmErr.message

  // Gallery images
  if (imageUrls.length > 0) {
    await supabase.from('farm_images').insert(
      imageUrls.map((url, i) => ({ farm_osm_id: osmId, url, sort_order: i })),
    )
  }

  // Auto-grant the submitter an approved claim so they can manage it.
  if (sub.submitted_by || sub.submitter_email) {
    await supabase.from('farm_claims').insert({
      farm_osm_id: osmId,
      user_id: sub.submitted_by ?? null,
      full_name: sub.submitter_email ?? 'Farm owner',
      email: sub.submitter_email ?? 'unknown@farmsy.app',
      phone: sub.phone ?? 'n/a',
      verification_method: 'email',
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy || null,
    })
  }

  await supabase
    .from('farm_submissions')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy || null,
      approved_osm_id: osmId,
    })
    .eq('id', submissionId)

  if (sub.submitted_by) {
    try {
      await createNotification(
        sub.submitted_by as string,
        'submission_approved',
        'Your farm shop is live! 🌱',
        `${sub.name} has been published to the map. You can manage its details from your dashboard.`,
      )
    } catch { /* non-fatal */ }
  }
  if (sub.submitter_email) {
    try {
      await sendContactReply(sub.submitter_email as string, {
        subject: `${sub.name} is now on Farmsy 🌱`,
        body:
          `Hi,\n\nGood news — your farm shop "${sub.name}" has been reviewed and published to the Farmsy map. ` +
          `You can manage its details, photos, and opening hours from your dashboard:\n\n${APP_URL}/dashboard\n\nThanks for adding to Farmsy!\n\nThe Farmsy Team`,
      })
    } catch { /* non-fatal */ }
  }

  await logActivity('submission_approved', `Submission approved & published: ${sub.name}`, {
    actor: reviewedBy || 'admin',
    meta: { osmId, geocoded: !!coords },
  })

  return null
}

export async function rejectSubmission(submissionId: string, reason: string, reviewedBy: string): Promise<string | null> {
  const supabase = db()

  const { data: sub } = await supabase
    .from('farm_submissions')
    .select('name, submitted_by, submitter_email')
    .eq('id', submissionId)
    .maybeSingle()

  const { error } = await supabase
    .from('farm_submissions')
    .update({
      status: 'rejected',
      rejection_reason: reason || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy || null,
    })
    .eq('id', submissionId)

  if (error) return error.message

  if (sub?.submitted_by) {
    try {
      await createNotification(
        sub.submitted_by as string,
        'submission_rejected',
        'Update on your farm shop submission',
        `We couldn't publish "${sub.name}".${reason ? ` Reason: ${reason}` : ''} Reply to our email if you'd like to follow up.`,
      )
    } catch { /* non-fatal */ }
  }
  if (sub?.submitter_email) {
    try {
      await sendContactReply(sub.submitter_email as string, {
        subject: `Update on your farm shop submission`,
        body:
          `Hi,\n\nThanks for submitting "${sub?.name}" to Farmsy. After review, we weren't able to publish it` +
          `${reason ? `:\n\n"${reason}"` : ' at this time.'}\n\nIf you'd like to follow up or provide more detail, just reply to this email.\n\nThe Farmsy Team`,
      })
    } catch { /* non-fatal */ }
  }

  await logActivity('submission_rejected', `Submission rejected: ${sub?.name ?? submissionId}`, {
    actor: reviewedBy || 'admin',
    meta: { reason },
  })

  return null
}

// ── Activity log ─────────────────────────────────────────────────────────────

export interface ActivityRow {
  id: string
  type: string
  actor: string | null
  summary: string
  created_at: string
}

// Total row counts per admin section. The layout compares these against the
// counts last seen (stored client-side) to show "new since you last looked"
// badges on the nav.
export interface AdminNavCounts {
  users: number
  submissions: number
  claims: number
  contact: number
  activity: number
}

export async function getAdminNavCounts(): Promise<AdminNavCounts> {
  const supabase = db()
  const head = { count: 'exact' as const, head: true }
  const [
    { count: users },
    { count: submissions },
    { count: claims },
    { count: subs },
    { count: threads },
    { count: activity },
  ] = await Promise.all([
    supabase.from('profiles').select('*', head),
    supabase.from('farm_submissions').select('*', head),
    supabase.from('farm_claims').select('*', head),
    supabase.from('contact_submissions').select('*', head),
    supabase.from('message_threads').select('*', head),
    supabase.from('admin_activity_log').select('*', head),
  ])
  return {
    users: users ?? 0,
    submissions: submissions ?? 0,
    claims: claims ?? 0,
    contact: (subs ?? 0) + (threads ?? 0),
    activity: activity ?? 0,
  }
}

export async function getActivityLog(): Promise<ActivityRow[]> {
  const { data } = await db()
    .from('admin_activity_log')
    .select('id, type, actor, summary, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  return (data ?? []) as ActivityRow[]
}

// ── Admin farm editor (edit ANY farm) ────────────────────────────────────────

export interface AdminFarmImage { id: string; url: string; sort_order: number }

export interface AdminFarmDetail {
  osm_id: string
  name: string
  description: string | null
  phone: string | null
  website: string | null
  email: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  country: string | null
  farm_type: string[] | null
  image: string | null
  opening_hours: string | null
  is_published: boolean | null
  images: AdminFarmImage[]
}

export async function getFarmForAdmin(osmId: string): Promise<AdminFarmDetail | null> {
  const supabase = db()
  const { data } = await supabase
    .from('farms')
    .select('osm_id, name, description, phone, website, email, address, city, postal_code, country, farm_type, image, opening_hours, is_published')
    .eq('osm_id', osmId)
    .maybeSingle()
  if (!data) return null

  const { data: imgs } = await supabase
    .from('farm_images')
    .select('id, url, sort_order')
    .eq('farm_osm_id', osmId)
    .order('sort_order', { ascending: true })

  return { ...(data as Omit<AdminFarmDetail, 'images'>), images: (imgs ?? []) as AdminFarmImage[] }
}

export interface AdminFarmFields {
  name: string
  description: string
  phone: string
  website: string
  email: string
  address: string
  city: string
  postal_code: string
  country: string
  farm_type: string[]
  opening_hours: string
  is_published: boolean
}

export async function adminUpdateFarm(osmId: string, fields: AdminFarmFields, actor: string): Promise<string | null> {
  const supabase = db()
  const { error } = await supabase
    .from('farms')
    .update({
      name:          fields.name || null,
      description:   fields.description || null,
      phone:         fields.phone || null,
      website:       fields.website || null,
      email:         fields.email || null,
      address:       fields.address || null,
      city:          fields.city || null,
      postal_code:   fields.postal_code || null,
      country:       fields.country || null,
      farm_type:     fields.farm_type.length > 0 ? fields.farm_type : null,
      opening_hours: fields.opening_hours || null,
      is_published:  fields.is_published,
    })
    .eq('osm_id', osmId)

  if (error) return error.message
  await logActivity('farm_edited', `Farm edited: ${fields.name}`, { actor, meta: { osmId } })
  return null
}

export async function adminAddFarmImage(osmId: string, formData: FormData, actor: string): Promise<{ image?: AdminFarmImage; error?: string }> {
  const supabase = db()
  const file = formData.get('image') as File | null
  if (!file || file.size === 0) return { error: 'No file provided' }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${osmId}/${Date.now()}.${ext}`
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await supabase.storage.from('farm-images').upload(path, buffer, { contentType: file.type, upsert: true })
    if (upErr) return { error: upErr.message }
  } catch {
    return { error: 'Upload failed' }
  }
  const { data: { publicUrl } } = supabase.storage.from('farm-images').getPublicUrl(path)

  // Next sort order
  const { count: existingCount } = await supabase
    .from('farm_images')
    .select('id', { count: 'exact', head: true })
    .eq('farm_osm_id', osmId)
  const sortOrder = existingCount ?? 0

  const { data: inserted, error } = await supabase
    .from('farm_images')
    .insert({ farm_osm_id: osmId, url: publicUrl, sort_order: sortOrder })
    .select('id, url, sort_order')
    .single()
  if (error || !inserted) return { error: error?.message ?? 'Insert failed' }

  // Set as cover if the farm has none yet.
  const { data: farm } = await supabase.from('farms').select('image').eq('osm_id', osmId).maybeSingle()
  if (!farm?.image) await supabase.from('farms').update({ image: publicUrl }).eq('osm_id', osmId)

  await logActivity('farm_edited', `Photo added to farm`, { actor, meta: { osmId } })
  return { image: inserted as AdminFarmImage }
}

export async function adminDeleteFarmImage(imageId: string, osmId: string, actor: string): Promise<string | null> {
  const supabase = db()
  const { error } = await supabase.from('farm_images').delete().eq('id', imageId)
  if (error) return error.message
  await logActivity('farm_edited', `Photo removed from farm`, { actor, meta: { osmId } })
  return null
}

export async function adminSetFarmCover(osmId: string, url: string, actor: string): Promise<string | null> {
  const supabase = db()
  const { error } = await supabase.from('farms').update({ image: url }).eq('osm_id', osmId)
  if (error) return error.message
  await logActivity('farm_edited', `Cover photo changed`, { actor, meta: { osmId } })
  return null
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export interface ProfileAdminRow {
  id: string
  email: string | null
  name: string | null
  first_name: string | null
  last_name: string | null
  role: string
  created_at: string
  email_verified: boolean | null
  subscription_status: string | null
  subscription_plan: string | null
  subscription_end_date: string | null
  stripe_subscription_id: string | null
  win_back_sent: boolean | null
  cancelled_at: string | null
}

export interface ContactSubmissionRow {
  id: string
  name: string
  email: string
  topic: string
  message: string
  source: string
  created_at: string
  replied_at: string | null
  reply_message: string | null
  reply_subject: string | null
}

export async function getAdminStats() {
  const supabase = db()

  const [
    { count: totalUsers },
    { count: activeCount },
    { count: canceledCount },
    { count: winbackCount },
    { count: contactCount },
    { count: waitlistCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('subscription_status', 'active'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('subscription_status', 'canceled'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('win_back_sent', true),
    supabase.from('contact_submissions').select('*', { count: 'exact', head: true }),
    supabase.from('email_subscribers').select('*', { count: 'exact', head: true }),
  ])

  const { data: waitlist } = await supabase
    .from('email_subscribers')
    .select('id, email, source, status, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  const { data: recentSignups } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, name, role, created_at, email_verified, subscription_status')
    .order('created_at', { ascending: false })
    .limit(8)

  return {
    totalUsers: totalUsers ?? 0,
    activeSubscriptions: activeCount ?? 0,
    canceledSubscriptions: canceledCount ?? 0,
    winbackSent: winbackCount ?? 0,
    totalContact: contactCount ?? 0,
    waitlistCount: waitlistCount ?? 0,
    recentSignups: (recentSignups ?? []) as ProfileAdminRow[],
    recentWaitlist: (waitlist ?? []) as EmailSubscriberRow[],
  }
}

export async function getAdminUsers(): Promise<ProfileAdminRow[]> {
  const supabase = db()
  const { data } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, name, role, created_at, email_verified, subscription_status, subscription_plan')
    .order('created_at', { ascending: false })
    .limit(500)
  return (data ?? []) as ProfileAdminRow[]
}

export async function getAdminSubscriptions(): Promise<ProfileAdminRow[]> {
  const supabase = db()
  const { data } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, name, created_at, subscription_status, subscription_plan, subscription_end_date, stripe_subscription_id, win_back_sent, cancelled_at')
    .not('subscription_status', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500)
  return (data ?? []) as ProfileAdminRow[]
}

export async function getAdminWinback(): Promise<ProfileAdminRow[]> {
  const supabase = db()
  const { data } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, name, created_at, subscription_status, subscription_plan, win_back_sent, cancelled_at')
    .eq('win_back_sent', true)
    .order('cancelled_at', { ascending: false })
    .limit(500)
  return (data ?? []) as ProfileAdminRow[]
}

export async function getAdminContact(): Promise<ContactSubmissionRow[]> {
  const supabase = db()
  const { data } = await supabase
    .from('contact_submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)
  return (data ?? []) as ContactSubmissionRow[]
}

export async function getProfileRole(userId: string): Promise<string | null> {
  const supabase = db()
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  return data?.role ?? null
}

// ─── User editor (admin testing tool) ──────────────────────────────────────────

// Fields the admin editor is allowed to write. Anything not in this set is
// ignored server-side, so id/created_at and other system columns are protected.
const EDITABLE_USER_FIELDS = new Set<string>([
  'name', 'first_name', 'last_name', 'email', 'role',
  'subscription_status', 'subscription_plan', 'subscription_end_date',
  'email_verified', 'win_back_sent', 'cancelled_at',
  'referral_code', 'referred_by', 'pending_referral_months',
  'stripe_customer_id', 'stripe_subscription_id',
])

// Returns the full profile row (every column that exists in the DB) so the
// editor can render only the fields that are actually present — resilient to
// pending migrations that may not have added referral/personal columns yet.
export async function getUserDetail(userId: string): Promise<Record<string, unknown> | null> {
  const supabase = db()
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  return (data as Record<string, unknown> | null) ?? null
}

export async function updateUserFields(
  userId: string,
  fields: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()

  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (EDITABLE_USER_FIELDS.has(key)) clean[key] = value === '' ? null : value
  }

  if (Object.keys(clean).length === 0) return { ok: false, error: 'No editable fields provided.' }

  const { error } = await supabase.from('profiles').update(clean).eq('id', userId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// One-click reset of billing + referral state for a single user, for testing.
export async function resetUserTestingState(
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  // Only set columns that exist — probe the row first.
  const { data: row } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (!row) return { ok: false, error: 'User not found.' }

  const candidate: Record<string, unknown> = {
    subscription_status:     'free',
    subscription_plan:       null,
    subscription_end_date:   null,
    stripe_subscription_id:  null,
    win_back_sent:           false,
    cancelled_at:            null,
    pending_referral_months: 0,
  }
  const reset: Record<string, unknown> = {}
  for (const key of Object.keys(candidate)) {
    if (key in (row as Record<string, unknown>)) reset[key] = candidate[key]
  }

  const { error } = await supabase.from('profiles').update(reset).eq('id', userId)
  if (error) return { ok: false, error: error.message }

  // Clear any referrals this user redeemed (so a code can be re-tested)
  await supabase.from('referrals').delete().eq('referee_id', userId)

  return { ok: true }
}
