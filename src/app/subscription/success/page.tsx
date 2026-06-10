import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import ContentLayout from '@/app/_components/ContentLayout'
import SuccessContent from './SuccessContent'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Subscription activated – Farmsy',
}

async function activate(sessionId: string): Promise<boolean> {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    const userId = session.metadata?.supabase_user_id
    if (!userId || !session.subscription || typeof session.subscription === 'string') {
      return false
    }

    const sub = session.subscription as Stripe.Subscription & {
      current_period_end: number
      trial_end: number | null
    }

    const statusMap: Record<string, string> = {
      trialing: 'trialing',
      active:   'active',
      past_due: 'past_due',
      canceled: 'canceled',
      incomplete_expired: 'canceled',
      unpaid:   'canceled',
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { error } = await sb.from('profiles').update({
      stripe_customer_id:     session.customer as string,
      stripe_subscription_id: sub.id,
      subscription_status:    statusMap[sub.status] ?? 'free',
      subscription_plan:      session.metadata?.plan ?? null,
      subscription_end_date:  sub.trial_end
        ? new Date(sub.trial_end * 1000).toISOString()
        : new Date(sub.current_period_end * 1000).toISOString(),
    }).eq('id', userId)

    return !error
  } catch {
    return false
  }
}

export default async function SubscriptionSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id } = await searchParams
  const activated = session_id ? await activate(session_id) : false

  return (
    <ContentLayout>
      <SuccessContent activated={activated} />
    </ContentLayout>
  )
}
