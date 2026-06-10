import Link from 'next/link'
import ContentLayout from '@/app/_components/ContentLayout'
import { XCircle } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Payment cancelled – Farmsy',
}

export default function SubscriptionCancelledPage() {
  return (
    <ContentLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: 'oklch(0.6 0.05 20 / 0.08)' }}>
          <XCircle className="w-8 h-8" style={{ color: 'var(--muted-foreground)' }} />
        </div>

        <h1 className="text-3xl font-extrabold mb-3" style={{ color: 'var(--foreground)' }}>
          Payment cancelled
        </h1>
        <p className="text-lg mb-10 max-w-md" style={{ color: 'var(--muted-foreground)' }}>
          No charge was made. You can upgrade whenever you&apos;re ready.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center px-6 py-3 rounded-2xl font-semibold text-sm"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            Back to pricing
          </Link>
          <Link
            href="/map"
            className="inline-flex items-center justify-center px-6 py-3 rounded-2xl font-semibold text-sm"
            style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            Continue browsing
          </Link>
        </div>
      </div>
    </ContentLayout>
  )
}
