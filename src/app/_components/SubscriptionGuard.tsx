'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Status = 'loading' | 'allowed' | 'redirect'

interface Profile {
  subscription_status: string | null
  subscription_end_date: string | null
}

// ─── Session cache ────────────────────────────────────────────────────────────
// Avoids a round-trip DB call on every map visit. TTL: 5 minutes.

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
  } catch { /* ignore — quota errors etc. */ }
}

// ─── Trial banner ──────────────────────────────────────────────────────────────

function trialDaysLeft(endDate: string | null): number {
  if (!endDate) return 0
  const ms = new Date(endDate).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

function TrialBanner({ endDate }: { endDate: string | null }) {
  const days = trialDaysLeft(endDate)
  const text = days <= 1 ? 'Your trial ends today' : `${days} days left in your free trial`

  return (
    <div
      className="flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-medium"
      style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
    >
      <span>{text}</span>
      <a
        href="/pricing"
        className="rounded-lg px-3 py-1 text-xs font-bold transition hover:opacity-80"
        style={{ backgroundColor: 'var(--primary-foreground)', color: 'var(--primary)' }}
      >
        Choose a plan
      </a>
    </div>
  )
}

// ─── Guard ─────────────────────────────────────────────────────────────────────

export default function SubscriptionGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    async function check() {
      // getSession() reads from localStorage — fast, no network call
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        router.replace('/pricing')
        return
      }

      const userId = session.user.id

      // Check session cache first — eliminates DB round trip on repeat visits
      const cached = readCache(userId)
      if (cached) {
        const allowed = cached.subscription_status === 'active'
                     || cached.subscription_status === 'trialing'
        if (!allowed) { router.replace('/pricing'); return }
        setProfile(cached)
        setStatus('allowed')
        // Refresh in background so cache stays fresh
        refreshProfile(userId)
        return
      }

      // No cache — fetch from DB
      await refreshProfile(userId, true)
    }

    async function refreshProfile(userId: string, applyResult = false) {
      const { data } = await supabase
        .from('profiles')
        .select('subscription_status, subscription_end_date')
        .eq('id', userId)
        .single()

      if (!data) {
        if (applyResult) router.replace('/pricing')
        return
      }

      writeCache(userId, data)

      if (applyResult) {
        const allowed = data.subscription_status === 'active'
                     || data.subscription_status === 'trialing'
        if (!allowed) { router.replace('/pricing'); return }
        setProfile(data)
        setStatus('allowed')
      } else {
        // Background refresh: update profile if subscription status changed
        setProfile(prev => {
          if (!prev) return prev
          return prev.subscription_status !== data.subscription_status ? data : prev
        })
      }
    }

    check()
  }, [router])

  if (status === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  return (
    <>
      {profile?.subscription_status === 'trialing' && (
        <TrialBanner endDate={profile.subscription_end_date} />
      )}
      {children}
    </>
  )
}
