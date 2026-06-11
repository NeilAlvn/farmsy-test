'use client'

import { useState, type ReactNode, type CSSProperties, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SignInModal from './SignInModal'
import SubscriptionGateModal from './SubscriptionGateModal'
import type { GateReason } from './SubscriptionGateModal'

interface Props {
  href: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}

async function checkAccess(accessToken: string): Promise<'allowed' | 'no-sub' | 'canceled' | 'past-due'> {
  try {
    const res = await fetch('/api/profile/status', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return 'no-sub'
    const profile = await res.json() as { subscription_status: string | null }
    const s = profile.subscription_status
    if (s === 'active' || s === 'trialing') return 'allowed'
    if (s === 'canceled') return 'canceled'
    if (s === 'past_due') return 'past-due'
    return 'no-sub'
  } catch {
    return 'no-sub'
  }
}

export default function MapGateLink({ href, className, style, children }: Props) {
  const router = useRouter()
  const [modal, setModal] = useState<'none' | 'signin' | 'gate'>('none')
  const [gateReason, setGateReason] = useState<GateReason>('no-sub')

  async function navigate() {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
      setModal('signin')
      return
    }

    const result = await checkAccess(session.access_token)
    if (result === 'allowed') {
      router.push(href)
    } else {
      setGateReason(result === 'past-due' ? 'past-due' : result === 'canceled' ? 'canceled' : 'no-sub')
      setModal('gate')
    }
  }

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault()
    navigate()
  }

  return (
    <>
      <a href={href} onClick={handleClick} className={className} style={style}>
        {children}
      </a>

      {modal === 'signin' && (
        <SignInModal
          onClose={() => setModal('none')}
          onSuccess={async () => {
            setModal('none')
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const result = await checkAccess(session.access_token)
            if (result === 'allowed') {
              router.push(href)
            } else {
              setGateReason(result === 'past-due' ? 'past-due' : result === 'canceled' ? 'canceled' : 'no-sub')
              setModal('gate')
            }
          }}
        />
      )}

      {modal === 'gate' && (
        <SubscriptionGateModal
          reason={gateReason}
          onSubscribed={() => { setModal('none'); router.push(href) }}
          onClose={() => setModal('none')}
        />
      )}
    </>
  )
}
