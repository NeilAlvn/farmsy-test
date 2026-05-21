import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import ContentLayout from '@/app/_components/ContentLayout'

export const metadata: Metadata = {
  title: 'FAQ – De Lokale Boer',
  description: 'Frequently asked questions about De Lokale Boer — finding local farms in the Netherlands and Belgium.',
}

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: 'How do I find farms near me?',
    a: (
      <>
        Open the{' '}
        <Link href="/map" className="text-emerald-600 hover:underline font-medium">interactive map</Link> and use the
        &ldquo;Locate me&rdquo; button (the crosshair icon in the search bar) to jump to your current location.
        You can also type a city name or postal code in the search box. The map will show all farms in the visible area —
        tap any pin to see details.
      </>
    ),
  },
  {
    q: 'Is De Lokale Boer free to use?',
    a: 'Yes — completely free for consumers. Finding farms, getting directions, checking opening hours, and browsing listings all cost nothing and require no account.',
  },
  {
    q: 'How do I claim my farm listing?',
    a: (
      <>
        Find your farm on the map and open its detail panel. Tap <strong>&ldquo;Claim this farm&rdquo;</strong> and
        sign in with your email. Once verified, you can update your contact details, opening hours, description, and
        more. Claiming is free and takes only a few minutes.
      </>
    ),
  },
  {
    q: 'What areas are covered?',
    a: 'We currently cover the Netherlands and Belgium. Dutch farms come primarily from OpenStreetMap data. Belgian farms come from both OpenStreetMap and JeCuisineLocal. We are working to improve coverage in both countries.',
  },
  {
    q: 'Where does the farm data come from?',
    a: (
      <>
        Our data comes from three sources:
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li><strong>OpenStreetMap</strong> — volunteer-contributed geographic data (Netherlands &amp; Belgium)</li>
          <li><strong>JeCuisineLocal</strong> — a Belgian platform for local producers</li>
          <li><strong>Google Places</strong> — used to enrich listings with phone numbers, websites, and photos</li>
        </ul>
        Listings show a small attribution note when data comes from JeCuisineLocal or Google Places.
      </>
    ),
  },
  {
    q: 'How often is the data updated?',
    a: (
      <>
        Data is regularly reviewed and updated by our team. The best way to ensure a listing stays current is for the
        farm owner to <strong>claim it</strong> — claimed listings can be edited directly at any time and changes
        appear immediately. If you spot something outdated,{' '}
        <Link href="/contact" className="text-emerald-600 hover:underline font-medium">let us know</Link> and we&apos;ll
        take a look.
      </>
    ),
  },
  {
    q: 'Can I suggest a farm to add?',
    a: (
      <>
        Yes —{' '}
        <Link href="/contact" className="text-emerald-600 hover:underline font-medium">contact us</Link> with the farm&apos;s
        name, location, and any details you have and we&apos;ll review it for addition. You can also add the farm to{' '}
        <a href="https://www.openstreetmap.org/edit" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline font-medium">
          OpenStreetMap
        </a>{' '}
        — open geographic data that we draw from when building our database.
      </>
    ),
  },
  {
    q: 'Why is my farm information wrong?',
    a: (
      <>
        If you own the farm, the fastest fix is to <strong>claim your listing</strong> — you can then edit everything
        directly. If you&apos;re a customer who spotted an error, please use the &ldquo;Report incorrect info&rdquo; link
        at the bottom of the farm detail panel, or{' '}
        <Link href="/contact" className="text-emerald-600 hover:underline font-medium">contact us</Link>.
      </>
    ),
  },
  {
    q: 'Is my personal data safe?',
    a: (
      <>
        We collect only what we need. Consumer visitors have no data collected beyond anonymous usage statistics.
        Account holders (farmers) have their email stored securely via Supabase Auth. See our{' '}
        <Link href="/privacy" className="text-emerald-600 hover:underline font-medium">Privacy Policy</Link> for full details.
      </>
    ),
  },
  {
    q: 'Do you have a mobile app?',
    a: 'Not yet — but our website is fully responsive and works well on mobile browsers. You can add it to your home screen for an app-like experience.',
  },
]

export default function FaqPage() {
  return (
    <ContentLayout>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white py-24 px-4 overflow-hidden relative">
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="max-w-3xl mx-auto relative">
          <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest mb-3">Help &amp; Support</p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6 leading-tight">
            Frequently asked questions
          </h1>
          <p className="text-emerald-100/80 text-lg leading-relaxed max-w-2xl mb-8">
            Everything you need to know about finding local farms and using De Lokale Boer.
          </p>
          <Link
            href="/map"
            className="inline-flex items-center gap-2 bg-white text-emerald-900 font-bold px-6 py-3 rounded-full hover:bg-emerald-50 transition-all shadow-lg"
          >
            Explore the map <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Questions ────────────────────────────────────────────── */}
      <div className="py-16 px-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {FAQS.map(({ q, a }, i) => (
            <details
              key={i}
              className="group bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
            >
              <summary className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none select-none hover:bg-gray-50 transition-colors">
                <span className="font-bold text-gray-900">{q}</span>
                <span className="shrink-0 w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 group-open:rotate-45 transition-transform duration-200 text-lg leading-none">
                  +
                </span>
              </summary>
              <div className="px-6 pb-6 pt-1 text-gray-600 leading-relaxed border-t border-gray-50">
                {a}
              </div>
            </details>
          ))}
        </div>
      </div>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <div className="py-16 px-4 bg-gray-50">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-3">Still have questions?</h2>
          <p className="text-gray-500 mb-6">
            We&apos;re happy to help. Send us a message and we&apos;ll get back to you within one business day.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-full transition-colors shadow-md shadow-emerald-600/20"
          >
            Contact us
          </Link>
        </div>
      </div>

    </ContentLayout>
  )
}
