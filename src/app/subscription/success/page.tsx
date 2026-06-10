'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ContentLayout from '@/app/_components/ContentLayout'
import { CheckCircle, Loader2 } from 'lucide-react'

export default function SubscriptionSuccessPage() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!sessionId) { setReady(true); return }

    fetch(`/api/stripe/activate?session_id=${sessionId}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          // Clear cached subscription status so SubscriptionGuard re-fetches
          try { sessionStorage.removeItem('farmsy:sub') } catch { /* ignore */ }
        } else {
          setError(true)
        }
      })
      .catch(() => setError(true))
      .finally(() => setReady(true))
  }, [sessionId])

  return (
    <ContentLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.12)' }}
        >
          {ready
            ? <CheckCircle className="w-8 h-8" style={{ color: 'var(--primary)' }} />
            : <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} />
          }
        </div>

        {!ready ? (
          <>
            <h1 className="text-3xl font-extrabold mb-3" style={{ color: 'var(--foreground)' }}>
              Activating your account…
            </h1>
            <p className="text-lg max-w-md" style={{ color: 'var(--muted-foreground)' }}>
              Just a moment while we set everything up.
            </p>
          </>
        ) : error ? (
          <>
            <h1 className="text-3xl font-extrabold mb-3" style={{ color: 'var(--foreground)' }}>
              Something went wrong
            </h1>
            <p className="text-lg mb-8 max-w-md" style={{ color: 'var(--muted-foreground)' }}>
              Your payment went through but we couldn't activate your account automatically.
              Please contact support or try refreshing.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-6 py-3 rounded-2xl font-semibold text-sm"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              Contact support
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-extrabold mb-3" style={{ color: 'var(--foreground)' }}>
              You&apos;re all set!
            </h1>
            <p className="text-lg mb-2 max-w-md" style={{ color: 'var(--muted-foreground)' }}>
              Your Farmsy Premium subscription is now active. Welcome aboard.
            </p>
            <p className="text-sm mb-10" style={{ color: 'var(--muted-foreground)' }}>
              Your 3-day free trial has started. You won&apos;t be charged until day 3.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/map"
                className="inline-flex items-center justify-center px-6 py-3 rounded-2xl font-semibold text-sm"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                Explore the map
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center px-6 py-3 rounded-2xl font-semibold text-sm"
                style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
              >
                Manage subscription
              </Link>
            </div>
          </>
        )}
      </div>
    </ContentLayout>
  )
}
