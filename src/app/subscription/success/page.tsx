import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import ContentLayout from '@/app/_components/ContentLayout'
import SuccessContent from './SuccessContent'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Subscription activated – Farmsy',
}

type ActivateResult =
  | { ok: true;  status: string }
  | { ok: false; reason: string }

async function activate(sessionId: string): Promise<ActivateResult> {
  try {
    if (!process.env.STRIPE_SECRET_KEY) return { ok: false, reason: 'no_stripe_key' }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    const userId = session.metadata?.supabase_user_id
    if (!userId) return { ok: false, reason: 'no_user_id_in_metadata' }

    if (!session.subscription) return { ok: false, reason: 'no_subscription_on_session' }
    if (typeof session.subscription === 'string') return { ok: false, reason: 'subscription_not_expanded' }

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
    const dbStatus = statusMap[sub.status] ?? 'free'

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, reason: 'no_service_role_key' }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )

    // Upsert so it works whether or not a profile row already exists
    const { error } = await sb.from('profiles').upsert({
      id:                     userId,
      stripe_customer_id:     session.customer as string,
      stripe_subscription_id: sub.id,
      subscription_status:    dbStatus,
      subscription_plan:      session.metadata?.plan ?? null,
      subscription_end_date:  sub.trial_end
        ? new Date(sub.trial_end * 1000).toISOString()
        : new Date(sub.current_period_end * 1000).toISOString(),
    }, { onConflict: 'id' })

    if (error) return { ok: false, reason: `db_error: ${error.message}` }

    return { ok: true, status: dbStatus }
  } catch (e) {
    return { ok: false, reason: `exception: ${e instanceof Error ? e.message : String(e)}` }
  }
}

export default async function SubscriptionSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id } = await searchParams

  const result: ActivateResult = session_id
    ? await activate(session_id)
    : { ok: false, reason: 'no_session_id_in_url' }

  return (
    <ContentLayout>
      {/* Temporary diagnostic — remove after confirming flow works */}
      <p className="text-center text-xs mt-4 font-mono" style={{ color: 'var(--muted-foreground)' }}>
        {result.ok
          ? `✓ activated: ${result.status}`
          : `✗ ${result.reason}`
        }
      </p>
      <SuccessContent activated={result.ok} />
    </ContentLayout>
  )
}
