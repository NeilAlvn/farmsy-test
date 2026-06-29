import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { createNotification } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Reverses a scheduled cancellation (cancel_at_period_end) on the user's
// existing subscription. Works while the sub is still active or trialing —
// i.e. before the period actually ends and the webhook flips it to canceled.
export async function POST(request: Request) {
  const { userId } = await request.json() as { userId: string }
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: profile } = await sb
    .from('profiles')
    .select('stripe_subscription_id, subscription_status')
    .eq('id', userId)
    .single()

  if (!profile?.stripe_subscription_id) {
    return Response.json({ error: 'No subscription found.' }, { status: 404 })
  }

  const status = profile.subscription_status
  if (status !== 'active' && status !== 'trialing') {
    return Response.json({ error: 'Subscription is no longer reversible — please resubscribe instead.' }, { status: 400 })
  }

  try {
    await stripe.subscriptions.update(profile.stripe_subscription_id, {
      cancel_at_period_end: false,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Stripe error'
    return Response.json({ error: msg }, { status: 500 })
  }

  await createNotification(
    userId,
    'subscription_activated',
    'Cancellation reversed',
    status === 'trialing'
      ? 'Your trial will continue as normal and convert to a paid plan when it ends.'
      : 'Your subscription will keep renewing — no further action needed.',
  )

  return Response.json({ success: true })
}
