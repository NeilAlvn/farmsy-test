import type { Metadata } from 'next'
import Hero from './components/Hero'
import Features from './components/Features'
import Footer from './components/Footer'

export const metadata: Metadata = {
  title: 'Farmsy – Discover Local Farms in NL & BE | Coming Soon',
  description:
    'Find local farms across the Netherlands and Belgium. Get early access to Farmsy, your guide to 12,000+ verified farms.',
  openGraph: {
    title: 'Farmsy – Discover Local Farms in NL & BE | Coming Soon',
    description:
      'Find local farms across the Netherlands and Belgium. Get early access to Farmsy, your guide to 12,000+ verified farms.',
    type: 'website',
    siteName: 'Farmsy',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Farmsy – Discover Local Farms in NL & BE | Coming Soon',
    description:
      'Find local farms across the Netherlands and Belgium. Get early access to Farmsy, your guide to 12,000+ verified farms.',
  },
}

type Props = {
  searchParams: Promise<{ source?: string }>
}

export default async function ComingSoonPage({ searchParams }: Props) {
  const { source = 'direct' } = await searchParams

  return (
    <div className="min-h-screen">
      <Hero source={source} />
      <Features source={source} />
      <Footer />
    </div>
  )
}
