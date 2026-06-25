'use server'

import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface ReferralStats {
  code:           string
  invited:        number
  converted:      number
  monthsEarned:   number
  pendingMonths:  number
}

export async function getReferralData(userId: string): Promise<ReferralStats | null> {
  const client = sb()

  const { data: profile } = await client
    .from('profiles')
    .select('referral_code, pending_referral_months')
    .eq('id', userId)
    .single()

  if (!profile?.referral_code) return null

  const { data: referrals } = await client
    .from('referrals')
    .select('status')
    .eq('referrer_id', userId)

  const invited   = referrals?.length ?? 0
  const converted = referrals?.filter(r => r.status === 'rewarded').length ?? 0

  return {
    code:          profile.referral_code,
    invited,
    converted,
    monthsEarned:  converted,
    pendingMonths: (profile.pending_referral_months as number | null) ?? 0,
  }
}
