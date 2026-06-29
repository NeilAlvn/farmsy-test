'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Gift, Check, ArrowRight, MapPin, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ContentLayout from '@/app/_components/ContentLayout'
import SignInModal from '@/app/_components/SignInModal'

type AuthState = 'checking' | 'in' | 'out'

const PERKS = [
  'Access to 12,000+ verified farms across NL & BE',
  'Full farm details — phone, website, opening hours',
  'Unlimited search & filters on the map',
]

export default function JoinPage() {
  const router = useRouter()
  const [authState, setAuthState] = useState<AuthState>('checking')
  const [hasCode, setHasCode]     = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref && /^[A-Z0-9]{6,12}$/i.test(ref)) {
      // Defensive: persist the referral code so signup credits the referrer
      // even if the global RefCapture effect hasn't run yet.
      document.cookie = `farmsy_ref=${ref.toUpperCase()}; path=/; max-age=604800; SameSite=Lax`
      setHasCode(true)
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState(session?.user ? 'in' : 'out')
    })
  }, [])

  return (
    <ContentLayout>
      {showSignIn && (
        <SignInModal
          onClose={() => setShowSignIn(false)}
          onSuccess={() => { setShowSignIn(false); router.push('/pricing') }}
        />
      )}

      <section className="mx-auto max-w-2xl px-6 py-20 text-center">
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.1)' }}
        >
          <Gift className="h-8 w-8" style={{ color: 'var(--primary)' }} />
        </div>

        {authState === 'in' ? (
          // Already signed in — referral codes only apply to brand-new accounts
          <>
            <h1 className="font-display text-4xl font-medium tracking-tight mb-4" style={{ color: 'var(--foreground)' }}>
              You&apos;re already a <span className="serif-italic" style={{ color: 'var(--primary)' }}>Farmsy member</span>
            </h1>
            <p className="mx-auto mb-8 max-w-md text-base leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              Referral invites are for new accounts only — but the whole map is already yours to explore.
            </p>
            <Link
              href="/map"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition hover:opacity-90"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              <MapPin className="h-4 w-4" /> Explore the map
            </Link>
          </>
        ) : (
          <>
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>
              {hasCode ? 'You’ve been invited' : 'Welcome to Farmsy'}
            </p>
            <h1 className="font-display text-4xl font-medium leading-[1.1] tracking-tight mb-4 sm:text-5xl" style={{ color: 'var(--foreground)' }}>
              {hasCode ? (
                <>A friend invited you to <span className="serif-italic" style={{ color: 'var(--primary)' }}>Farmsy</span></>
              ) : (
                <>Discover local farms <span className="serif-italic" style={{ color: 'var(--primary)' }}>near you</span></>
              )}
            </h1>
            <p className="mx-auto mb-8 max-w-md text-base leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              Start your <strong style={{ color: 'var(--foreground)' }}>free 3-day trial</strong> — no charge until day&nbsp;3, cancel anytime.
            </p>

            <ul className="mx-auto mb-9 inline-flex max-w-md flex-col gap-3 text-left">
              {PERKS.map(p => (
                <li key={p} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--foreground)' }}>
                  <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--primary)' }} />
                  {p}
                </li>
              ))}
            </ul>

            <div>
              {authState === 'checking' ? (
                <span className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </span>
              ) : (
                <button
                  onClick={() => setShowSignIn(true)}
                  className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold transition hover:opacity-90"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  Claim your free trial <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>

            <p className="mt-6 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Already have an account?{' '}
              <button onClick={() => setShowSignIn(true)} className="underline underline-offset-2 hover:opacity-70" style={{ color: 'var(--foreground)' }}>
                Sign in
              </button>
            </p>
          </>
        )}
      </section>
    </ContentLayout>
  )
}
