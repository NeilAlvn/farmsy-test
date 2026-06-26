'use server'

import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface ReferralStats {
  code:            string
  invited:         number
  joined:          number
  monthsEarned:    number
  pendingMonths:   number
  hasRedeemedCode: boolean
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
    client.from('referrals').select('status').eq('referrer_id', userId),
    client.from('referrals').select('id').eq('referee_id', userId).maybeSingle(),
  ])

  const invited = referrals?.length ?? 0
  const joined  = referrals?.filter(r => r.status === 'rewarded' || r.status === 'pending').length ?? 0

  return {
    code:            profile.referral_code,
    invited,
    joined,
    monthsEarned:    referrals?.filter(r => r.status === 'rewarded').length ?? 0,
    pendingMonths:   (profile.pending_referral_months as number | null) ?? 0,
    hasRedeemedCode: !!redeemed,
  }
}
