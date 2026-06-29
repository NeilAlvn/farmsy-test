import type { Metadata } from 'next'
import FarmersContent from './FarmersContent'

export const metadata: Metadata = {
  title: 'For Farmers',
  description: 'Are you a farmer in the Netherlands or Belgium? List your farm on Farmsy for free and reach customers looking to buy local, direct from the source.',
  alternates: { canonical: '/farmers' },
}

export default function FarmersPage() {
  return <FarmersContent />
}
