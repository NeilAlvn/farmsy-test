'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SignInModal from '@/app/_components/SignInModal'

function SignInRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || searchParams.get('next') || '/'
  const verified   = searchParams.get('verified') === 'true'
  const reset      = searchParams.get('reset') === 'true'
  const error      = searchParams.get('error')

  let initialMessage: { type: 'success' | 'error'; text: string } | undefined
  if (verified) {
    initialMessage = { type: 'success', text: 'Email verified! You can now sign in.' }
  } else if (reset) {
    initialMessage = { type: 'success', text: 'Password updated! You can now sign in.' }
  } else if (error === 'invalid-token') {
    initialMessage = { type: 'error', text: 'This link is invalid. Please try again.' }
  } else if (error === 'token-expired') {
    initialMessage = { type: 'error', text: 'This link has expired. Please request a new one.' }
  }

  return (
    <SignInModal
      onClose={() => router.replace('/')}
      onSuccess={() => router.replace(redirectTo)}
      initialMessage={initialMessage}
    />
  )
}

export default function SignInPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <Suspense>
        <SignInRedirect />
      </Suspense>
    </div>
  )
}
