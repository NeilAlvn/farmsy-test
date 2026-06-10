import Link from 'next/link'
import ContentLayout from '@/app/_components/ContentLayout'
import { CheckCircle } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Subscription activated – Farmsy',
}

export default function SubscriptionSuccessPage() {
  return (
    <ContentLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.12)' }}>
          <CheckCircle className="w-8 h-8" style={{ color: 'var(--primary)' }} />
        </div>

        <h1 className="text-3xl font-extrabold mb-3" style={{ color: 'var(--foreground)' }}>
          You&apos;re all set!
        </h1>
        <p className="text-lg mb-2 max-w-md" style={{ color: 'var(--muted-foreground)' }}>
          Your Farmsy Premium subscription is now active. Welcome aboard.
        </p>
        <p className="text-sm mb-10" style={{ color: 'var(--muted-foreground)' }}>
          It may take a few seconds for your account to update. Refresh if needed.
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
      </div>
    </ContentLayout>
  )
}
