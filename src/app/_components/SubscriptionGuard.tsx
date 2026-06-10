'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Status = 'loading' | 'allowed' | 'redirect'

interface Profile {
  subscription_status: string | null
  subscription_end_date: string | null
}

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

export default function SubscriptionGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        router.replace('/pricing')
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('subscription_status, subscription_end_date')
        .eq('id', session.user.id)
        .single()

      const allowed = data?.subscription_status === 'active'
                   || data?.subscription_status === 'trialing'

      if (!allowed) {
        router.replace('/pricing')
        return
      }

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
