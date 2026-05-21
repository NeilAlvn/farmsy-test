'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Wheat } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    // Supabase picks up the OAuth tokens from the URL hash automatically.
    // Wait for the session to settle then redirect.
    supabase.auth.getSession().then(({ data: { session } }) => {
      router.replace(session ? '/profile' : '/auth/signin')
    })
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
        <Wheat size={24} color="white" strokeWidth={2} />
      </div>
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm font-medium">Signing you in…</span>
      </div>
    </div>
  )
}
