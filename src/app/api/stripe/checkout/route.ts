import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PRICE_IDS: Record<string, string> = {
  monthly: process.env.STRIPE_MONTHLY_PRICE_ID!,
  yearly:  process.env.STRIPE_YEARLY_PRICE_ID!,
}

export async function POST(request: Request) {
  const { plan, userId } = await request.json() as { plan: 'monthly' | 'yearly'; userId: string }

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
    .select('email, stripe_customer_id')
    .eq('id', userId)
    .single()

  // Reuse existing Stripe customer or create a new one
  let customerId = profile?.stripe_customer_id as string | undefined

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

  const session = await stripe.checkout.sessions.create({
    customer:   customerId,
    mode:       'subscription',
    line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
    success_url: `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${origin}/subscription/cancelled`,
    metadata:    { supabase_user_id: userId, plan },
    // 3-day free trial — card collected upfront, no charge until day 3
    subscription_data: {
      trial_period_days: 3,
      metadata: { supabase_user_id: userId, plan },
    },
    // Require card details even during trial
    payment_method_collection: 'always',
  })

  return Response.json({ url: session.url })
}
