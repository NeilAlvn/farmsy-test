import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')

  if (!sessionId) {
    return Response.json({ error: 'Missing session_id' }, { status: 400 })
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription'],
  })

  const userId = session.metadata?.supabase_user_id
  if (!userId) {
    return Response.json({ error: 'No user in session' }, { status: 400 })
  }

  const sub = session.subscription as Stripe.Subscription & {
    current_period_end: number
    trial_end: number | null
  }

  const statusMap: Record<string, string> = {
    trialing: 'trialing',
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    incomplete_expired: 'canceled',
    unpaid: 'canceled',
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  await sb.from('profiles').update({
    stripe_customer_id:     session.customer as string,
    stripe_subscription_id: sub.id,
    subscription_status:    statusMap[sub.status] ?? 'free',
    subscription_plan:      session.metadata?.plan ?? null,
    subscription_end_date:  sub.trial_end
      ? new Date(sub.trial_end * 1000).toISOString()
      : new Date(sub.current_period_end * 1000).toISOString(),
  }).eq('id', userId)

  return Response.json({ ok: true, status: sub.status })
}
