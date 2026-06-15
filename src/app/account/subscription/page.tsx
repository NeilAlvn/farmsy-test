'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle2, Clock, XCircle, AlertCircle,
  Infinity, ArrowLeft, Loader2, CreditCard, Zap,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ContentLayout from '@/app/_components/ContentLayout'

interface Profile {
  subscription_status:    string | null
  subscription_plan:      string | null
  subscription_end_date:  string | null
  stripe_subscription_id: string | null
  stripe_customer_id:     string | null
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function daysUntil(iso: string | null): number {
  if (!iso) return 0
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
}

type Action = 'cancel' | 'resubscribe' | 'portal' | 'upgrade'

export default function SubscriptionPage() {
  const router = useRouter()
  const [profile, setProfile]   = useState<Profile | null>(null)
  const [userId, setUserId]     = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [action, setAction]     = useState<Action | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.replace('/'); return }
      setUserId(session.user.id)

      const { data } = await supabase
        .from('profiles')
        .select('subscription_status, subscription_plan, subscription_end_date, stripe_subscription_id, stripe_customer_id')
        .eq('id', session.user.id)
        .single()

      setProfile(data)
      setLoading(false)
    }
    load()
  }, [router])

  async function handleAction(type: Action) {
    setError(null)
    setSuccess(null)
    setAction(type)

    try {
      if (type === 'cancel') {
        const res  = await fetch('/api/stripe/cancel', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        setSuccess('Your subscription will be cancelled at the end of the current billing period.')
        setProfile(p => p ? { ...p, subscription_status: 'canceled' } : p)
      }

      if (type === 'resubscribe') {
        const res  = await fetch('/api/stripe/resubscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        if (data.url) { window.location.href = data.url; return }
        setSuccess('Your subscription has been reactivated!')
        setProfile(p => p ? { ...p, subscription_status: 'active' } : p)
      }

      if (type === 'portal') {
        const res  = await fetch('/api/stripe/portal', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        window.location.href = data.url
        return
      }

      if (type === 'upgrade') {
        const res  = await fetch('/api/stripe/checkout', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: 'lifetime', userId }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        window.location.href = data.url
        return
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setAction(null)
    }
  }

  if (loading) {
    return (
      <ContentLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      </ContentLayout>
    )
  }

  const status  = profile?.subscription_status ?? 'free'
  const plan    = profile?.subscription_plan ?? null
  const endDate = profile?.subscription_end_date ?? null
  const days    = daysUntil(endDate)
  const isLifetime  = plan === 'lifetime'
  const isTrialing  = status === 'trialing'
  const isActive    = status === 'active'
  const isCanceled  = status === 'canceled'
  const isPastDue   = status === 'past_due'

  // ── Derived display ──────────────────────────────────────────────────────────

  const planLabel =
    isLifetime  ? 'Lifetime Access' :
    isTrialing  ? 'Free Trial'       :
    plan === 'yearly' ? 'Yearly Plan' :
    'No active plan'

  const planAmount =
    isLifetime  ? '€49.99 one-time' :
    isTrialing  ? 'Free → €29.99/year' :
    plan === 'yearly' ? '€29.99 / year' :
    '—'

  const StatusBadge = () => {
    if (isLifetime || isActive)  return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.12)', color: 'var(--primary)' }}><CheckCircle2 size={11} /> Active</span>
    if (isTrialing)              return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: 'oklch(0.6 0.1 240 / 0.12)', color: '#3b82f6' }}><Clock size={11} /> Trial</span>
    if (isPastDue)               return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: 'oklch(0.62 0.2 25 / 0.1)', color: 'var(--destructive)' }}><AlertCircle size={11} /> Past Due</span>
    if (isCanceled)              return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: 'oklch(0.5 0 0 / 0.1)', color: 'var(--muted-foreground)' }}><XCircle size={11} /> Cancelled</span>
    return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: 'oklch(0.5 0 0 / 0.1)', color: 'var(--muted-foreground)' }}>Free</span>
  }

  const isSpinning = (a: Action) => action === a

  return (
    <ContentLayout>
      <div className="mx-auto max-w-2xl px-4 py-12">

        {/* Back */}
        <Link href="/profile" className="inline-flex items-center gap-1.5 text-sm mb-8 transition-opacity hover:opacity-70" style={{ color: 'var(--muted-foreground)' }}>
          <ArrowLeft size={14} /> Back to profile
        </Link>

        <h1 className="text-3xl font-extrabold tracking-tight mb-1" style={{ color: 'var(--foreground)' }}>
          Subscription
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--muted-foreground)' }}>
          Manage your Farmsy plan and billing.
        </p>

        {/* Feedback */}
        {error && (
          <div className="mb-6 flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm"
            style={{ backgroundColor: 'oklch(0.62 0.2 25 / 0.06)', border: '1px solid oklch(0.62 0.2 25 / 0.15)', color: 'var(--destructive)' }}>
            <AlertCircle size={15} className="shrink-0 mt-0.5" />{error}
          </div>
        )}
        {success && (
          <div className="mb-6 flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm"
            style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.08)', border: '1px solid oklch(0.36 0.07 145 / 0.2)', color: 'var(--primary)' }}>
            <CheckCircle2 size={15} className="shrink-0 mt-0.5" />{success}
          </div>
        )}

        {/* Plan card */}
        <div className="rounded-3xl border p-8 mb-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--muted-foreground)' }}>Current plan</p>
              <h2 className="text-2xl font-extrabold" style={{ color: 'var(--foreground)' }}>{planLabel}</h2>
            </div>
            <StatusBadge />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Amount</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{planAmount}</p>
            </div>

            {isLifetime && (
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Renewal</p>
                <p className="text-sm font-semibold flex items-center gap-1" style={{ color: 'var(--primary)' }}>
                  <Infinity size={14} /> Never
                </p>
              </div>
            )}

            {isTrialing && endDate && (
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Trial ends</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {formatDate(endDate)}
                  <span className="ml-2 text-xs font-normal" style={{ color: '#3b82f6' }}>
                    ({days} day{days !== 1 ? 's' : ''} left)
                  </span>
                </p>
              </div>
            )}

            {isActive && !isLifetime && endDate && (
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Next billing</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{formatDate(endDate)}</p>
              </div>
            )}

            {isCanceled && endDate && (
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Access until</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{formatDate(endDate)}</p>
              </div>
            )}

            {isPastDue && (
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Status</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--destructive)' }}>Payment failed</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="rounded-3xl border p-8 flex flex-col gap-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>Actions</p>

          {/* Lifetime — no actions */}
          {isLifetime && (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              You have lifetime access — no renewal needed. Enjoy Farmsy forever.
            </p>
          )}

          {/* Active yearly */}
          {isActive && !isLifetime && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => handleAction('upgrade')}
                  disabled={action !== null}
                  className="inline-flex items-center gap-2 self-start rounded-2xl px-5 py-2.5 text-sm font-bold transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  {isSpinning('upgrade') ? <><Loader2 size={13} className="animate-spin" /> Loading…</> : <><Zap size={13} /> Upgrade to Lifetime</>}
                </button>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Pay €49.99 once, never renew again.</p>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => handleAction('cancel')}
                  disabled={action !== null}
                  className="inline-flex items-center gap-2 self-start rounded-2xl px-5 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60"
                  style={{ border: '1px solid var(--border)', color: 'var(--muted-foreground)', backgroundColor: 'transparent' }}
                >
                  {isSpinning('cancel') ? <><Loader2 size={13} className="animate-spin" /> Loading…</> : 'Cancel Subscription'}
                </button>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>You keep access until the end of your billing period.</p>
              </div>
            </div>
          )}

          {/* Trialing */}
          {isTrialing && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => handleAction('upgrade')}
                  disabled={action !== null}
                  className="inline-flex items-center gap-2 self-start rounded-2xl px-5 py-2.5 text-sm font-bold transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  {isSpinning('upgrade') ? <><Loader2 size={13} className="animate-spin" /> Loading…</> : <><Zap size={13} /> Upgrade to Lifetime — €49.99</>}
                </button>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Skip the renewal forever. Pay once, done.</p>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => handleAction('cancel')}
                  disabled={action !== null}
                  className="inline-flex items-center gap-2 self-start rounded-2xl px-5 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60"
                  style={{ border: '1px solid var(--border)', color: 'var(--muted-foreground)', backgroundColor: 'transparent' }}
                >
                  {isSpinning('cancel') ? <><Loader2 size={13} className="animate-spin" /> Loading…</> : 'Cancel Trial'}
                </button>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>You won't be charged. Access ends when the trial expires.</p>
              </div>
            </div>
          )}

          {/* Cancelled */}
          {isCanceled && (
            <div className="flex flex-col gap-1">
              <button
                onClick={() => handleAction('resubscribe')}
                disabled={action !== null}
                className="inline-flex items-center gap-2 self-start rounded-2xl px-5 py-2.5 text-sm font-bold transition-opacity disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                {isSpinning('resubscribe') ? <><Loader2 size={13} className="animate-spin" /> Loading…</> : 'Resubscribe — €29.99/year'}
              </button>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Restores full access immediately.</p>
            </div>
          )}

          {/* Past due */}
          {isPastDue && (
            <div className="flex flex-col gap-1">
              <button
                onClick={() => handleAction('portal')}
                disabled={action !== null}
                className="inline-flex items-center gap-2 self-start rounded-2xl px-5 py-2.5 text-sm font-bold transition-opacity disabled:opacity-60"
                style={{ backgroundColor: 'var(--destructive)', color: '#fff' }}
              >
                {isSpinning('portal') ? <><Loader2 size={13} className="animate-spin" /> Loading…</> : <><CreditCard size={13} /> Update Payment Method</>}
              </button>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>You'll be taken to the Stripe billing portal.</p>
            </div>
          )}

          {/* Free / no plan */}
          {status === 'free' && (
            <div className="flex flex-col gap-1">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 self-start rounded-2xl px-5 py-2.5 text-sm font-bold transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                View Plans
              </Link>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Choose a plan to get full access to Farmsy.</p>
            </div>
          )}
        </div>

        {/* Billing portal link */}
        {(isActive || isTrialing || isPastDue) && !isLifetime && (
          <p className="text-center text-xs mt-6" style={{ color: 'var(--muted-foreground)' }}>
            Need to update your payment method or view invoices?{' '}
            <button
              onClick={() => handleAction('portal')}
              disabled={action !== null}
              className="underline underline-offset-2 hover:opacity-70 transition-opacity disabled:opacity-40"
              style={{ color: 'var(--foreground)' }}
            >
              Open billing portal
            </button>
          </p>
        )}

      </div>
    </ContentLayout>
  )
}
