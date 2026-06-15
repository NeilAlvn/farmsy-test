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
    .select('stripe_subscription_id, subscription_end_date, subscription_status')
    .eq('id', userId)
    .single()

  if (!profile?.stripe_subscription_id) {
    return Response.json({ error: 'No active subscription found.' }, { status: 404 })
  }

  const status = profile.subscription_status
  if (status !== 'active' && status !== 'trialing') {
    return Response.json({ error: 'Subscription is not active.' }, { status: 400 })
  }

  try {
    // cancel_at_period_end keeps access until the billing period ends
    await stripe.subscriptions.update(profile.stripe_subscription_id, {
      cancel_at_period_end: true,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Stripe error'
    return Response.json({ error: msg }, { status: 500 })
  }

  // Reflect immediately in DB so the UI updates without waiting for webhook
  await sb.from('profiles')
    .update({ subscription_status: 'canceled' })
    .eq('id', userId)

  const endDate = profile.subscription_end_date
    ? new Date(profile.subscription_end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'the end of your billing period'

  await createNotification(
    userId,
    'subscription_cancelled',
    'Subscription cancelled',
    `Your subscription has been cancelled. You keep full access until ${endDate}.`,
  )

  return Response.json({ success: true })
}
