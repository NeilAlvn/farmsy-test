import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ArrowRight, ImageIcon } from 'lucide-react'
import ContentLayout from '@/app/_components/ContentLayout'
import FaqQuickCards from './FaqQuickCards'

export const metadata: Metadata = {
  title: 'FAQ – Farmsy',
  description: 'Frequently asked questions about Farmsy — finding local farms in the Netherlands and Belgium.',
}

export default async function FaqPage() {
  const t = await getTranslations('faq')

  const linkClass = 'font-medium underline underline-offset-4 hover:opacity-70 transition-opacity'
  const linkStyle = { color: 'var(--primary)' }

  const FAQS = [
    {
      q: t('q1'),
      a: t.rich('a1', {
        mapLink: (c) => <Link href="/map" className={linkClass} style={linkStyle}>{c}</Link>,
      }),
    },
    {
      q: t('q2'),
      a: t.rich('a2', { b: (c) => <strong>{c}</strong> }),
    },
    {
      q: t('q3'),
      a: t.rich('a3', { b: (c) => <strong>{c}</strong> }),
    },
    { q: t('q4'), a: t('a4') },
    {
      q: t('q5'),
      a: t.rich('a5', { b: (c) => <strong>{c}</strong> }),
    },
    {
      q: t('q6'),
      a: t.rich('a6', {
        contactLink: (c) => <Link href="/contact" className={linkClass} style={linkStyle}>{c}</Link>,
      }),
    },
    {
      q: t('q7'),
      a: t.rich('a7', {
        contactLink: (c) => <Link href="/contact" className={linkClass} style={linkStyle}>{c}</Link>,
        osmLink:     (c) => <a href="https://www.openstreetmap.org/edit" target="_blank" rel="noopener noreferrer" className={linkClass} style={linkStyle}>{c}</a>,
      }),
    },
    {
      q: t('q8'),
      a: t.rich('a8', {
        b:           (c) => <strong>{c}</strong>,
        contactLink: (c) => <Link href="/contact" className={linkClass} style={linkStyle}>{c}</Link>,
      }),
    },
    {
      q: t('q9'),
      a: t.rich('a9', {
        privacyLink: (c) => <Link href="/privacy" className={linkClass} style={linkStyle}>{c}</Link>,
      }),
    },
    { q: t('q10'), a: t('a10') },
  ]

  return (
    <ContentLayout>

      {/* Page header */}
      <section className="px-6 pt-20 pb-16" style={{ borderBottom: '1px solid oklch(0.9 0.008 80 / 0.6)' }}>
        <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_0.8fr] gap-12 items-start">
          <div>
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>
              {t('eyebrow')}
            </p>
            <h1 className="font-display text-5xl font-medium leading-[1.05] tracking-[-0.025em]" style={{ color: 'var(--foreground)' }}>
              {t('headline')}{' '}
              <span className="serif-italic" style={{ color: 'var(--primary)' }}>{t('headlineEmphasis')}</span>
            </h1>
            <p className="mt-5 text-lg leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              Everything you need to know about finding local farms, exploring the map, managing your subscription, and getting your farm listed on Farmsy. Can't find your answer here? Our team is always happy to help — just reach out via the contact page.
            </p>
          </div>
          <div className="relative aspect-[4/3] hidden lg:flex items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed" style={{ borderColor: 'var(--border)' }}>
            <div className="flex flex-col items-center gap-2" style={{ color: 'var(--muted-foreground)' }}>
              <ImageIcon className="h-8 w-8 opacity-30" />
              <span className="text-xs opacity-40">Image placeholder</span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick answers */}
      <section className="px-6 py-12" style={{ borderBottom: '1px solid oklch(0.9 0.008 80 / 0.6)', backgroundColor: 'oklch(0.36 0.07 145 / 0.03)' }}>
        <div className="mx-auto max-w-5xl">
          <FaqQuickCards />
        </div>
      </section>

      {/* Mid-page visual break */}
      <section className="px-6 py-16" style={{ borderBottom: '1px solid oklch(0.9 0.008 80 / 0.6)' }}>
        <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-10 items-start">
          <div className="relative aspect-[4/3] flex items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed" style={{ borderColor: 'var(--border)' }}>
            <div className="flex flex-col items-center gap-2" style={{ color: 'var(--muted-foreground)' }}>
              <ImageIcon className="h-8 w-8 opacity-30" />
              <span className="text-xs opacity-40">Image placeholder</span>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>Still have questions?</p>
            <h2 className="font-display text-3xl font-medium leading-[1.1] tracking-[-0.02em]" style={{ color: 'var(--foreground)' }}>
              Can't find what you're <span className="serif-italic">looking for?</span>
            </h2>
            <p className="text-base leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              Our team reads every message and we typically get back to you within one business day. Whether it's a technical question, a data issue, or just feedback — we want to hear it.
            </p>
            <Link
              href="/contact"
              className="mt-2 inline-flex w-fit items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              Contact us <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Questions */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>All questions</p>
          <h2 className="font-display mb-10 text-2xl font-medium tracking-[-0.02em]" style={{ color: 'var(--foreground)' }}>
            Browse by topic
          </h2>
          <div className="space-y-3">
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
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20" style={{ borderTop: '1px solid oklch(0.9 0.008 80 / 0.6)' }}>
        <div className="mx-auto max-w-5xl">
          <div
            className="flex flex-col items-start gap-6 rounded-2xl border p-8 sm:flex-row sm:items-center"
            style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.06)', borderColor: 'var(--primary)' }}
          >
            <div className="flex-1">
              <h2 className="font-display text-2xl font-medium tracking-[-0.02em]" style={{ color: 'var(--foreground)' }}>
                {t('ctaTitle')} <span className="serif-italic">{t('ctaTitleEmphasis')}</span>
              </h2>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                {t('ctaSubtext')}
              </p>
            </div>
            <Link
              href="/contact"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              {t('ctaButton')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

    </ContentLayout>
  )
}
