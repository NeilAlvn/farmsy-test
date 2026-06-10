import type { Metadata } from 'next'
import Link from 'next/link'
import { MapPin, Database, Users, Leaf, ArrowRight, Globe } from 'lucide-react'
import ContentLayout from '@/app/_components/ContentLayout'

export const metadata: Metadata = {
  title: 'About – Farmsy',
  description: 'Learn about Farmsy — connecting consumers with local farms across the Netherlands and Belgium.',
}

const DATA_SOURCES = [
  {
    name: 'OpenStreetMap',
    region: 'Netherlands & Belgium',
    description: 'The open geographic database that powers our core farm locations, addresses, and opening hours. Data contributed by thousands of volunteers worldwide.',
    license: 'Open Database License (ODbL)',
  },
  {
    name: 'Foursquare',
    region: 'Enrichment',
    description: 'Used to enrich listings with additional business details such as phone numbers, websites, and photos.',
    license: 'Foursquare Developer Terms',
  },
  {
    name: 'Overture Maps',
    region: 'Enrichment',
    description: 'Open map data from the Overture Maps Foundation, used to fill gaps in coverage and add verified location data.',
    license: 'CDLA Permissive 2.0',
  },
  {
    name: 'Traces',
    region: 'Enrichment',
    description: 'Location intelligence platform providing supplementary contact information and business details for farm listings.',
    license: 'Commercial license',
  },
]

const VALUES = [
  {
    Icon: Leaf,
    title: 'Local first',
    desc: 'We believe fresh food tastes better and is better for the planet when it travels fewer kilometres from field to fork.',
  },
  {
    Icon: Globe,
    title: 'Open data',
    desc: 'Our core dataset is built on OpenStreetMap — a community-driven, open geographic database anyone can contribute to.',
  },
  {
    Icon: Users,
    title: 'Farmer-owned',
    desc: 'Farmers can claim their listing for free and keep their own information accurate — hours, contact details, and more.',
  },
  {
    Icon: Database,
    title: 'Transparent sources',
    desc: 'We clearly attribute every data source — OpenStreetMap, Foursquare, Overture Maps, and Traces — on every listing where it applies.',
  },
]

export default function AboutPage() {
  return (
    <ContentLayout>

      {/* Page header */}
      <section className="px-6 pt-20 pb-16" style={{ borderBottom: '1px solid oklch(0.9 0.008 80 / 0.6)' }}>
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>
            About us
          </p>
          <h1 className="font-display text-5xl font-medium leading-[1.05] tracking-[-0.025em]" style={{ color: 'var(--foreground)' }}>
            Connecting people with the{' '}
            <span className="serif-italic" style={{ color: 'var(--primary)' }}>farmers who feed them</span>
          </h1>
          <p className="mt-5 text-lg leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            Farmsy is a free map of local farms, roadside stands, and direct-to-consumer food producers in the Netherlands and Belgium.
          </p>
          <Link
            href="/map"
            className="mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition hover:opacity-90"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            Explore the map <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Mission */}
      <section className="px-6 py-20" style={{ borderBottom: '1px solid oklch(0.9 0.008 80 / 0.6)' }}>
        <div className="mx-auto max-w-3xl space-y-5 text-base leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>Our mission</p>
          <h2 className="font-display text-3xl font-medium tracking-[-0.02em]" style={{ color: 'var(--foreground)' }}>
            Making local food <span className="serif-italic">discoverable</span>
          </h2>
          <p>
            Industrial food supply chains have made it hard to know where our food actually comes from. Farmsy exists to make local food <strong style={{ color: 'var(--foreground)' }}>discoverable</strong>. We map every farm shop, pick-your-own field, roadside egg stand, and artisan producer we can find — and make that information freely available to anyone.
          </p>
          <p>
            We cover the <strong style={{ color: 'var(--foreground)' }}>Netherlands and Belgium</strong>, two countries with a rich tradition of small-scale farming and direct sales. Our database holds thousands of verified locations updated regularly from open-data sources.
          </p>
          <p>
            For farmers: listing your business is <strong style={{ color: 'var(--foreground)' }}>free</strong>. Claim your page and you can update your contact details, opening hours, and description directly.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="px-6 py-20" style={{ borderBottom: '1px solid oklch(0.9 0.008 80 / 0.6)' }}>
        <div className="mx-auto max-w-5xl">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>What we stand for</p>
          <h2 className="font-display mb-12 text-3xl font-medium tracking-[-0.02em]" style={{ color: 'var(--foreground)' }}>
            Our <span className="serif-italic">values</span>
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {VALUES.map(({ Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.1)' }}>
                  <Icon className="h-5 w-5" style={{ color: 'var(--primary)' }} strokeWidth={1.5} />
                </div>
                <h3 className="mb-2 font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data sources */}
      <section className="px-6 py-20" style={{ borderBottom: '1px solid oklch(0.9 0.008 80 / 0.6)' }}>
        <div className="mx-auto max-w-5xl">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>Transparency</p>
          <h2 className="font-display mb-3 text-3xl font-medium tracking-[-0.02em]" style={{ color: 'var(--foreground)' }}>
            Data <span className="serif-italic">sources</span>
          </h2>
          <p className="mb-12 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            We rely on open and attributed data. Below is a transparent breakdown of where our farm information comes from.
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {DATA_SOURCES.map(({ name, region, description, license }) => (
              <div key={name} className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>{region}</span>
                </div>
                <h3 className="mb-2 font-semibold" style={{ color: 'var(--foreground)' }}>{name}</h3>
                <p className="mb-4 text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{description}</p>
                <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)', opacity: 0.7 }}>{license}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 flex items-start gap-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Farm listings from OpenStreetMap are © OpenStreetMap contributors, available under the{' '}
            <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80">
              Open Database License
            </a>.
          </p>
        </div>
      </section>

      {/* Coverage */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>Where we are</p>
          <h2 className="font-display mb-10 text-3xl font-medium tracking-[-0.02em]" style={{ color: 'var(--foreground)' }}>
            <span className="serif-italic">Coverage</span>
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--primary)' }}>Netherlands 🇳🇱</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                Full coverage via OpenStreetMap. Includes farm shops, pick-your-own, roadside stands, honey producers, dairies, markets, and more.
              </p>
            </div>
            <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--primary)' }}>Belgium 🇧🇪</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                Coverage via OpenStreetMap, Foursquare, Overture Maps, and Traces — covering Flanders, Wallonia, and Brussels.
              </p>
            </div>
          </div>
        </div>
      </section>

    </ContentLayout>
  )
}
