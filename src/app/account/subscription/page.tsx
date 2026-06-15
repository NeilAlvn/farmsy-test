'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle2, Clock, XCircle, AlertCircle,
  ArrowLeft, Loader2, CreditCard, Zap, Infinity,
  CalendarDays, BadgeCheck,
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
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [action, setAction]   = useState<Action | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.replace('/'); return }
      setUserId(session.user.id)

      const res = await fetch('/api/profile/subscription', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) setProfile(await res.json())
      setLoading(false)
    }
    load()
  }, [router])

  async function handleAction(type: Action) {
    setError(null); setSuccess(null); setAction(type)
    try {
      if (type === 'cancel') {
        const res  = await fetch('/api/stripe/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        setSuccess('Your subscription will be cancelled at the end of the current billing period. You keep full access until then.')
        setProfile(p => p ? { ...p, subscription_status: 'canceled' } : p)
      }
      if (type === 'resubscribe') {
        const res  = await fetch('/api/stripe/resubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        if (data.url) { window.location.href = data.url; return }
        setSuccess('Your subscription has been reactivated! Welcome back.')
        setProfile(p => p ? { ...p, subscription_status: 'active' } : p)
      }
      if (type === 'portal') {
        const res  = await fetch('/api/stripe/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        window.location.href = data.url; return
      }
      if (type === 'upgrade') {
        const res  = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'lifetime', userId }) })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        window.location.href = data.url; return
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
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      </ContentLayout>
    )
  }

  const status      = profile?.subscription_status ?? 'free'
  const plan        = profile?.subscription_plan ?? null
  const endDate     = profile?.subscription_end_date ?? null
  const days        = daysUntil(endDate)
  const isLifetime  = plan === 'lifetime'
  const isTrialing  = status === 'trialing'
  const isActive    = status === 'active'
  const isCanceled  = status === 'canceled'
  const isPastDue   = status === 'past_due'
  const isFree      = status === 'free' || (!isActive && !isTrialing && !isCanceled && !isPastDue && !isLifetime)

  const planLabel  = isLifetime ? 'Lifetime' : isTrialing ? 'Free Trial' : plan === 'yearly' ? 'Yearly' : 'No Plan'
  const planAmount = isLifetime ? '€49.99' : isTrialing ? 'Free' : plan === 'yearly' ? '€29.99' : '—'
  const planSub    = isLifetime ? 'One-time payment' : isTrialing ? '→ €29.99/year after trial' : plan === 'yearly' ? 'per year' : ''

  return (
    <ContentLayout>
      <div className="mx-auto max-w-xl px-4 py-12">

        <Link href="/profile" className="inline-flex items-center gap-1.5 text-sm mb-10 transition-opacity hover:opacity-60" style={{ color: 'var(--muted-foreground)' }}>
          <ArrowLeft size={13} /> Back to profile
        </Link>

        <h1 className="text-3xl font-extrabold tracking-tight mb-1" style={{ color: 'var(--foreground)' }}>Subscription</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--muted-foreground)' }}>Manage your Farmsy plan and billing.</p>

        {/* Feedback */}
        {error && (
          <div className="mb-5 flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: 'oklch(0.62 0.2 25 / 0.06)', border: '1px solid oklch(0.62 0.2 25 / 0.15)', color: 'var(--destructive)' }}>
            <AlertCircle size={15} className="shrink-0 mt-0.5" />{error}
          </div>
        )}
        {success && (
          <div className="mb-5 flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.08)', border: '1px solid oklch(0.36 0.07 145 / 0.2)', color: 'var(--primary)' }}>
            <CheckCircle2 size={15} className="shrink-0 mt-0.5" />{success}
          </div>
        )}

        {/* ── Hero plan card ───────────────────────────────────────────── */}
        {(isActive || isTrialing || isLifetime) && (
          <div className="rounded-3xl p-8 mb-4 relative overflow-hidden"
            style={{ background: 'oklch(0.36 0.07 145 / 0.07)', border: '2px solid var(--primary)' }}>

            {/* Status pill */}
            <div className="absolute top-6 right-6">
              {(isActive || isLifetime) && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                  <BadgeCheck size={11} /> Active
                </span>
              )}
              {isTrialing && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                  style={{ backgroundColor: '#3b82f6', color: '#fff' }}>
                  <Clock size={11} /> Trial
                </span>
              )}
            </div>

            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--primary)' }}>
              Current plan
            </p>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-5xl font-extrabold" style={{ color: 'var(--foreground)' }}>{planAmount}</span>
              {planSub && <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{planSub}</span>}
            </div>
            <p className="text-lg font-semibold mb-6" style={{ color: 'var(--foreground)' }}>{planLabel} Plan</p>

            <div className="grid grid-cols-2 gap-4">
              {isLifetime && (
                <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.08)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--muted-foreground)' }}>Renewal</p>
                  <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--primary)' }}>
                    <Infinity size={14} /> Never
                  </p>
                </div>
              )}
              {isTrialing && endDate && (
                <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.08)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--muted-foreground)' }}>Trial ends</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{formatDate(endDate)}</p>
                </div>
              )}
              {isTrialing && (
                <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.08)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--muted-foreground)' }}>Days left</p>
                  <p className="text-sm font-semibold" style={{ color: '#3b82f6' }}>{days} day{days !== 1 ? 's' : ''}</p>
                </div>
              )}
              {isActive && !isLifetime && endDate && (
                <>
                  <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.08)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--muted-foreground)' }}>Next billing</p>
                    <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--foreground)' }}>
                      <CalendarDays size={13} style={{ color: 'var(--primary)' }} />{formatDate(endDate)}
                    </p>
                  </div>
                  <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.08)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--muted-foreground)' }}>Amount</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>€29.99</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Cancelled card */}
        {isCanceled && (
          <div className="rounded-3xl border p-8 mb-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>Current plan</p>
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                style={{ backgroundColor: 'oklch(0.5 0 0 / 0.08)', color: 'var(--muted-foreground)' }}>
                <XCircle size={11} /> Cancelled
              </span>
            </div>
            <p className="text-2xl font-extrabold mb-1" style={{ color: 'var(--foreground)' }}>Yearly Plan</p>
            {endDate && (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Access until <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{formatDate(endDate)}</span>
              </p>
            )}
          </div>
        )}

        {/* Past due card */}
        {isPastDue && (
          <div className="rounded-3xl border p-8 mb-4" style={{ borderColor: 'oklch(0.62 0.2 25 / 0.3)', backgroundColor: 'oklch(0.62 0.2 25 / 0.04)' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>Current plan</p>
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                style={{ backgroundColor: 'oklch(0.62 0.2 25 / 0.1)', color: 'var(--destructive)' }}>
                <AlertCircle size={11} /> Past Due
              </span>
            </div>
            <p className="text-2xl font-extrabold mb-1" style={{ color: 'var(--foreground)' }}>Yearly Plan</p>
            <p className="text-sm" style={{ color: 'var(--destructive)' }}>Payment failed — please update your billing details.</p>
          </div>
        )}

        {/* Free / no plan */}
        {isFree && (
          <div className="rounded-3xl border p-8 mb-4 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
            <p className="text-lg font-semibold mb-1" style={{ color: 'var(--foreground)' }}>No active plan</p>
            <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>Subscribe to unlock full access to Farmsy.</p>
            <Link href="/pricing" className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
              View Plans
            </Link>
          </div>
        )}

        {/* ── Actions ─────────────────────────────────────────────────── */}

        {/* Lifetime — nothing to do */}
        {isLifetime && (
          <div className="rounded-3xl border px-6 py-5 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
            You have lifetime access — no renewal, no hassle. Farmsy is yours forever. 🌱
          </div>
        )}

        {/* Active yearly — upgrade + cancel */}
        {isActive && !isLifetime && (
          <div className="rounded-3xl border p-6 flex flex-col gap-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>Actions</p>

            <div className="flex flex-col gap-1.5">
              <button onClick={() => handleAction('upgrade')} disabled={action !== null}
                className="inline-flex items-center gap-2 self-start rounded-2xl px-5 py-2.5 text-sm font-bold transition-opacity disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                {action === 'upgrade' ? <><Loader2 size={13} className="animate-spin" /> Loading…</> : <><Zap size={13} /> Upgrade to Lifetime — €49.99</>}
              </button>
              <p className="text-xs pl-1" style={{ color: 'var(--muted-foreground)' }}>Pay once, never renew again.</p>
            </div>

            <div className="h-px" style={{ backgroundColor: 'var(--border)' }} />

            <div className="flex flex-col gap-1.5">
              <button onClick={() => handleAction('cancel')} disabled={action !== null}
                className="inline-flex items-center gap-2 self-start rounded-2xl px-5 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60"
                style={{ border: '1px solid var(--border)', color: 'var(--muted-foreground)', backgroundColor: 'transparent' }}>
                {action === 'cancel' ? <><Loader2 size={13} className="animate-spin" /> Loading…</> : 'Cancel Subscription'}
              </button>
              <p className="text-xs pl-1" style={{ color: 'var(--muted-foreground)' }}>You keep access until the end of your billing period.</p>
            </div>
          </div>
        )}

        {/* Trialing */}
        {isTrialing && (
          <div className="rounded-3xl border p-6 flex flex-col gap-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>Actions</p>
            <div className="flex flex-col gap-1.5">
              <button onClick={() => handleAction('upgrade')} disabled={action !== null}
                className="inline-flex items-center gap-2 self-start rounded-2xl px-5 py-2.5 text-sm font-bold transition-opacity disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                {action === 'upgrade' ? <><Loader2 size={13} className="animate-spin" /> Loading…</> : <><Zap size={13} /> Upgrade to Lifetime — €49.99</>}
              </button>
              <p className="text-xs pl-1" style={{ color: 'var(--muted-foreground)' }}>Skip the trial, pay once, done forever.</p>
            </div>
            <div className="h-px" style={{ backgroundColor: 'var(--border)' }} />
            <div className="flex flex-col gap-1.5">
              <button onClick={() => handleAction('cancel')} disabled={action !== null}
                className="inline-flex items-center gap-2 self-start rounded-2xl px-5 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60"
                style={{ border: '1px solid var(--border)', color: 'var(--muted-foreground)', backgroundColor: 'transparent' }}>
                {action === 'cancel' ? <><Loader2 size={13} className="animate-spin" /> Loading…</> : 'Cancel Trial'}
              </button>
              <p className="text-xs pl-1" style={{ color: 'var(--muted-foreground)' }}>You won't be charged. Access ends when the trial expires.</p>
            </div>
          </div>
        )}

        {/* Cancelled */}
        {isCanceled && (
          <div className="rounded-3xl border p-6 flex flex-col gap-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>Actions</p>
            <div className="flex flex-col gap-1.5">
              <button onClick={() => handleAction('resubscribe')} disabled={action !== null}
                className="inline-flex items-center gap-2 self-start rounded-2xl px-5 py-2.5 text-sm font-bold transition-opacity disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                {action === 'resubscribe' ? <><Loader2 size={13} className="animate-spin" /> Loading…</> : 'Resubscribe — €29.99/year'}
              </button>
              <p className="text-xs pl-1" style={{ color: 'var(--muted-foreground)' }}>Restores full access immediately.</p>
            </div>
          </div>
        )}

        {/* Past due */}
        {isPastDue && (
          <div className="rounded-3xl border p-6 flex flex-col gap-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>Actions</p>
            <div className="flex flex-col gap-1.5">
              <button onClick={() => handleAction('portal')} disabled={action !== null}
                className="inline-flex items-center gap-2 self-start rounded-2xl px-5 py-2.5 text-sm font-bold transition-opacity disabled:opacity-60"
                style={{ backgroundColor: 'var(--destructive)', color: '#fff' }}>
                {action === 'portal' ? <><Loader2 size={13} className="animate-spin" /> Loading…</> : <><CreditCard size={13} /> Update Payment Method</>}
              </button>
              <p className="text-xs pl-1" style={{ color: 'var(--muted-foreground)' }}>You'll be taken to the Stripe billing portal.</p>
            </div>
          </div>
        )}

        {/* Billing portal shortcut */}
        {(isActive || isTrialing) && !isLifetime && (
          <p className="text-center text-xs mt-6" style={{ color: 'var(--muted-foreground)' }}>
            Need to update your card or view invoices?{' '}
            <button onClick={() => handleAction('portal')} disabled={action !== null}
              className="underline underline-offset-2 hover:opacity-70 transition-opacity disabled:opacity-40"
              style={{ color: 'var(--foreground)' }}>
              Open billing portal
            </button>
          </p>
        )}

      </div>
    </ContentLayout>
  )
}
