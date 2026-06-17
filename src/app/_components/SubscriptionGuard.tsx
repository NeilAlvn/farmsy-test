'use client'

import { useEffect, useState, useRef, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SignInModal from './SignInModal'
import SubscriptionGateModal from './SubscriptionGateModal'
import { useToast } from './ToastProvider'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  subscription_status:  string | null
  subscription_end_date: string | null
}

type GuardState =
  | 'loading'
  | 'allowed'
  | 'no-auth'
  | 'no-sub'
  | 'canceled'
  | 'past-due'

// ─── Cache ────────────────────────────────────────────────────────────────────
// localStorage so the entry survives Next.js client-side navigation and
// browser-session restore (sessionStorage cleared each navigation in App Router).

const CACHE_KEY = 'farmsy:sub_v2'
const CACHE_TTL = 30 * 60 * 1000  // 30 min active window

function readCache(userId: string): Profile | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { uid, profile, ts } = JSON.parse(raw) as { uid: string; profile: Profile; ts: number }
    if (uid !== userId || Date.now() - ts > CACHE_TTL) return null
    return profile
  } catch { return null }
}

// Returns a stale entry (ignores TTL) — used as a safety net when the API
// call fails so a legitimate subscriber isn't falsely gated.
function readStaleCache(userId: string): Profile | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { uid, profile } = JSON.parse(raw) as { uid: string; profile: Profile; ts: number }
    return uid === userId ? profile : null
  } catch { return null }
}

function writeCache(userId: string, profile: Profile) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ uid: userId, profile, ts: Date.now() }))
  } catch { /* ignore */ }
}

export function clearSubCache() {
  try { localStorage.removeItem(CACHE_KEY) } catch { /* ignore */ }
}

