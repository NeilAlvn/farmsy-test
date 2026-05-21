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
    description:
      'The open geographic database that powers our core farm locations, addresses, and opening hours. Data contributed by thousands of volunteers worldwide.',
    license: 'Open Database License (ODbL)',
    color: 'bg-blue-50 border-blue-100',
    dot: 'bg-blue-500',
  },
  {
    name: 'Google Places',
    region: 'Enrichment',
    description:
      'Used to enrich existing listings with additional business details such as phone numbers, websites, descriptions, and photos.',
    license: 'Google Maps Platform Terms',
    color: 'bg-red-50 border-red-100',
    dot: 'bg-red-500',
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
    desc: 'Farmers can claim their listing for free and keep their own information accurate, hours, and contact details.',
  },
  {
    Icon: Database,
    title: 'Transparent sources',
    desc: 'We clearly attribute every data source — OpenStreetMap, Foursquare, and Overture Maps — on every listing where it applies.',
  },
]

export default function AboutPage() {
  return (
    <ContentLayout>

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white py-24 px-4 overflow-hidden relative">
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="max-w-3xl mx-auto relative">
          <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest mb-3">About us</p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6 leading-tight">
            Connecting people with<br className="hidden sm:block" /> the farmers who feed them
          </h1>
          <p className="text-emerald-100/80 text-lg leading-relaxed max-w-2xl mb-8">
            Farmsy is a free map of local farms, roadside stands, and direct-to-consumer food producers in
            the Netherlands and Belgium. No sign-up needed — just open the map and find fresh food near you.
          </p>
          <Link
            href="/map"
            className="inline-flex items-center gap-2 bg-white text-emerald-900 font-bold px-6 py-3 rounded-full hover:bg-emerald-50 transition-all shadow-lg"
          >
            Explore the map <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Mission ───────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-3xl mx-auto space-y-6 text-gray-600 leading-relaxed text-lg">
          <h2 className="text-3xl font-extrabold text-gray-900">Our mission</h2>
          <p>
            Industrial food supply chains have made it hard to know where our food actually comes from. Farmsy
            exists to make local food <strong className="text-gray-800">discoverable</strong>. We map every farm shop,
            pick-your-own field, roadside egg stand, and artisan producer we can find — and make that information
            freely available to anyone.
          </p>
          <p>
            We cover the <strong className="text-gray-800">Netherlands and Belgium</strong>, two countries with a rich
            tradition of small-scale farming and direct sales. Our database holds thousands of verified locations and
            is updated regularly from open-data sources.
          </p>
          <p>
            For farmers: listing your business is <strong className="text-gray-800">free</strong>. Claim your page and
            you can update your contact details, opening hours, and description directly.
          </p>
        </div>
      </section>

      {/* ── Values ────────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-12">What we stand for</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {VALUES.map(({ Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center mb-5 shadow-lg shadow-emerald-600/20">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-8">How it works</h2>
          <ol className="space-y-6">
            {[
              {
                n: '1',
                title: 'We aggregate open data',
                body: 'We pull farm and producer locations from OpenStreetMap, Foursquare, and Overture Maps, normalise the data, and load it into our database.',
              },
              {
                n: '2',
                title: 'We enrich listings',
                body: 'Where public data is thin, we use the Google Places API to fill in missing phone numbers, websites, and photos — always attributed transparently.',
              },
              {
                n: '3',
                title: 'Farmers keep their own data',
                body: 'Any farmer can claim their listing and edit it directly. Claimed listings are marked and kept up to date by the farmers themselves.',
              },
              {
                n: '4',
                title: 'You find fresh food nearby',
                body: 'Use the map or search to find farms by location or category. Get directions, check opening hours, and visit.',
              },
            ].map(({ n, title, body }) => (
              <li key={n} className="flex gap-5">
                <span className="shrink-0 w-9 h-9 rounded-full bg-emerald-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-emerald-600/30">
                  {n}
                </span>
                <div>
                  <p className="font-bold text-gray-900 mb-1">{title}</p>
                  <p className="text-gray-500 leading-relaxed">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Data sources ──────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-3">Data sources</h2>
          <p className="text-gray-500 mb-10 max-w-2xl">
            We rely on open and attributed data. Below is a transparent breakdown of where our farm information comes from.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {DATA_SOURCES.map(({ name, region, description, license, color, dot }) => (
              <div key={name} className={`rounded-3xl p-6 border ${color}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{region}</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{name}</h3>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">{description}</p>
                <p className="text-xs text-gray-400 font-medium">{license}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-gray-400 flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Farm listings from OpenStreetMap are &copy; OpenStreetMap contributors, available under the{' '}
            <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
              Open Database License
            </a>.
          </p>
        </div>
      </section>

      {/* ── Coverage ──────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-6">Coverage</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="rounded-3xl bg-orange-50 border border-orange-100 p-6">
              <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2">Netherlands 🇳🇱</p>
              <p className="text-gray-700 leading-relaxed">
                Full coverage via OpenStreetMap. Includes farm shops, pick-your-own, roadside stands, honey producers,
                dairies, markets, and more.
              </p>
            </div>
            <div className="rounded-3xl bg-yellow-50 border border-yellow-100 p-6">
              <p className="text-xs font-bold text-yellow-700 uppercase tracking-widest mb-2">Belgium 🇧🇪</p>
              <p className="text-gray-700 leading-relaxed">
                Coverage via OpenStreetMap, Foursquare, and Overture Maps — covering Flanders,
                Wallonia, and Brussels.
              </p>
            </div>
          </div>
        </div>
      </section>

    </ContentLayout>
  )
}
