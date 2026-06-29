import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import LandingPage from './_components/LandingPage'

export const metadata: Metadata = {
  title: { absolute: 'Farmsy – Discover Local Farms in the Netherlands & Belgium' },
  description:
    'Farmsy connects you with verified farms across the Netherlands and Belgium. From farm shops to organic producers — discover, connect, and support local agriculture.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Farmsy – Discover Local Farms in the Netherlands & Belgium',
    description: 'Discover 13,000+ verified farms across the Netherlands and Belgium.',
    url: 'https://farmsy.app',
    type: 'website',
    siteName: 'Farmsy',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Farmsy – Discover Local Farms in the Netherlands & Belgium',
    description: 'Discover 13,000+ verified farms across the Netherlands and Belgium.',
  },
}

export const dynamic = 'force-dynamic'

export type FarmPreview = {
  osm_id: string
  name: string
  city: string | null
  image: string
  farm_type: unknown
  description: string | null
  phone: string | null
  website: string | null
  opening_hours: string | null
  enrichment_source: string | null
  source: string | null
}

async function fetchFeaturedFarms(): Promise<FarmPreview[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data } = await supabase
    .from('farms')
    .select('osm_id, name, city, image, farm_type, description, phone, website, opening_hours, enrichment_source, source')
    .eq('is_published', true)
    .not('image', 'is', null)
    .not('osm_id', 'is', null)
    .not('description', 'is', null)
    .not('opening_hours', 'is', null)
    .or('phone.not.is.null,website.not.is.null')
    .limit(40)

  if (!data) return []

  const shuffled = [...data].sort(() => Math.random() - 0.5)
  const valid: FarmPreview[] = []
  for (const farm of shuffled) {
    if (valid.length >= 8) break
    try {
      const res = await fetch(farm.image as string, {
        method: 'HEAD',
        headers: { Referer: '' },
        signal: AbortSignal.timeout(2000),
        next: { revalidate: 3600 },
      })
      const ct = res.headers.get('content-type')
      if (res.ok && ct?.startsWith('image/')) valid.push(farm as FarmPreview)
    } catch { /* skip broken images */ }
  }
  return valid
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Farmsy',
  url: 'https://farmsy.app',
  logo: 'https://farmsy.app/icon',
  description:
    'Farmsy helps you discover verified local farms, farm shops, and direct-to-consumer food producers across the Netherlands and Belgium.',
}

export default async function Home() {
  const farms = await fetchFeaturedFarms()
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <LandingPage farms={farms} />
    </>
  )
}
