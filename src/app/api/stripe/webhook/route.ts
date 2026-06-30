import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { createNotification } from '@/lib/notifications'
import { rewardReferrerOnConversion } from '@/lib/referrals'
import { logActivity } from '@/lib/activity'
import {
  sendWelcomeEmail,
  sendPaymentConfirmationEmail,
  sendTrialEndingEmail,
} from '@/lib/email'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function updateProfile(userId: string, fields: Record<string, unknown>) {
  await sb().from('profiles').update(fields).eq('id', userId)
}

async function getEmail(userId: string, fallback?: string | null): Promise<string | null> {
  if (fallback) return fallback
  const { data } = await sb().from('profiles').select('email').eq('id', userId).single()
  return data?.email ?? null
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

      // This user just added a card (started a trial / bought lifetime) — if they
      // were referred, the referrer now earns their free month. Gating here (not
      // on bare sign-up) requires a real payment method, blocking reward farming.
      await rewardReferrerOnConversion(userId)

      const email = await getEmail(userId, session.customer_details?.email ?? session.customer_email)

      // Lifetime — one-time payment
      // Reset applied referral months credit (was used to extend trial at checkout)
      const referralMonthsApplied = parseInt(session.metadata?.referral_months_applied ?? '0')
      if (referralMonthsApplied > 0) {
        await sb().from('profiles')
          .update({ pending_referral_months: 0 })
          .eq('id', userId)
      }

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
        if (email) {
          await sendPaymentConfirmationEmail(email, { plan: 'lifetime', amount: '€49.99' })
        }
        await logActivity('subscription_started', `Lifetime purchased (€49.99)`, { actor: email ?? userId })
        break
      }

      // Yearly subscription with (or without) trial
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string) as unknown as Stripe.Subscription & { trial_end: number | null }
        const dbStatus = stripeStatusToDb(sub.status)
        const periodEnd = (sub.items?.data?.[0] as unknown as { current_period_end?: number })?.current_period_end

        await updateProfile(userId, {
          stripe_subscription_id: sub.id,
          subscription_status:    dbStatus,
          subscription_plan:      plan ?? null,
          subscription_end_date:  sub.trial_end
            ? new Date(sub.trial_end * 1000).toISOString()
            : periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        })

        if (dbStatus === 'trialing' && sub.trial_end) {
          await createNotification(
            userId,
            'trial_started',
            'Your 3-day free trial has started',
            `Enjoy full access to Farmsy! You won't be charged until ${formatDate(sub.trial_end)}. Cancel anytime before then.`,
          )
          if (email) {
            await sendWelcomeEmail(email)
          }
          await logActivity('subscription_started', `Free trial started (yearly)`, { actor: email ?? userId })
        } else if (dbStatus === 'active') {
          await createNotification(
            userId,
            'subscription_activated',
            'Subscription activated',
            `Payment successful. You now have full yearly access to Farmsy.${periodEnd ? ` Next billing on ${formatDate(periodEnd)}.` : ''}`,
          )
          if (email) {
            await sendPaymentConfirmationEmail(email, {
              plan: 'yearly',
              amount: '€29.99',
              nextBillingDate: periodEnd ? formatDate(periodEnd) : undefined,
            })
          }
          await logActivity('subscription_started', `Yearly subscription active (€29.99)`, { actor: email ?? userId })
        }
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub      = event.data.object as Stripe.Subscription & { trial_end: number | null }
      const prev     = event.data.previous_attributes as Record<string, unknown> | undefined
      const userId   = sub.metadata?.supabase_user_id
      const plan     = sub.metadata?.plan
      const dbStatus = stripeStatusToDb(sub.status)

      if (!userId) break

      const periodEnd = (sub.items?.data?.[0] as unknown as { current_period_end?: number })?.current_period_end

      await updateProfile(userId, {
        subscription_status:   dbStatus,
        subscription_plan:     plan ?? null,
        subscription_end_date: (sub.trial_end && sub.status === 'trialing')
          ? new Date(sub.trial_end * 1000).toISOString()
          : periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      })

      // Trial converted to active (trial ended, card charged)
      if (prev?.status === 'trialing' && sub.status === 'active') {
        await createNotification(
          userId,
          'subscription_activated',
          'Trial ended — subscription active',
          `Your free trial has ended. Payment of €29.99 was successful.${periodEnd ? ` Next billing on ${formatDate(periodEnd)}.` : ''}`,
        )
        const email = await getEmail(userId)
        if (email) {
          await sendPaymentConfirmationEmail(email, {
            plan: 'yearly',
            amount: '€29.99',
            nextBillingDate: periodEnd ? formatDate(periodEnd) : undefined,
          })
        }
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
      const sub    = event.data.object as Stripe.Subscription & { current_period_end: number; trial_end: number | null }
      const userId = sub.metadata?.supabase_user_id
      const plan   = sub.metadata?.plan

      if (!userId) break

      // Track cancellation for win-back cron (only yearly, not lifetime)
      const isYearly = plan === 'yearly'

      await updateProfile(userId, {
        subscription_status:    'canceled',
        subscription_plan:      null,
        subscription_end_date:  null,
        stripe_subscription_id: null,
        ...(isYearly ? { cancelled_at: new Date().toISOString(), win_back_sent: false } : {}),
      })
      await createNotification(
        userId,
        'subscription_cancelled',
        'Subscription cancelled',
        `Your subscription has been cancelled. Access ended on ${formatDate(sub.current_period_end)}.`,
      )
      await logActivity('subscription_cancelled', `Subscription cancelled`, { actor: (await getEmail(userId)) ?? userId })
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
          await logActivity('payment_failed', `Payment failed`, { actor: (await getEmail(userId)) ?? userId })
        }
      }
      break
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string; billing_reason?: string }
      // Skip the first invoice (covered by checkout.session.completed)
      if (invoice.billing_reason === 'subscription_create') break
      if (invoice.subscription) {
        const sub       = await stripe.subscriptions.retrieve(invoice.subscription) as unknown as Stripe.Subscription
        const userId    = sub.metadata?.supabase_user_id
        const periodEnd = (sub.items?.data?.[0] as unknown as { current_period_end?: number })?.current_period_end
        if (userId) {
          await createNotification(
            userId,
            'payment_succeeded',
            'Payment successful',
            `€29.99 was charged successfully.${periodEnd ? ` Next billing on ${formatDate(periodEnd)}.` : ''}`,
          )
          const email = await getEmail(userId)
          if (email) {
            await sendPaymentConfirmationEmail(email, {
              plan: 'yearly',
              amount: '€29.99',
              nextBillingDate: periodEnd ? formatDate(periodEnd) : undefined,
            })
          }
          await logActivity('payment_succeeded', `Renewal payment received (€29.99)`, { actor: email ?? userId })
        }
      }
      break
    }

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
        const email = await getEmail(userId)
        if (email) {
          await sendTrialEndingEmail(email, { endDate: formatDate(sub.trial_end) })
        }
      }
      break
    }
  }

  return Response.json({ received: true })
}
