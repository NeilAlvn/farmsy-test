'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { timeUntilLabel } from '@/lib/time'

export default function TrialCountdownBanner() {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      try {
        const res = await fetch('/api/profile/status', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) return
        const data = await res.json() as { subscription_status: string | null; subscription_end_date: string | null }
        if (data.subscription_status === 'trialing' && data.subscription_end_date) {
          const { label, withinThreeDays } = timeUntilLabel(data.subscription_end_date)
          if (withinThreeDays) setLabel(label)
        }
      } catch { /* ignore */ }
    }
    load()
  }, [])

  if (!label) return null

  return (
    <div className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium" style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.08)', borderBottom: '1px solid var(--border)', color: 'var(--foreground)' }}>
      <Clock size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} />
      <span>Your free trial ends in <strong>{label}</strong></span>
      <Link href="/account/subscription" className="underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity shrink-0">
        Manage
      </Link>
    </div>
  )
}
