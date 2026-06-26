import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { createNotification } from '@/lib/notifications'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Rewards the referrer with 1 free month once a friend they referred CONVERTS —
 * i.e. completes Stripe checkout (adds a card / starts the free trial or buys
 * lifetime). Gating on a real payment method prevents throwaway-account abuse.
 *
 * - If the referrer has an active/trialing Stripe subscription, the current
 *   period is extended by 30 days.
 * - Otherwise, a "pending" free month is banked on their profile and applied
 *   automatically at their next checkout/renewal.
 *
 * Idempotent: only acts on a referral that is still 'pending', then marks it
 * 'rewarded', so it can safely be called from multiple entry points / retried.
 */
export async function rewardReferrerOnConversion(refereeUserId: string): Promise<void> {
  const client = sb()

  const { data: referral } = await client
    .from('referrals')
    .select('id, referrer_id')
    .eq('referee_id', refereeUserId)
    .eq('status', 'pending')
    .maybeSingle()

  if (!referral) return

  const { data: referrer } = await client
    .from('profiles')
    .select('stripe_subscription_id, pending_referral_months')
    .eq('id', referral.referrer_id)
    .single()

  let extended = false
  if (referrer?.stripe_subscription_id) {
    try {
      const subRaw = await stripe.subscriptions.retrieve(referrer.stripe_subscription_id)
      const sub = subRaw as unknown as Stripe.Subscription & { current_period_end: number }
      if (sub.status === 'active' || sub.status === 'trialing') {
        const newEnd = sub.current_period_end + 30 * 24 * 60 * 60
        await stripe.subscriptions.update(referrer.stripe_subscription_id, {
          trial_end: newEnd,
          proration_behavior: 'none',
        } as Parameters<typeof stripe.subscriptions.update>[1])
        extended = true
      }
    } catch { /* sub may be gone — fall through to credit */ }
  }

  if (!extended) {
    await client
      .from('profiles')
      .update({ pending_referral_months: ((referrer?.pending_referral_months as number | null) ?? 0) + 1 })
      .eq('id', referral.referrer_id)
  }

  await client
    .from('referrals')
    .update({ status: 'rewarded', rewarded_at: new Date().toISOString() })
    .eq('id', referral.id)

  await createNotification(
    referral.referrer_id,
    'referral_reward',
    'You earned a free month! 🎉',
    extended
      ? 'A friend you referred just started their Farmsy trial. We\'ve added 1 free month to your subscription.'
      : 'A friend you referred just started their Farmsy trial. 1 free month has been added — it\'ll be applied at your next renewal or checkout.',
  )
}
