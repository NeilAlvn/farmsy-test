'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { CheckCircle, AlertCircle } from 'lucide-react'

export default function SuccessContent({ activated }: { activated: boolean }) {
  useEffect(() => {
    // Clear cached subscription status so SubscriptionGuard re-fetches from DB
    try { sessionStorage.removeItem('farmsy:sub') } catch { /* ignore */ }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
        style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.12)' }}
      >
        {activated
          ? <CheckCircle className="w-8 h-8" style={{ color: 'var(--primary)' }} />
          : <AlertCircle className="w-8 h-8" style={{ color: 'var(--primary)' }} />
        }
      </div>

      {activated ? (
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
      ) : (
        <>
          <h1 className="text-3xl font-extrabold mb-3" style={{ color: 'var(--foreground)' }}>
            Payment received
          </h1>
          <p className="text-lg mb-2 max-w-md" style={{ color: 'var(--muted-foreground)' }}>
            Your payment went through. It may take a moment for your account to activate — please refresh in a few seconds.
          </p>
          <p className="text-sm mb-10" style={{ color: 'var(--muted-foreground)' }}>
            If access isn&apos;t granted after refreshing, contact support.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/map"
              className="inline-flex items-center justify-center px-6 py-3 rounded-2xl font-semibold text-sm"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              Try the map
            </Link>
            <Link
              href="/messages"
              className="inline-flex items-center justify-center px-6 py-3 rounded-2xl font-semibold text-sm"
              style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
            >
              Contact support
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
