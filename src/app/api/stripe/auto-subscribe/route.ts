import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PRICE_IDS: Record<string, string> = {
  monthly: process.env.STRIPE_MONTHLY_PRICE_ID!,
  yearly:  process.env.STRIPE_YEARLY_PRICE_ID!,
}

export async function POST(request: Request) {
  const { userId, plan, dryRun } = await request.json() as { userId: string; plan: 'monthly' | 'yearly'; dryRun?: boolean }

  if (!userId || !plan || !PRICE_IDS[plan]) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: profile } = await sb
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  if (!profile?.stripe_customer_id) {
    return Response.json({ error: 'no_customer' }, { status: 400 })
  }

  // Check for saved payment methods
  const methods = await stripe.customers.listPaymentMethods(profile.stripe_customer_id, {
    type: 'card', limit: 1,
  })

  if (methods.data.length === 0) {
    return Response.json({ error: 'no_payment_method' }, { status: 400 })
  }

  // Dry-run: just confirm a card exists, don't create a subscription
  if (dryRun) return Response.json({ hasCard: true })

  try {
    const sub = await stripe.subscriptions.create({
      customer:               profile.stripe_customer_id,
      items:                  [{ price: PRICE_IDS[plan] }],
      default_payment_method: methods.data[0].id,
      metadata:               { supabase_user_id: userId, plan },
    })

    const end = new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString()

    await sb.from('profiles').update({
      stripe_subscription_id: sub.id,
      subscription_status:    sub.status,
      subscription_plan:      plan,
      subscription_end_date:  end,
    }).eq('id', userId)

    return Response.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Payment failed'
    return Response.json({ error: msg }, { status: 402 })
  }
}
