import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PRICE_IDS: Record<string, string> = {
  yearly:   process.env.STRIPE_YEARLY_PRICE_ID!,
  lifetime: process.env.STRIPE_LIFETIME_PRICE_ID!,
}

export async function POST(request: Request) {
  const { plan, userId, couponCode } = await request.json() as {
    plan: 'yearly' | 'lifetime'
    userId: string
    couponCode?: string
  }

  if (!plan || !PRICE_IDS[plan]) {
    return Response.json({ error: 'Invalid plan' }, { status: 400 })
  }
  if (!userId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: profile } = await sb
    .from('profiles')
    .select('email, stripe_customer_id, subscription_status, win_back_sent, pending_referral_months')
    .eq('id', userId)
    .single()

  // Eligibility check for COMEBACK20 — only canceled users who received win-back email
  const isComebackEligible =
    couponCode === 'COMEBACK20' &&
    profile?.subscription_status === 'canceled' &&
    profile?.win_back_sent === true

  const appliedCoupon = isComebackEligible ? 'COMEBACK20' : undefined

  // Only offer the free trial to users who have never had a subscription.
  // 'free' is the default for new users — anything else means they've previously subscribed.
  const hadPriorSubscription  = !!profile?.subscription_status && profile.subscription_status !== 'free'
  const pendingReferralMonths = (profile?.pending_referral_months as number | null) ?? 0
  const bonusTrialDays        = pendingReferralMonths * 30

  try {

  // Reuse existing Stripe customer or create a new one
  let customerId = profile?.stripe_customer_id as string | undefined

  // The stored customer may have been deleted in Stripe (e.g. test cleanup).
  // Verify it still exists; if not, drop it so we recreate below.
  if (customerId) {
    try {
      const existing = await stripe.customers.retrieve(customerId)
      if ((existing as Stripe.DeletedCustomer).deleted) customerId = undefined
    } catch {
      customerId = undefined
    }
  }

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? undefined,
      metadata: { supabase_user_id: userId },
    })
    customerId = customer.id

    await sb
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', userId)
  }

  const origin = new URL(request.url).origin

  if (plan === 'lifetime') {
    const session = await stripe.checkout.sessions.create({
      customer:    customerId,
      mode:        'payment',
      line_items:  [{ price: PRICE_IDS.lifetime, quantity: 1 }],
      success_url: `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/subscription/cancelled`,
      metadata:    { supabase_user_id: userId, plan: 'lifetime' },
      ...(appliedCoupon ? { discounts: [{ coupon: appliedCoupon }] } : {}),
    })
    return Response.json({ url: session.url })
  }

  // Yearly subscription — trial only for first-time subscribers
  // Earned referral months extend the trial (30 days each)
  const baseTrialDays = hadPriorSubscription ? 0 : 3
  const totalTrialDays = baseTrialDays + bonusTrialDays

  const session = await stripe.checkout.sessions.create({
    customer:   customerId,
    mode:       'subscription',
    line_items: [{ price: PRICE_IDS.yearly, quantity: 1 }],
    success_url: `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${origin}/subscription/cancelled`,
    metadata: {
      supabase_user_id: userId,
      plan: 'yearly',
      ...(pendingReferralMonths > 0 ? { referral_months_applied: String(pendingReferralMonths) } : {}),
    },
    subscription_data: {
      ...(totalTrialDays > 0 ? { trial_period_days: totalTrialDays } : {}),
      metadata: { supabase_user_id: userId, plan: 'yearly' },
    },
    payment_method_collection: 'always',
    ...(appliedCoupon ? { discounts: [{ coupon: appliedCoupon }] } : {}),
  })

  return Response.json({ url: session.url })

  } catch (e) {
    const message = e instanceof Error ? e.message : 'Checkout failed'
    console.error('[stripe/checkout] error:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
