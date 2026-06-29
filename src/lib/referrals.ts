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
// Hard ceiling on banked referral months — stops indefinite reward farming.
const MAX_REFERRAL_MONTHS = 12

/**
 * Returns the fingerprint of a Stripe customer's card. Stripe assigns the same
 * fingerprint to the same physical card across customers/accounts, so it's our
 * strongest signal that two "different" users are really one person.
 */
async function getCardFingerprint(customerId: string | null | undefined): Promise<string | null> {
  if (!customerId) return null
  try {
    const pms = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 })
    return (pms.data[0]?.card?.fingerprint as string | undefined) ?? null
  } catch {
    return null
  }
}

async function rejectReferral(client: ReturnType<typeof sb>, referralId: string, reason: string): Promise<void> {
  await client
    .from('referrals')
    .update({ status: 'rejected', rejected_reason: reason })
    .eq('id', referralId)
}

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
    .select('stripe_subscription_id, pending_referral_months, stripe_customer_id')
    .eq('id', referral.referrer_id)
    .single()

  // ── Anti-abuse guardrails ──────────────────────────────────────────────────
  // Capture the card the friend just used, then reject self-dealing before any
  // reward is granted.
  const { data: referee } = await client
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', refereeUserId)
    .single()

  const refereeFp = await getCardFingerprint(referee?.stripe_customer_id as string | null | undefined)

  if (refereeFp) {
    // Record it so future referrals to the same referrer can be compared.
    await client.from('referrals').update({ card_fingerprint: refereeFp }).eq('id', referral.id)

    // 1) Same card as the referrer themselves → one person, two accounts.
    const referrerFp = await getCardFingerprint(referrer?.stripe_customer_id as string | null | undefined)
    if (referrerFp && referrerFp === refereeFp) {
      await rejectReferral(client, referral.id, 'self_referral_same_card')
      return
    }

    // 2) Same card already used to credit this referrer via another referral.
    const { count: dupeCount } = await client
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', referral.referrer_id)
      .eq('card_fingerprint', refereeFp)
      .neq('id', referral.id)
    if ((dupeCount ?? 0) > 0) {
      await rejectReferral(client, referral.id, 'duplicate_card')
      return
    }
  }

  // 3) Cap total banked months so it can't be farmed indefinitely.
  const currentMonths = (referrer?.pending_referral_months as number | null) ?? 0
  if (currentMonths >= MAX_REFERRAL_MONTHS) {
    await rejectReferral(client, referral.id, 'cap_reached')
    return
  }

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
      .update({ pending_referral_months: currentMonths + 1 })
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
