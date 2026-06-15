import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { createNotification } from '@/lib/notifications'

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

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
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

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId  = session.metadata?.supabase_user_id
      const plan    = session.metadata?.plan
      if (!userId) break

      // Lifetime — one-time payment
      if (session.mode === 'payment') {
        await updateProfile(userId, {
          subscription_status:    'active',
          subscription_plan:      'lifetime',
          subscription_end_date:  null,
          stripe_subscription_id: null,
        })
        await createNotification(
          userId,
          'lifetime_activated',
          'Welcome to Farmsy Lifetime! 🌱',
          'You now have permanent access to Farmsy. No renewals, ever.',
        )
        break
      }

      // Yearly subscription with trial
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string) as unknown as Stripe.Subscription & { current_period_end: number; trial_end: number | null }
        const dbStatus = stripeStatusToDb(sub.status)

        await updateProfile(userId, {
          stripe_subscription_id: sub.id,
          subscription_status:    dbStatus,
          subscription_plan:      plan ?? null,
          subscription_end_date:  sub.trial_end
            ? new Date(sub.trial_end * 1000).toISOString()
            : new Date(sub.current_period_end * 1000).toISOString(),
        })

        if (dbStatus === 'trialing' && sub.trial_end) {
          await createNotification(
            userId,
            'trial_started',
            'Your 3-day free trial has started',
            `Enjoy full access to Farmsy! You won't be charged until ${formatDate(sub.trial_end)}. Cancel anytime before then.`,
          )
        } else if (dbStatus === 'active') {
          await createNotification(
            userId,
            'subscription_activated',
            'Subscription activated',
            `Payment successful. You now have full yearly access to Farmsy. Next billing on ${formatDate(sub.current_period_end)}.`,
          )
        }
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub      = event.data.object as Stripe.Subscription & { current_period_end: number; trial_end: number | null }
      const prev     = event.data.previous_attributes as Record<string, unknown> | undefined
      const userId   = sub.metadata?.supabase_user_id
      const plan     = sub.metadata?.plan
      const dbStatus = stripeStatusToDb(sub.status)

      if (!userId) break

      await updateProfile(userId, {
        subscription_status:   dbStatus,
        subscription_plan:     plan ?? null,
        // Use trial_end only while still trialing; once active use billing period end
        subscription_end_date: (sub.trial_end && sub.status === 'trialing')
          ? new Date(sub.trial_end * 1000).toISOString()
          : new Date(sub.current_period_end * 1000).toISOString(),
      })

      // Trial converted to active (trial ended, card charged)
      if (prev?.status === 'trialing' && sub.status === 'active') {
        await createNotification(
          userId,
          'subscription_activated',
          'Trial ended — subscription active',
          `Your free trial has ended. Payment of €29.99 was successful. Next billing on ${formatDate(sub.current_period_end)}.`,
        )
      }

      // Subscription renewed
      if (prev?.status === 'active' && sub.status === 'active' && prev?.current_period_end !== (sub as unknown as { current_period_end: number }).current_period_end) {
        await createNotification(
          userId,
          'payment_succeeded',
          'Subscription renewed',
          `Your yearly subscription has been renewed. Next billing on ${formatDate(sub.current_period_end)}.`,
        )
      }

      // Went past due
      if (sub.status === 'past_due' && prev?.status !== 'past_due') {
        await createNotification(
          userId,
          'payment_failed',
          'Payment failed',
          'We couldn\'t charge your card. Please update your billing details to keep access.',
        )
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub    = event.data.object as Stripe.Subscription & { current_period_end: number }
      const userId = sub.metadata?.supabase_user_id

      if (!userId) break

      await updateProfile(userId, {
        subscription_status:    'canceled',
        subscription_plan:      null,
        subscription_end_date:  null,
        stripe_subscription_id: null,
      })
      await createNotification(
        userId,
        'subscription_cancelled',
        'Subscription cancelled',
        `Your subscription has been cancelled. Access ended on ${formatDate(sub.current_period_end)}.`,
      )
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string }
      if (invoice.subscription) {
        const sub    = await stripe.subscriptions.retrieve(invoice.subscription)
        const userId = sub.metadata?.supabase_user_id
        if (userId) {
          await updateProfile(userId, { subscription_status: 'past_due' })
          await createNotification(
            userId,
            'payment_failed',
            'Payment failed',
            'We couldn\'t process your payment. Please update your billing details to avoid losing access.',
          )
        }
      }
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string; billing_reason?: string }
      // Skip the first invoice (covered by checkout.session.completed)
      if (invoice.billing_reason === 'subscription_create') break
      if (invoice.subscription) {
        const sub    = await stripe.subscriptions.retrieve(invoice.subscription) as unknown as Stripe.Subscription & { current_period_end: number }
        const userId = sub.metadata?.supabase_user_id
        if (userId) {
          await createNotification(
            userId,
            'payment_succeeded',
            'Payment successful',
            `€29.99 was charged successfully. Next billing on ${formatDate(sub.current_period_end)}.`,
          )
        }
      }
      break
    }

    // Stripe fires this 3 days before trial ends — since our trial IS 3 days,
    // this fires the moment the trial starts. Use it to send a day-2 reminder instead
    // via a separate scheduled check (or just let the trial_started notification carry it).
    case 'customer.subscription.trial_will_end': {
      const sub    = event.data.object as Stripe.Subscription & { trial_end: number | null }
      const userId = sub.metadata?.supabase_user_id
      if (userId && sub.trial_end) {
        await createNotification(
          userId,
          'trial_ending',
          'Trial ending soon',
          `Your free trial ends on ${formatDate(sub.trial_end)}. You'll be charged €29.99 unless you cancel before then.`,
        )
      }
      break
    }
  }

  return Response.json({ received: true })
}
