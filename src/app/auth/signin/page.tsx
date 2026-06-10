'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SignInModal from '@/app/_components/SignInModal'

function SignInRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || searchParams.get('next') || '/'

  return (
    <SignInModal
      onClose={() => router.replace('/')}
      onSuccess={() => router.replace(redirectTo)}
    />
  )
}

export default function SignInPage() {
  return (
    // Full-page neutral background so the modal has something to sit on
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <Suspense>
        <SignInRedirect />
      </Suspense>
    </div>
  )
}
