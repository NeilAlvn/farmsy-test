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
 * Notifies the referrer the moment a friend redeems their code / signs up with
 * their link — before any reward. Gives immediate feedback while the actual free
 * month stays gated on the friend starting their trial.
 */
export async function notifyReferrerPending(referrerId: string, refereeLabel: string): Promise<void> {
  await createNotification(
    referrerId,
    'referral_pending',
    'Someone used your code! 🎉',
    `${refereeLabel} joined with your referral code. You'll earn 1 free month as soon as they start their free trial.`,
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
      ? 'A friend you referred just started their Farmsy trial. We\'ve added 30 free days straight onto your subscription — your next payment date has been pushed back a month, no action needed.'
      : 'A friend you referred just started their Farmsy trial. You\'ve earned 30 free days! They\'re added automatically the next time you start a plan — on top of your 3-day trial, so you get 33 days free before your first charge.',
  )
}
