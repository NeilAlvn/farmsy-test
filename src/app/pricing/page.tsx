'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ContentLayout from '@/app/_components/ContentLayout'
import { supabase } from '@/lib/supabase'
import { Check, Zap } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

const FEATURES = [
  'Unlimited farm search results',
  'Full farm details (phone, website, hours)',
  'Export farms to Excel / CSV',
  'Email alerts for new farms near you',
  'Priority customer support',
  'Early access to new features',
]

export default function PricingPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<{ subscription_status?: string } | null>(null)
  const [loading, setLoading] = useState<'monthly' | 'yearly' | 'portal' | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return
      setUser(session.user)
      const { data } = await supabase
        .from('profiles')
        .select('subscription_status')
        .eq('id', session.user.id)
        .single()
      setProfile(data)
    })
  }, [])

  const isPaid = profile?.subscription_status === 'active'

  async function handleCheckout(plan: 'monthly' | 'yearly') {
    if (!user) {
      router.push('/auth/signin?next=/pricing')
      return
    }
    setLoading(plan)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, userId: user.id }),
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (e) {
      alert('Something went wrong. Please try again.')
      setLoading(null)
    }
  }

  async function handlePortal() {
    if (!user) return
    setLoading('portal')
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch {
      alert('Something went wrong. Please try again.')
      setLoading(null)
    }
  }

  return (
    <ContentLayout>
      {/* Hero */}
      <section className="py-20 px-4 text-center" style={{ backgroundColor: 'var(--background)' }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--primary)' }}>
          Farmsy Premium
        </p>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4" style={{ color: 'var(--foreground)' }}>
          Simple, transparent pricing
        </h1>
        <p className="text-lg max-w-xl mx-auto" style={{ color: 'var(--muted-foreground)' }}>
          Get unlimited access to every farm listing in the Netherlands and Belgium.
        </p>
      </section>

      {/* Cards */}
      <section className="pb-24 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

          {/* Monthly */}
          <div className="rounded-3xl border p-8 flex flex-col gap-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted-foreground)' }}>Monthly</p>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-extrabold" style={{ color: 'var(--foreground)' }}>€4.99</span>
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>/month</span>
              </div>
              <p className="text-sm mt-2" style={{ color: 'var(--muted-foreground)' }}>Cancel any time.</p>
            </div>

            <ul className="space-y-3 flex-1">
              {FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--foreground)' }}>
                  <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
                  {f}
                </li>
              ))}
            </ul>

            {isPaid ? (
              <button
                onClick={handlePortal}
                disabled={loading === 'portal'}
                className="w-full py-3 rounded-2xl font-semibold text-sm transition-opacity disabled:opacity-60"
                style={{ border: '1px solid var(--border)', color: 'var(--foreground)', backgroundColor: 'transparent' }}
              >
                {loading === 'portal' ? 'Loading…' : 'Manage subscription'}
              </button>
            ) : (
              <button
                onClick={() => handleCheckout('monthly')}
                disabled={loading === 'monthly'}
                className="w-full py-3 rounded-2xl font-semibold text-sm transition-opacity disabled:opacity-60"
                style={{ border: '1px solid var(--border)', color: 'var(--foreground)', backgroundColor: 'transparent' }}
              >
                {loading === 'monthly' ? 'Loading…' : 'Start monthly plan'}
              </button>
            )}
          </div>

          {/* Yearly — highlighted */}
          <div
            className="rounded-3xl p-8 flex flex-col gap-6 relative overflow-hidden"
            style={{ background: 'oklch(0.36 0.07 145 / 0.08)', border: '2px solid var(--primary)' }}
          >
            <div className="absolute top-5 right-5 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
              <Zap className="w-3 h-3" />
              Best value
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted-foreground)' }}>Yearly</p>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-extrabold" style={{ color: 'var(--foreground)' }}>€29.99</span>
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>/year</span>
              </div>
              <p className="text-sm mt-2" style={{ color: 'var(--primary)' }}>
                Save 50% vs monthly · €2.50/month
              </p>
            </div>

            <ul className="space-y-3 flex-1">
              {FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--foreground)' }}>
                  <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
                  {f}
                </li>
              ))}
            </ul>

            {isPaid ? (
              <button
                onClick={handlePortal}
                disabled={loading === 'portal'}
                className="w-full py-3 rounded-2xl font-bold text-sm transition-opacity disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                {loading === 'portal' ? 'Loading…' : 'Manage subscription'}
              </button>
            ) : (
              <button
                onClick={() => handleCheckout('yearly')}
                disabled={loading === 'yearly'}
                className="w-full py-3 rounded-2xl font-bold text-sm transition-opacity disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                {loading === 'yearly' ? 'Loading…' : 'Start yearly plan'}
              </button>
            )}
          </div>
        </div>

        {/* Fine print */}
        <p className="text-center text-xs mt-8" style={{ color: 'var(--muted-foreground)' }}>
          All prices include VAT. Payments processed securely by Stripe. Cancel any time from your billing portal.
        </p>
      </section>
    </ContentLayout>
  )
}
