import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ArrowRight } from 'lucide-react'
import ContentLayout from '@/app/_components/ContentLayout'

export const metadata: Metadata = {
  title: 'FAQ – Farmsy',
  description: 'Frequently asked questions about Farmsy — finding local farms in the Netherlands and Belgium.',
}

export default async function FaqPage() {
  const t = await getTranslations('faq')

  const linkClass = 'font-medium underline underline-offset-4'
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
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>
            {t('eyebrow')}
          </p>
          <h1 className="font-display text-5xl font-medium leading-[1.05] tracking-[-0.025em]" style={{ color: 'var(--foreground)' }}>
            {t('headline')}{' '}
            <span className="serif-italic" style={{ color: 'var(--primary)' }}>{t('headlineEmphasis')}</span>
          </h1>
          <p className="mt-5 text-lg leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            {t('subheading')}
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
            {t('ctaTitle')} <span className="serif-italic">{t('ctaTitleEmphasis')}</span>
          </h2>
          <p className="mt-4 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            {t('ctaSubtext')}
          </p>
          <Link
            href="/contact"
            className="mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition hover:opacity-90"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            {t('ctaButton')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

    </ContentLayout>
  )
}
