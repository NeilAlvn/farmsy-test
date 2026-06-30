'use server'

import { createClient } from '@supabase/supabase-js'
import { logActivity } from '@/lib/activity'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface ClaimInput {
  farmOsmId: string
  farmName: string
  userId: string | null
  fullName: string
  email: string
  phone: string
  verificationMethod: 'email' | 'kvk'
  kvkNumber: string | null
  message: string | null
}

// Creates a pending farm claim and records it in the admin activity log.
export async function createFarmClaim(input: ClaimInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()

  const { error } = await supabase.from('farm_claims').insert({
    farm_osm_id: input.farmOsmId,
    user_id: input.userId,
    full_name: input.fullName,
    email: input.email,
    phone: input.phone,
    verification_method: input.verificationMethod,
    kvk_number: input.verificationMethod === 'kvk' ? input.kvkNumber : null,
    message: input.message,
    status: 'pending',
  })

  if (error) return { ok: false, error: error.message }

  await logActivity('claim_created', `New claim submitted: ${input.farmName}`, {
    actor: input.email,
    meta: { farmOsmId: input.farmOsmId },
  })

  return { ok: true }
}
