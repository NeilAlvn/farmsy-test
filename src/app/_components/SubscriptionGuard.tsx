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

const CACHE_KEY = 'farmsy:sub'
const CACHE_TTL = 5 * 60 * 1000

function readCache(userId: string): Profile | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { uid, profile, ts } = JSON.parse(raw) as { uid: string; profile: Profile; ts: number }
    if (uid !== userId || Date.now() - ts > CACHE_TTL) return null
    return profile
  } catch { return null }
}

function writeCache(userId: string, profile: Profile) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ uid: userId, profile, ts: Date.now() }))
  } catch { /* ignore */ }
}

export function clearSubCache() {
  try { sessionStorage.removeItem(CACHE_KEY) } catch { /* ignore */ }
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
  // Track whether sign-in succeeded so onClose doesn't redirect away
  const didSignInRef = useRef(false)

  // Lightweight session-token check — runs on mount and every 60s.
  // Does NOT touch setState/loading so it's invisible to the UI.
  const checkSessionToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return  // auth state change handles the sign-out case

    const storedToken = localStorage.getItem('farmsy_session_token')
    if (!storedToken) return  // user logged in before this feature; skip

    try {
      const res = await fetch('/api/session/validate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ session_token: storedToken, user_id: session.user.id }),
      })
      const { valid } = await res.json()
      if (!valid) {
        localStorage.removeItem('farmsy_session_token')
        await supabase.auth.signOut()
        toast({
          type:    'error',
          title:   'Signed out',
          message: 'Your account was accessed from another device.',
          duration: 0,
        })
        router.replace('/')
      }
    } catch { /* network error — retry next poll */ }
  }, [toast, router])

  // Poll every 60 seconds to detect logins on other devices
  useEffect(() => {
    checkSessionToken()
    const id = setInterval(checkSessionToken, 60_000)
    return () => clearInterval(id)
  }, [checkSessionToken])

  const check = useCallback(async () => {
    setState('loading')
    toastFiredRef.current = false

    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
      setState('no-auth')
      return
    }

    const userId = session.user.id
    const token  = session.access_token

    // Try cache first
    const cached = readCache(userId)
    const profile = cached ?? await fetchProfile(token)

    if (!profile) {
      setState('no-sub')
      return
    }

    if (!cached) writeCache(userId, profile)
    else {
      // Refresh cache in background
      fetchProfile(token).then(p => { if (p) writeCache(userId, p) })
    }

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        clearSubCache()
        check()
      }
      if (event === 'SIGNED_OUT') {
        clearSubCache()
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