async function fetchProfile(accessToken: string): Promise<Profile | null> {
  try {
    const res = await fetch('/api/profile/status', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    return await res.json() as Profile
  } catch { return null }
}

function daysUntil(isoDate: string): number {
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

// ─── Guard ─────────────────────────────────────────────────────────────────────

export default function SubscriptionGuard({ children }: { children: ReactNode }) {
  const { toast } = useToast()
  const router = useRouter()
  const [state, setState] = useState<GuardState>('loading')
  const toastFiredRef = useRef(false)
  const isInitialCheckRef = useRef(true)
  // Track whether sign-in succeeded so onClose doesn't redirect away
  const didSignInRef = useRef(false)

  const check = useCallback(async () => {
    // Only show the loading spinner on the very first check — prevents map from
    // unmounting and re-initialising on every background token refresh.
    if (isInitialCheckRef.current) {
      setState('loading')
    }

    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
      // On background re-checks a missing session is likely transient;
      // Supabase fires SIGNED_OUT for real sign-outs, so only gate here
      // on the initial mount.
      if (isInitialCheckRef.current) setState('no-auth')
      isInitialCheckRef.current = false
      return
    }

    const userId = session.user.id
    let token    = session.access_token

    // Post-checkout: the stripe_redirect flag means the user just completed a
    // Stripe checkout and we must bypass cache to see the newly-created subscription.
    const isPostCheckout = isInitialCheckRef.current
      && typeof sessionStorage !== 'undefined'
      && !!sessionStorage.getItem('stripe_redirect')
    if (isPostCheckout) {
      clearSubCache()
      sessionStorage.removeItem('stripe_redirect')
    }

    // Use cache for all checks (initial and background). The 30-min localStorage
    // TTL survives App Router navigation. TOKEN_REFRESHED silently refreshes it.
    const cached = readCache(userId)
    let profile = cached ?? await fetchProfile(token)

    // If the fetch failed on initial mount, the access_token from getSession() may
    // be expired (tokens last 1 h; auto-refresh fires in background but may not have
    // run yet). Force-refresh the session and retry once before giving up.
    if (!profile && !cached && isInitialCheckRef.current) {
      const { data: { session: fresh } } = await supabase.auth.refreshSession()
      if (fresh) {
        token   = fresh.access_token
        profile = await fetchProfile(token)
        if (profile) writeCache(fresh.user.id, profile)
      }
    }

    if (!profile) {
      if (isInitialCheckRef.current) {
        // Still failed after refresh. Before gating, check for a stale cache entry:
        // if the user was known to be active recently, show the map rather than
        // falsely blocking them due to a network error.
        const stale = readStaleCache(userId)
        const staleStatus = stale?.subscription_status
        if (staleStatus === 'active' || staleStatus === 'trialing') {
          setState('allowed')
        } else {
          setState('no-sub')
        }
      }
      // Background check failure: never downgrade — preserve current state.
      isInitialCheckRef.current = false
      return
    }

    // Only update the cache when we fetched fresh data — don't reset the TTL
    // clock by re-writing data that came from cache.
    if (!cached) writeCache(userId, profile)
    isInitialCheckRef.current = false
    const status = profile.subscription_status

    if (status === 'active' || status === 'trialing') {
      setState('allowed')

      // Notify about trial ending soon
      if (status === 'trialing' && profile.subscription_end_date && !toastFiredRef.current) {
        const days = daysUntil(profile.subscription_end_date)
        if (days <= 3 && days >= 0) {
          toastFiredRef.current = true
          toast({
            type:    'info',
            title:   days === 0 ? 'Your free trial ends today' : `Your free trial ends in ${days} day${days === 1 ? '' : 's'}`,
            message: 'You will be charged automatically when the trial ends. Cancel anytime in billing.',
            action:  { label: 'Manage billing', onClick: () => window.location.href = '/pricing' },
            duration: 0, // sticky
          })
        }
      }
      return
    }

    if (status === 'past_due') {
      setState('past-due')
      if (!toastFiredRef.current) {
        toastFiredRef.current = true
        toast({
          type:    'error',
          title:   'Payment failed',
          message: 'Your last payment did not go through. Update your billing to keep access.',
          action:  { label: 'Update billing', onClick: () => window.location.href = '/pricing' },
          duration: 0, // sticky
        })
      }
      // Still allow map access with warning banner
      setState('allowed')
      return
    }

    if (status === 'canceled') {
      // If end_date is still in the future, user paid until then — keep access
      if (profile.subscription_end_date && new Date(profile.subscription_end_date) > new Date()) {
        setState('allowed')
        if (!toastFiredRef.current) {
          toastFiredRef.current = true
          toast({
            type:    'info',
            title:   'Subscription cancelled',
            message: `You have access until ${new Date(profile.subscription_end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}. Resubscribe anytime.`,
            action:  { label: 'Resubscribe', onClick: () => window.location.href = '/account/subscription' },
            duration: 8000,
          })
        }
        return
      }
      setState('canceled')
      return
    }

    // No subscription or unknown status
    setState('no-sub')
  }, [toast])

  // Initial check
  useEffect(() => { check() }, [check])

  // Re-check when auth state changes (user signs in / out)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        // Supabase fires SIGNED_IN on tab-focus/session-restore too, not only
        // on genuine first sign-in. Do NOT reset toastFiredRef or
        // isInitialCheckRef here — that would re-show the loading spinner and
        // re-fire toasts every time the user switches browser tabs.
        // Do NOT clearSubCache() here either — the cache's uid/TTL checks
        // already reject stale or foreign-user entries. Clearing on every
        // tab-focus forces a network round-trip that can briefly show the
        // gate modal when the API is slow or fails.
        check()
      }
      if (event === 'TOKEN_REFRESHED') {
        // Refresh cache. If the user was falsely gated (no-sub/canceled) due to
        // an expired token on mount, a fresh active profile here unblocks them.
        if (session) {
          fetchProfile(session.access_token).then(p => {
            if (!p) return
            writeCache(session.user.id, p)
            const s = p.subscription_status
            if (s === 'active' || s === 'trialing') {
              setState(cur => (cur === 'no-sub' || cur === 'canceled' || cur === 'loading') ? 'allowed' : cur)
            }
          })
        }
      }
      if (event === 'SIGNED_OUT') {
        clearSubCache()
        toastFiredRef.current = false  // reset so next genuine sign-in shows toast
        setState('no-auth')
      }
    })
    return () => subscription.unsubscribe()
  }, [check])

  // ── Render ────────────────────────────────────────────────────────────────

  if (state === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  if (state === 'no-auth') {
    return (
      <>
        <div className="flex flex-1 items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
        <SignInModal
          onClose={() => { if (!didSignInRef.current) router.replace('/'); didSignInRef.current = false }}
          onSuccess={() => { didSignInRef.current = true; clearSubCache(); check() }}
        />
      </>
    )
  }

  if (state === 'no-sub') {
    return (
      <>
        <div className="flex flex-1 items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
        <SubscriptionGateModal
          reason="no-sub"
          onSubscribed={() => { clearSubCache(); check() }}
          onClose={() => router.replace('/pricing')}
        />
      </>
    )
  }

  if (state === 'canceled') {
    return (
      <>
        <div className="flex flex-1 items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
        <SubscriptionGateModal
          reason="canceled"
          onSubscribed={() => { clearSubCache(); check() }}
          onClose={() => router.replace('/pricing')}
        />
      </>
    )
  }

  return <>{children}</>
}
