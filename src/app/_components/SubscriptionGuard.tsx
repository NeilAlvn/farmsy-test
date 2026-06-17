'use client'

import { useEffect, useState, useRef, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SignInModal from './SignInModal'
import SubscriptionGateModal from './SubscriptionGateModal'
import { useToast } from './ToastProvider'
import { timeUntilLabel } from '@/lib/time'

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
      } else {
        // Refresh token is dead — the session was revoked (e.g. signed in on a
        // different device with single-session mode, or refresh token expired).
        // This is an AUTH failure, not a subscription failure — show sign-in
        // modal so the user can re-authenticate and get a fresh session.
        clearSubCache()
        isInitialCheckRef.current = false
        setState('no-auth')
        return
      }
    }

    if (!profile) {
      if (isInitialCheckRef.current) {
        // Refresh succeeded but profile API still failed (e.g. API is down).
        // Check stale cache as a safety net before gating.
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
        const { label, withinThreeDays } = timeUntilLabel(profile.subscription_end_date)
        if (withinThreeDays) {
          toastFiredRef.current = true
          toast({
            type:    'info',
            title:   `Your free trial ends in ${label}`,
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

  // React to auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // SIGNED_IN is intentionally NOT handled here.
      //
      // Supabase fires SIGNED_IN the instant onAuthStateChange is registered when
      // a session already exists. That creates a race: both the mount useEffect's
      // check() and this SIGNED_IN handler call check() concurrently while
      // isInitialCheckRef is still true. Whichever finishes last wins — so a slow
      // mount check (expired token → refresh retry) can overwrite 'allowed' with
      // 'no-sub' after the SIGNED_IN cache-hit check already set 'allowed'.
      //
      // Genuine new sign-ins are handled by SignInModal.onSuccess → check().
      // Tab-focus / session-restore recovery is handled by TOKEN_REFRESHED below.

      if (event === 'TOKEN_REFRESHED') {
        // Silently refresh cache. Unblocks any falsely-gated state (no-sub /
        // canceled / no-auth) that arose from an expired token on mount.
        if (session) {
          fetchProfile(session.access_token).then(p => {
            if (!p) return
            writeCache(session.user.id, p)
            const s = p.subscription_status
            if (s === 'active' || s === 'trialing') {
              setState(cur =>
                (cur === 'no-sub' || cur === 'canceled' || cur === 'loading' || cur === 'no-auth')
                  ? 'allowed'
                  : cur
              )
            }
          })
        }
      }
      if (event === 'SIGNED_OUT') {
        clearSubCache()
        toastFiredRef.current = false
        setState('no-auth')
      }
    })
    return () => subscription.unsubscribe()
  }, []) // empty deps: SIGNED_IN removed, no reference to `check`

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
