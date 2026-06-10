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

// ─── Trial banner ──────────────────────────────────────────────────────────────

function trialDaysLeft(endDate: string | null): number {
  if (!endDate) return 0
  const ms = new Date(endDate).getTime() - Date.now()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

function TrialBanner({ endDate }: { endDate: string | null }) {
  const days = trialDaysLeft(endDate)
  const text = days < 1 ? 'Your free trial ends today' : `${days} days left in your free trial`

  return (
    <div
      className="flex items-center justify-center px-4 py-2.5 text-sm font-medium"
      style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
    >
      <span>{text}</span>
    </div>
  )
}

// ─── Guard ─────────────────────────────────────────────────────────────────────

async function fetchProfile(accessToken: string): Promise<Profile | null> {
  try {
    const res = await fetch('/api/profile/status', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    return await res.json() as Profile
  } catch { return null }
}

export default function SubscriptionGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.replace('/pricing'); return }

      const userId = session.user.id
      const token  = session.access_token

      // Check session cache first
      const cached = readCache(userId)
      if (cached) {
        const allowed = cached.subscription_status === 'active'
                     || cached.subscription_status === 'trialing'
        if (!allowed) { router.replace('/pricing'); return }
        setProfile(cached)
        setStatus('allowed')
        // Refresh in background
        fetchProfile(token).then(data => {
          if (!data) return
          writeCache(userId, data)
          setProfile(prev => {
            if (!prev) return prev
            return prev.subscription_status !== data.subscription_status ? data : prev
          })
        })
        return
      }

      // No cache — fetch from server
      const data = await fetchProfile(token)
      if (!data) { router.replace('/pricing'); return }

      writeCache(userId, data)

      const allowed = data.subscription_status === 'active'
                   || data.subscription_status === 'trialing'
      if (!allowed) { router.replace('/pricing'); return }

      setProfile(data)
      setStatus('allowed')
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
