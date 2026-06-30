import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export type ActivityType =
  | 'submission_created'
  | 'submission_approved'
  | 'submission_rejected'
  | 'claim_created'
  | 'claim_approved'
  | 'claim_rejected'
  | 'farm_edited'
  | 'signup'
  | 'subscription_started'
  | 'subscription_cancelled'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'contact_message'

/**
 * Appends an entry to the admin activity log. Best-effort — never throws into
 * the caller (logging must not break the action it records).
 */
export async function logActivity(
  type: ActivityType,
  summary: string,
  opts: { actor?: string | null; meta?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    await sb().from('admin_activity_log').insert({
      type,
      actor: opts.actor ?? 'system',
      summary,
      meta: opts.meta ?? null,
    })
  } catch {
    /* non-fatal */
  }
}
