import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

async function updateProfile(userId: string, fields: Record<string, unknown>) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  await sb.from('profiles').update(fields).eq('id', userId)
}

function stripeStatusToDb(status: Stripe.Subscription.Status): string {
  switch (status) {
    case 'active':    return 'active'
    case 'trialing':  return 'trialing'
    case 'past_due':  return 'past_due'
    case 'canceled':
    case 'incomplete_expired':
    case 'unpaid':    return 'canceled'
    default:          return 'free'
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    // Checkout completed — subscription created (may be trialing or active)
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId  = session.metadata?.supabase_user_id
      const plan    = session.metadata?.plan

      if (userId && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string) as unknown as Stripe.Subscription & { current_period_end: number; trial_end: number | null }
        const dbStatus = stripeStatusToDb(sub.status)

        await updateProfile(userId, {
          stripe_subscription_id: sub.id,
          subscription_status:    dbStatus,
          subscription_plan:      plan ?? null,
          // For trialing subs, end date is the trial end; for active it's period end
          subscription_end_date:  sub.trial_end
            ? new Date(sub.trial_end * 1000).toISOString()
            : new Date(sub.current_period_end * 1000).toISOString(),
        })
      }
      break
    }

    // Subscription changed — covers trial→active, active→past_due, cancellations, etc.
    case 'customer.subscription.updated': {
      const sub    = event.data.object as Stripe.Subscription & { current_period_end: number; trial_end: number | null }
      const userId = sub.metadata?.supabase_user_id
      const plan   = sub.metadata?.plan

      if (userId) {
        await updateProfile(userId, {
          subscription_status:   stripeStatusToDb(sub.status),
          subscription_plan:     plan ?? null,
          subscription_end_date: sub.trial_end
            ? new Date(sub.trial_end * 1000).toISOString()
            : new Date(sub.current_period_end * 1000).toISOString(),
        })
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub    = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.supabase_user_id

      if (userId) {
        await updateProfile(userId, {
          subscription_status:    'canceled',
          subscription_plan:      null,
          subscription_end_date:  null,
          stripe_subscription_id: null,
        })
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string }
      if (invoice.subscription) {
        const sub    = await stripe.subscriptions.retrieve(invoice.subscription)
        const userId = sub.metadata?.supabase_user_id
        if (userId) {
          await updateProfile(userId, { subscription_status: 'past_due' })
        }
      }
      break
    }

    // Trial ending soon (3 days warning from Stripe) — no action needed for now
    case 'customer.subscription.trial_will_end':
      break
  }

  return Response.json({ received: true })
}
