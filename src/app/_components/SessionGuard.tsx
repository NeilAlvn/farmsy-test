'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useToast } from './ToastProvider'

export default function SessionGuard() {
  const { toast } = useToast()
  const router = useRouter()

  const checkSessionToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const storedToken = localStorage.getItem('farmsy_session_token')
    if (!storedToken) return

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

  useEffect(() => {
    checkSessionToken()
    const id = setInterval(checkSessionToken, 60_000)
    return () => clearInterval(id)
  }, [checkSessionToken])

  return null
}
