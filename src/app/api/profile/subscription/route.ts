import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function GET(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: { user }, error: authError } = await sb.auth.getUser(token)
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await sb
    .from('profiles')
    .select('subscription_status, subscription_plan, subscription_end_date, stripe_subscription_id, stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (error || !data) return Response.json({ error: 'Profile not found' }, { status: 404 })

  // For active or trialing subs, check Stripe for cancel_at_period_end so the
  // subscription page can show the correct state even after a page reload.
  // (A trial can also be scheduled to cancel at period end.)
  let cancel_at_period_end = false
  if (
    data.stripe_subscription_id &&
    (data.subscription_status === 'active' || data.subscription_status === 'trialing')
  ) {
    try {
      const sub = await stripe.subscriptions.retrieve(data.stripe_subscription_id) as Stripe.Subscription & { cancel_at_period_end: boolean }
      cancel_at_period_end = sub.cancel_at_period_end ?? false
    } catch { /* ignore — Stripe unreachable, default to false */ }
  }

  return Response.json({ ...data, cancel_at_period_end })
}
