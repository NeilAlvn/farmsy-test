import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import ContentLayout from '@/app/_components/ContentLayout'

export const metadata: Metadata = {
  title: 'FAQ – Farmsy',
  description: 'Frequently asked questions about Farmsy — finding local farms in the Netherlands and Belgium.',
}

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: 'How do I find farms near me?',
    a: (
      <>
        Open the{' '}
        <Link href="/map" className="font-medium underline underline-offset-4" style={{ color: 'var(--primary)' }}>
          interactive map
        </Link>{' '}
        and use the "Locate me" button (crosshair icon) to jump to your location. You can also type a city or postal code. Tap any pin to see farm details.
      </>
    ),
  },
  {
    q: 'Is Farmsy free to use?',
    a: (
      <>
        Browsing the full farm map requires a Farmsy Premium subscription (€4.99/month or €29.99/year). Every new account gets a <strong>3-day free trial</strong> — your card is collected upfront but not charged until day 3. Cancel before then and you won't be billed. Claiming your farm listing is always free.
      </>
    ),
  },
  {
    q: 'How do I claim my farm listing?',
    a: (
      <>
        Find your farm on the map and open its detail panel. Tap <strong>"Claim this farm"</strong> and sign in with your email. Once verified, you can update your contact details, opening hours, description, and more. Claiming is free.
      </>
    ),
  },
  {
    q: 'What areas are covered?',
    a: 'We currently cover the Netherlands and Belgium. Listings come from OpenStreetMap, Foursquare, Overture Maps, and Traces. We are continuously improving coverage in both countries.',
  },
  {
    q: 'Where does the farm data come from?',
    a: (
      <>
        Our data is built from four sources: <strong>OpenStreetMap</strong>, <strong>Foursquare</strong>, <strong>Overture Maps</strong>, and <strong>Traces</strong>. Phone numbers, websites, photos, and locations are combined from all four for the most complete picture possible.
      </>
    ),
  },
  {
    q: 'How often is the data updated?',
    a: (
      <>
        Data is regularly reviewed by our team. The best way to keep a listing current is for the farm owner to claim it — claimed listings can be edited directly and changes appear immediately. If you spot something outdated,{' '}
        <Link href="/contact" className="font-medium underline underline-offset-4" style={{ color: 'var(--primary)' }}>
          let us know
        </Link>.
      </>
    ),
  },
  {
    q: 'Can I suggest a farm to add?',
    a: (
      <>
        Yes —{' '}
        <Link href="/contact" className="font-medium underline underline-offset-4" style={{ color: 'var(--primary)' }}>
          contact us
        </Link>{' '}
        with the farm's name and location and we'll review it. You can also add it to{' '}
        <a href="https://www.openstreetmap.org/edit" target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4" style={{ color: 'var(--primary)' }}>
          OpenStreetMap
        </a>{' '}
        — open geographic data we draw from when building our database.
      </>
    ),
  },
  {
    q: 'Why is my farm information wrong?',
    a: (
      <>
        If you own the farm, the fastest fix is to <strong>claim your listing</strong> — you can then edit everything directly. If you're a visitor who spotted an error, use the "Report incorrect info" link at the bottom of the farm detail panel, or{' '}
        <Link href="/contact" className="font-medium underline underline-offset-4" style={{ color: 'var(--primary)' }}>
          contact us
        </Link>.
      </>
    ),
  },
  {
    q: 'Is my personal data safe?',
    a: (
      <>
        We collect only what we need. Visitors have no personal data collected beyond anonymous analytics. Account holders have their email stored securely via Supabase Auth. See our{' '}
        <Link href="/privacy" className="font-medium underline underline-offset-4" style={{ color: 'var(--primary)' }}>
          Privacy Policy
        </Link>{' '}
        for full details.
      </>
    ),
  },
  {
    q: 'Do you have a mobile app?',
    a: 'Not yet — but our website is fully responsive and works great on mobile. You can add it to your home screen for an app-like experience. A native app is on our roadmap.',
  },
]

export default function FaqPage() {
  return (
    <ContentLayout>

      {/* Page header */}
      <section className="px-6 pt-20 pb-16" style={{ borderBottom: '1px solid oklch(0.9 0.008 80 / 0.6)' }}>
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>
            Help &amp; Support
          </p>
          <h1 className="font-display text-5xl font-medium leading-[1.05] tracking-[-0.025em]" style={{ color: 'var(--foreground)' }}>
            Frequently asked{' '}
            <span className="serif-italic" style={{ color: 'var(--primary)' }}>questions</span>
          </h1>
          <p className="mt-5 text-lg leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            Everything you need to know about finding local farms and using Farmsy.
          </p>
        </div>
      </section>

      {/* Questions */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl space-y-3">
          {FAQS.map(({ q, a }, i) => (
            <details
              key={i}
              className="group overflow-hidden rounded-2xl border"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
            >
              <summary className="flex cursor-pointer list-none select-none items-center justify-between gap-4 px-6 py-5 transition-colors hover:opacity-80">
                <span className="font-medium leading-snug" style={{ color: 'var(--foreground)' }}>{q}</span>
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-lg leading-none transition-transform duration-200 group-open:rotate-45"
                  style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                  aria-hidden
                >
                  +
                </span>
              </summary>
              <div className="border-t px-6 pb-6 pt-4 text-sm leading-relaxed" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
                {a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20" style={{ borderTop: '1px solid oklch(0.9 0.008 80 / 0.6)' }}>
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-display text-3xl font-medium tracking-[-0.02em]" style={{ color: 'var(--foreground)' }}>
            Still have <span className="serif-italic">questions?</span>
          </h2>
          <p className="mt-4 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            We're happy to help. Send us a message and we'll get back to you within one business day.
          </p>
          <Link
            href="/contact"
            className="mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition hover:opacity-90"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            Contact us <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

    </ContentLayout>
  )
}
