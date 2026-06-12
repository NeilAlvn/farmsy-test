'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Zap, Loader2, CreditCard } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from './ToastProvider'

const FEATURES = [
  'Access to 12,717+ verified farms across NL & BE',
  'Full farm details — phone, website, hours',
  'Unlimited search & filters',
  'Early access to new features',
]

export type GateReason = 'no-sub' | 'canceled' | 'past-due'

interface Props {
  reason:       GateReason
  onSubscribed?: () => void  // called after successful subscription (guard re-checks)
  onClose?:     () => void   // optional — if caller allows dismissal
}

function Modal({ reason, onSubscribed, onClose }: Props) {
  const { toast } = useToast()
  const [visible, setVisible]         = useState(false)
  const [loading, setLoading]         = useState<'trial' | 'yearly' | 'lifetime' | 'portal' | 'auto' | null>(null)
  const [autoTried, setAutoTried]     = useState(false)
  const [hasCard, setHasCard]         = useState<boolean | null>(null)

  // Enter animation + scroll lock
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    document.body.style.overflow = 'hidden'
    return () => {
      cancelAnimationFrame(raf)
      document.body.style.overflow = ''
    }
  }, [])

  // For canceled accounts: silently check if a card is on file so we can
  // offer one-click resubscribe instead of going through Stripe Checkout again.
  useEffect(() => {
    if (reason !== 'canceled') return
    async function checkCard() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      try {
        const res = await fetch('/api/stripe/auto-subscribe', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: session.user.id, plan: 'yearly', dryRun: true }),
        })
        const data = await res.json()
        setHasCard(data.error !== 'no_payment_method' && data.error !== 'no_customer')
      } catch {
        setHasCard(false)
      }
    }
    checkCard()
  }, [reason])

  const close = useCallback(() => {
    setVisible(false)
    setTimeout(() => onClose?.(), 220)
  }, [onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && onClose) close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close, onClose])

  async function getUserId() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.user?.id ?? null
  }

  async function handleAutoSubscribe(plan: 'yearly') {
    const userId = await getUserId()
    if (!userId) return

    setLoading('auto')
    try {
      const res = await fetch('/api/stripe/auto-subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId, plan }),
      })
      const data = await res.json()

      if (data.success) {
        toast({
          type:    'success',
          title:   'Subscription reactivated!',
          message: 'Welcome back. You now have full access to the map.',
        })
        setVisible(false)
        setTimeout(() => onSubscribed?.(), 220)
      } else if (data.error === 'no_payment_method' || data.error === 'no_customer') {
        // No card on file — fall back to Stripe Checkout
        setHasCard(false)
        setAutoTried(true)
        setLoading(null)
      } else {
        // Card was declined / other payment failure
        toast({
          type:    'error',
          title:   'Payment failed',
          message: data.error ?? 'Your card was declined. Please update your payment method.',
          action:  { label: 'Update card', onClick: () => handlePortal() },
          duration: 0,
        })
        setLoading(null)
      }
    } catch {
      toast({ type: 'error', title: 'Something went wrong', message: 'Please try again.' })
      setLoading(null)
    }
  }

  async function handleCheckout(plan: 'yearly' | 'lifetime', loadingKey: 'trial' | 'yearly' | 'lifetime' = plan) {
    const userId = await getUserId()
    if (!userId) return

    setLoading(loadingKey)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan, userId }),
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch {
      toast({ type: 'error', title: 'Could not start checkout', message: 'Please try again.' })
      setLoading(null)
    }
  }

  async function handlePortal() {
    const userId = await getUserId()
    if (!userId) return

    setLoading('portal')
    try {
      const res = await fetch('/api/stripe/portal', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId }),
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch {
      toast({ type: 'error', title: 'Could not open billing portal', message: 'Please try again.' })
      setLoading(null)
    }
  }

  const heading =
    reason === 'past-due' ? 'Update your payment' :
    reason === 'canceled' ? 'Reactivate your access' :
                            'Unlock Farmsy Premium'

  const sub =
    reason === 'past-due' ? 'Your last payment failed. Update your billing to restore full access.' :
    reason === 'canceled' ? (hasCard ? 'Your subscription ended. Reactivate instantly with your saved card.' : 'Your subscription ended. Choose a plan to get back on the map.') :
                            'Start your free 3-day trial — no charge until day 3. Cancel anytime.'

  const isLoading = loading !== null

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      style={{
        transition:      'background-color 220ms ease',
        backgroundColor: visible ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0)',
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          backdropFilter: visible ? 'blur(4px)' : 'blur(0px)',
          transition:     'backdrop-filter 220ms ease',
        }}
        onClick={onClose ? close : undefined}
      />

      <div
        className="relative w-full max-w-3xl rounded-3xl border border-border/60 bg-background shadow-2xl overflow-hidden"
        style={{
          transition: 'opacity 220ms ease, transform 220ms cubic-bezier(0.34,1.26,0.64,1)',
          opacity:    visible ? 1 : 0,
          transform:  visible ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(16px)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-0">
          <div>
            <span className="font-display text-2xl font-medium italic tracking-tight" style={{ color: 'var(--foreground)' }}>
              Farmsy
            </span>
            <h2 className="text-xl font-bold mt-1" style={{ color: 'var(--foreground)' }}>{heading}</h2>
            <p className="text-sm mt-1 max-w-md" style={{ color: 'var(--muted-foreground)' }}>{sub}</p>
          </div>
          {onClose && (
            <button onClick={close} className="rounded-full p-1.5 hover:bg-border/40 transition-colors ml-4 shrink-0" style={{ color: 'var(--muted-foreground)' }}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* Past-due: portal only */}
        {reason === 'past-due' && (
          <div className="px-6 py-6">
            <button
              onClick={handlePortal}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-opacity disabled:opacity-60"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              {loading === 'portal'
                ? <><Loader2 size={14} className="animate-spin" /> Opening portal…</>
                : <><CreditCard size={14} /> Update payment method</>}
            </button>
            <p className="text-xs mt-2" style={{ color: 'var(--muted-foreground)' }}>
              You'll be taken to the Stripe billing portal to update your card.
            </p>
          </div>
        )}

        {/* Canceled: one-click resubscribe if card on file */}
        {reason === 'canceled' && hasCard && !autoTried && (
          <div className="px-6 py-4 flex flex-col gap-3">
            <button
              onClick={() => handleAutoSubscribe('yearly')}
              disabled={isLoading}
              className="w-full py-3 rounded-2xl font-bold text-sm transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              {loading === 'auto'
                ? <><Loader2 size={13} className="animate-spin" /> Processing…</>
                : <><Zap size={13} /> Reactivate — €29.99 / year</>}
            </button>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Your saved card will be charged immediately. Cancel anytime from billing.
            </p>
            <button
              onClick={() => { setHasCard(false); setAutoTried(true) }}
              className="text-xs underline underline-offset-2 hover:opacity-70 transition-opacity self-start"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Use a different card instead
            </button>
          </div>
        )}

        {/* Standard pricing cards (no-sub, or canceled with no card / different card) */}
        {(reason === 'no-sub' || (reason === 'canceled' && (!hasCard || autoTried))) && (
          <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Free trial */}
            {reason === 'no-sub' && (
              <div className="rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden"
                style={{ background: 'oklch(0.36 0.07 145 / 0.08)', border: '2px solid var(--primary)' }}>
                <div className="absolute top-3.5 right-3.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                  <Zap className="w-2.5 h-2.5" />
                  Start free
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--muted-foreground)' }}>Free trial</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold" style={{ color: 'var(--foreground)' }}>€0</span>
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>today</span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--primary)' }}>Then €29.99/year after 3 days</p>
                </div>
                <ul className="space-y-2 flex-1">
                  {FEATURES.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs" style={{ color: 'var(--foreground)' }}>
                      <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleCheckout('yearly', 'trial')}
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl font-bold text-sm transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  {loading === 'trial'
                    ? <><Loader2 size={13} className="animate-spin" /> Loading…</>
                    : 'Start free — no charge today'}
                </button>
                <p className="text-[10px] text-center -mt-2" style={{ color: 'var(--muted-foreground)' }}>
                  Card required · auto-renews after trial
                </p>
              </div>
            )}

            {/* Yearly */}
            <div className={`rounded-2xl p-5 flex flex-col gap-4 ${reason === 'canceled' ? 'relative overflow-hidden' : ''}`}
              style={reason === 'canceled'
                ? { background: 'oklch(0.36 0.07 145 / 0.08)', border: '2px solid var(--primary)' }
                : { borderColor: 'var(--border)', border: '1px solid var(--border)', backgroundColor: 'var(--card)' }}>
              {reason === 'canceled' && (
                <div className="absolute top-3.5 right-3.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                  <Zap className="w-2.5 h-2.5" />
                  Best value
                </div>
              )}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--muted-foreground)' }}>Yearly</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold" style={{ color: 'var(--foreground)' }}>€29.99</span>
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>/year</span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Billed annually</p>
              </div>
              <ul className="space-y-2 flex-1">
                {FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs" style={{ color: 'var(--foreground)' }}>
                    <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout('yearly')}
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl font-bold text-sm transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
                style={reason === 'canceled'
                  ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }
                  : { border: '1px solid var(--border)', color: 'var(--foreground)' }}
              >
                {loading === 'yearly'
                  ? <><Loader2 size={13} className="animate-spin" /> Loading…</>
                  : reason === 'canceled' ? 'Subscribe yearly' : 'Subscribe — €29.99/yr'}
              </button>
            </div>

            {/* Lifetime */}
            <div className="rounded-2xl border p-5 flex flex-col gap-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--muted-foreground)' }}>Lifetime</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold" style={{ color: 'var(--foreground)' }}>€49.99</span>
                  <span className="text-sm line-through" style={{ color: 'var(--muted-foreground)' }}>€59.99</span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>One-time · no renewals</p>
              </div>
              <ul className="space-y-2 flex-1">
                {FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs" style={{ color: 'var(--foreground)' }}>
                    <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout('lifetime')}
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
              >
                {loading === 'lifetime'
                  ? <><Loader2 size={13} className="animate-spin" /> Loading…</>
                  : 'Buy lifetime access'}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-[11px] pb-5 px-6" style={{ color: 'var(--muted-foreground)' }}>
          Payments processed securely by Stripe. Cancel anytime from your billing portal.
        </p>
      </div>
    </div>
  )
}

export default function SubscriptionGateModal({ reason, onSubscribed, onClose }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  return createPortal(<Modal reason={reason} onSubscribed={onSubscribed} onClose={onClose} />, document.body)
}
