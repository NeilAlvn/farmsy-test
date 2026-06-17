'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import ContentLayout from '@/app/_components/ContentLayout'
import { supabase } from '@/lib/supabase'
import { Check, Zap, Sparkles, ArrowRight } from 'lucide-react'
import { timeUntilLabel } from '@/lib/time'
import SignInModal from '@/app/_components/SignInModal'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'

type Profile = {
  subscription_status?:    string
  subscription_plan?:      string
  subscription_end_date?:  string | null
}

export default function PricingPage() {
  const t = useTranslations('pricing')
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [loading, setLoading] = useState<'yearly' | 'lifetime' | null>(null)
  const [showSignIn, setShowSignIn] = useState(false)

  async function fetchProfile(accessToken: string) {
    try {
      const res = await fetch('/api/profile/subscription', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) setProfile(await res.json())
      else setProfile(null)
    } catch {
      setProfile(null)
    } finally {
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setUser(null); setProfile(null); setProfileLoading(false); return }
      setUser(session.user)
      await fetchProfile(session.access_token)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        await fetchProfile(session.access_token)
      }
      if (event === 'SIGNED_OUT') { setUser(null); setProfile(null); setProfileLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  const status     = profile?.subscription_status
  const isPaid     = status === 'active' || status === 'trialing'
  const isLifetime = profile?.subscription_plan === 'lifetime'
  const isCanceled = status === 'canceled'

  const FEATURES = [t('feature1'), t('feature2'), t('feature3'), t('feature4')]

  async function handleCheckout(plan: 'yearly' | 'lifetime') {
    if (!user) { setShowSignIn(true); return }
    setLoading(plan)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, userId: user.id }),
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      sessionStorage.setItem('stripe_redirect', '1')
      window.location.href = url
    } catch {
      alert('Something went wrong. Please try again.')
      setLoading(null)
    }
  }

  return (
    <>
    {showSignIn && (
      <SignInModal
        onClose={() => setShowSignIn(false)}
        onSuccess={() => setShowSignIn(false)}
      />
    )}
    <ContentLayout>
      {/* Hero */}
      <section className="py-20 px-4 text-center" style={{ backgroundColor: 'var(--background)' }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--primary)' }}>
          {t('eyebrow')}
        </p>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4" style={{ color: 'var(--foreground)' }}>
          {t('headline1')} <span className="serif-italic" style={{ color: 'var(--primary)' }}>{t('headlineEmphasis')}</span>
        </h1>
        <p className="text-lg max-w-xl mx-auto" style={{ color: 'var(--muted-foreground)' }}>
          {t('subheading')}
        </p>
      </section>

      {/* ── Loading (logged-in user, profile not yet fetched) ── */}
      {user && profileLoading && (
        <div className="flex justify-center py-24">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      )}

      {/* ── Lifetime members ── */}
      {!profileLoading && isLifetime && (
        <section className="pb-24 px-4">
          <div className="max-w-2xl mx-auto">
            <div
              className="rounded-3xl p-10 text-center flex flex-col items-center gap-6"
              style={{ background: 'oklch(0.36 0.07 145 / 0.08)', border: '2px solid var(--primary)' }}
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.15)' }}>
                <Sparkles className="w-8 h-8" style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--foreground)' }}>
                  You&apos;re on Farmsy Lifetime
                </h2>
                <p className="text-base" style={{ color: 'var(--muted-foreground)' }}>
                  Permanent access, no renewals, ever. Every feature — past and future — is yours.
                </p>
              </div>
              <div className="w-full max-w-xs flex flex-col gap-3">
                <div
                  className="rounded-2xl px-5 py-3 text-sm font-bold text-center"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  ✓ Lifetime Member
                </div>
                <Link
                  href="/map"
                  className="flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
                >
                  Go to the map <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-left w-full max-w-md">
                {FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2" style={{ color: 'var(--foreground)' }}>
                    <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-center text-xs mt-8" style={{ color: 'var(--muted-foreground)' }}>{t('finePrint')}</p>
        </section>
      )}

      {/* ── Active / trialing — manage + upgrade to lifetime ── */}
      {!profileLoading && isPaid && !isLifetime && (
        <section className="pb-24 px-4">
          <div className="max-w-2xl mx-auto flex flex-col gap-6">
            <div
              className="rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4"
              style={{ background: 'oklch(0.36 0.07 145 / 0.06)', border: '1px solid var(--border)' }}
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--primary)' }}>
                  {status === 'trialing' ? 'Free Trial Active' : 'Yearly Plan Active'}
                </p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {status === 'trialing' && profile?.subscription_end_date
                    ? `Trial ends in ${timeUntilLabel(profile.subscription_end_date).label} — full access is unlocked.`
                    : status === 'trialing'
                    ? 'You\'re in your 3-day trial — full access is unlocked.'
                    : 'You have full access to all Farmsy features.'}
                </p>
              </div>
              <Link
                href="/account/subscription"
                className="flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80 shrink-0"
                style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
              >
                Manage plan
              </Link>
            </div>

            {/* Lifetime upgrade card */}
            <div
              className="rounded-3xl p-8 flex flex-col gap-6 relative overflow-hidden"
              style={{ background: 'oklch(0.36 0.07 145 / 0.08)', border: '2px solid var(--primary)' }}
            >
              <div className="absolute top-5 right-5 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                <Zap className="w-3 h-3" />
                {t('lifetimeBadge')}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted-foreground)' }}>{t('lifetimeLabel')}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold" style={{ color: 'var(--foreground)' }}>€49.99</span>
                  <span className="text-lg line-through" style={{ color: 'var(--muted-foreground)' }}>€59.99</span>
                </div>
                <p className="text-sm mt-2" style={{ color: 'var(--primary)' }}>{t('lifetimeTagline')}</p>
              </div>
              <ul className="space-y-3">
                {FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--foreground)' }}>
                    <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2 mt-auto">
                <button
                  onClick={() => handleCheckout('lifetime')}
                  disabled={loading === 'lifetime'}
                  className="w-full py-3 rounded-2xl font-bold text-sm transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  {loading === 'lifetime' ? 'Loading…' : 'Upgrade to Lifetime'}
                </button>
                <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>{t('lifetimeNotice')}</p>
              </div>
            </div>
          </div>
          <p className="text-center text-xs mt-8" style={{ color: 'var(--muted-foreground)' }}>{t('finePrint')}</p>
        </section>
      )}

      {/* ── Free / canceled — show both cards ── */}
      {!profileLoading && !isPaid && !isLifetime && (
        <section className="pb-24 px-4">
          <div className="max-w-2xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">

            {/* Yearly */}
            <div className="rounded-3xl border p-8 flex flex-col gap-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted-foreground)' }}>{t('yearly')}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-extrabold" style={{ color: 'var(--foreground)' }}>€29.99</span>
                  <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('perYear')}</span>
                </div>
                <p className="text-sm mt-2" style={{ color: 'var(--muted-foreground)' }}>{t('yearlyTagline')}</p>
              </div>
              <ul className="space-y-3 flex-1">
                {FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--foreground)' }}>
                    <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleCheckout('yearly')}
                  disabled={loading === 'yearly'}
                  className="w-full py-3 rounded-2xl font-semibold text-sm transition-opacity disabled:opacity-60"
                  style={{ border: '1px solid var(--border)', color: 'var(--foreground)', backgroundColor: 'transparent' }}
                >
                  {loading === 'yearly'
                    ? 'Loading…'
                    : isCanceled
                      ? 'Subscribe Yearly'
                      : user
                        ? 'Get Yearly Plan'
                        : 'Try Free for 3 Days'}
                </button>
                <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>{t('yearlyRenew')}</p>
              </div>
            </div>

            {/* Lifetime — highlighted */}
            <div
              className="rounded-3xl p-8 flex flex-col gap-6 relative overflow-hidden"
              style={{ background: 'oklch(0.36 0.07 145 / 0.08)', border: '2px solid var(--primary)' }}
            >
              <div className="absolute top-5 right-5 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                <Zap className="w-3 h-3" />
                {t('lifetimeBadge')}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted-foreground)' }}>{t('lifetimeLabel')}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold" style={{ color: 'var(--foreground)' }}>€49.99</span>
                  <span className="text-lg line-through" style={{ color: 'var(--muted-foreground)' }}>€59.99</span>
                </div>
                <p className="text-sm mt-2" style={{ color: 'var(--primary)' }}>{t('lifetimeTagline')}</p>
              </div>
              <ul className="space-y-3">
                {FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--foreground)' }}>
                    <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2 mt-auto">
                <button
                  onClick={() => handleCheckout('lifetime')}
                  disabled={loading === 'lifetime'}
                  className="w-full py-3 rounded-2xl font-bold text-sm transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  {loading === 'lifetime' ? 'Loading…' : t('lifetimeCta')}
                </button>
                <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>{t('lifetimeNotice')}</p>
              </div>
            </div>
          </div>
          <p className="text-center text-xs mt-8" style={{ color: 'var(--muted-foreground)' }}>{t('finePrint')}</p>
        </section>
      )}
    </ContentLayout>
    </>
  )
}
