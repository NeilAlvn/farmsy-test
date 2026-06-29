import type { Metadata } from 'next'
import PricingContent from './PricingContent'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple pricing for full access to Farmsy — 13,000+ verified farms across the Netherlands and Belgium. Start with a free 3-day trial.',
  alternates: { canonical: '/pricing' },
}

export default function PricingPage() {
  return <PricingContent />
}
