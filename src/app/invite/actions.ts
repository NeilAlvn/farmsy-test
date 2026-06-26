'use server'

import { createClient } from '@supabase/supabase-js'
import { notifyReferrerPending } from '@/lib/referrals'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface ReferralEntry {
  label:  string
  status: 'pending' | 'rewarded'
  date:   string
}

export interface ReferralStats {
  code:            string
  invited:         number
  joined:          number
  monthsEarned:    number
  pendingMonths:   number
  hasRedeemedCode: boolean
  entries:         ReferralEntry[]
}

function maskEmail(email: string | null | undefined): string {
  if (!email) return 'A friend'
  const [name, domain] = email.split('@')
  if (!domain) return 'A friend'
  const head = name.slice(0, 2)
  return `${head}${'•'.repeat(Math.max(1, name.length - 2))}@${domain}`
}

function labelFor(p: { first_name?: string | null; last_name?: string | null; name?: string | null; email?: string | null } | undefined): string {
  if (!p) return 'A friend'
  const full = [p.first_name, p.last_name].filter(Boolean).join(' ')
  return full || p.name || maskEmail(p.email)
}

export async function redeemReferralCode(
  userId: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const client = sb()
  const trimmed = code.trim().toUpperCase()

  // Find the referrer by code
  const { data: referrer } = await client
    .from('profiles')
    .select('id, referral_code')
    .eq('referral_code', trimmed)
    .maybeSingle()

  if (!referrer) return { ok: false, error: 'Code not found. Double-check and try again.' }
  if (referrer.id === userId) return { ok: false, error: "You can't use your own referral code." }

  // Check the user hasn't already redeemed a code
  const { data: existing } = await client
    .from('referrals')
    .select('id')
    .eq('referee_id', userId)
    .maybeSingle()

  if (existing) return { ok: false, error: "You've already used a referral code — this can only be done once." }

  // Create the referral
  const { error } = await client.from('referrals').insert({
    referrer_id:   referrer.id,
    referee_id:    userId,
    referral_code: trimmed,
    status:        'pending',
  })

  if (error) return { ok: false, error: 'Something went wrong. Please try again.' }

  // No reward yet — the referrer earns their free month only once this user
  // starts their trial / adds a card (handled in the Stripe checkout webhook).
  // But notify the referrer right away so they know the referral is in progress.
  try {
    const { data: me } = await client
      .from('profiles')
      .select('first_name, last_name, name, email')
      .eq('id', userId)
      .maybeSingle()
    await notifyReferrerPending(referrer.id, labelFor(me ?? undefined))
  } catch { /* non-fatal */ }

  return { ok: true }
}

export async function getReferralData(userId: string): Promise<ReferralStats | null> {
  const client = sb()

  const { data: profile } = await client
    .from('profiles')
    .select('referral_code, pending_referral_months')
    .eq('id', userId)
    .single()

  if (!profile?.referral_code) return null

  const [{ data: referrals }, { data: redeemed }] = await Promise.all([
    client.from('referrals')
      .select('referee_id, status, created_at')
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false }),
    client.from('referrals').select('id').eq('referee_id', userId).maybeSingle(),
  ])

  const rows = referrals ?? []

  // Resolve referee labels in one query
  const refereeIds = rows.map(r => r.referee_id).filter(Boolean)
  let profilesById: Record<string, { first_name?: string | null; last_name?: string | null; name?: string | null; email?: string | null }> = {}
  if (refereeIds.length > 0) {
    const { data: ps } = await client
      .from('profiles')
      .select('id, first_name, last_name, name, email')
      .in('id', refereeIds)
    profilesById = Object.fromEntries((ps ?? []).map(p => [p.id, p]))
  }

  const entries: ReferralEntry[] = rows.map(r => ({
    label:  labelFor(profilesById[r.referee_id as string]),
    status: (r.status === 'rewarded' ? 'rewarded' : 'pending'),
    date:   r.created_at as string,
  }))

  const invited = rows.length
  const joined  = rows.filter(r => r.status === 'rewarded' || r.status === 'pending').length

  return {
    code:            profile.referral_code,
    invited,
    joined,
    monthsEarned:    rows.filter(r => r.status === 'rewarded').length,
    pendingMonths:   (profile.pending_referral_months as number | null) ?? 0,
    hasRedeemedCode: !!redeemed,
    entries,
  }
}
