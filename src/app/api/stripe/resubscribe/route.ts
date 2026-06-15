import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { createNotification } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  const { userId } = await request.json() as { userId: string }
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: profile } = await sb
    .from('profiles')
    .select('stripe_customer_id, email')
    .eq('id', userId)
    .single()

  const origin = new URL(request.url).origin

  // No Stripe customer yet — go through full checkout
  if (!profile?.stripe_customer_id) {
    const customer = await stripe.customers.create({
      email:    profile?.email ?? undefined,
      metadata: { supabase_user_id: userId },
    })
    await sb.from('profiles').update({ stripe_customer_id: customer.id }).eq('id', userId)

    const session = await stripe.checkout.sessions.create({
      customer:   customer.id,
      mode:       'subscription',
      line_items: [{ price: process.env.STRIPE_YEARLY_PRICE_ID!, quantity: 1 }],
      success_url: `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/account/subscription`,
      metadata:    { supabase_user_id: userId, plan: 'yearly' },
      subscription_data: {
        metadata: { supabase_user_id: userId, plan: 'yearly' },
      },
      payment_method_collection: 'always',
    })
    return Response.json({ url: session.url })
  }

  // Check for a saved payment method
  const methods = await stripe.customers.listPaymentMethods(profile.stripe_customer_id, {
    type: 'card', limit: 1,
  })

  // No saved card — redirect to checkout
  if (methods.data.length === 0) {
    const session = await stripe.checkout.sessions.create({
      customer:   profile.stripe_customer_id,
      mode:       'subscription',
      line_items: [{ price: process.env.STRIPE_YEARLY_PRICE_ID!, quantity: 1 }],
      success_url: `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/account/subscription`,
      metadata:    { supabase_user_id: userId, plan: 'yearly' },
      subscription_data: {
        metadata: { supabase_user_id: userId, plan: 'yearly' },
      },
      payment_method_collection: 'always',
    })
    return Response.json({ url: session.url })
  }

  // Saved card exists — charge immediately, no checkout needed
  try {
    const sub = await stripe.subscriptions.create({
      customer:               profile.stripe_customer_id,
      items:                  [{ price: process.env.STRIPE_YEARLY_PRICE_ID! }],
      default_payment_method: methods.data[0].id,
      metadata:               { supabase_user_id: userId, plan: 'yearly' },
    }) as unknown as Stripe.Subscription & { current_period_end: number }

    const endDate = new Date(sub.current_period_end * 1000).toISOString()

    await sb.from('profiles').update({
      stripe_subscription_id: sub.id,
      subscription_status:    'active',
      subscription_plan:      'yearly',
      subscription_end_date:  endDate,
    }).eq('id', userId)

    await createNotification(
      userId,
      'subscription_activated',
      'Subscription reactivated',
      'Welcome back! Your yearly subscription is now active.',
    )

    return Response.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Payment failed'
    return Response.json({ error: msg }, { status: 402 })
  }
}
