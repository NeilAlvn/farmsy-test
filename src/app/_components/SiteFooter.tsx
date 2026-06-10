'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.4a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.83z" />
    </svg>
  )
}

export default function SiteFooter() {
  const t = useTranslations('footer')

  return (
    <footer className="border-t border-border/60 px-6 pt-20 pb-10" style={{ backgroundColor: 'var(--card)' }}>
      <div className="mx-auto max-w-6xl">

        <div className="grid grid-cols-2 gap-12 lg:grid-cols-[1.6fr_1fr_1fr_1.8fr] lg:gap-16">

          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="font-display text-2xl font-medium italic tracking-tight text-foreground">
              Farmsy
            </Link>
            <p className="mt-4 max-w-[200px] text-sm leading-relaxed text-muted-foreground">
              {t('brandDesc')}
            </p>
            <div className="mt-6 flex items-center gap-4">
              <a
                href="https://www.instagram.com/farmsy.app"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary/40 hover:text-primary"
              >
                <InstagramIcon className="h-3.5 w-3.5" />
              </a>
              <a
                href="https://www.tiktok.com/@farmsy.app"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary/40 hover:text-primary"
              >
                <TikTokIcon className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* Platform */}
          <div>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-foreground">
              {t('platform')}
            </p>
            <ul className="space-y-3.5 text-sm">
              {([
                { key: 'map',     href: '/map' },
                { key: 'aboutUs', href: '/about' },
                { key: 'helpFaq', href: '/faq' },
              ] as const).map(({ key, href }) => (
                <li key={href}>
                  <Link href={href} className="text-muted-foreground transition-colors hover:text-foreground">
                    {t(key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-foreground">
              {t('legal')}
            </p>
            <ul className="space-y-3.5 text-sm">
              {([
                { key: 'privacyPolicy', href: '/privacy' },
                { key: 'terms',         href: '/terms' },
                { key: 'contact',       href: '/contact' },
              ] as const).map(({ key, href }) => (
                <li key={href}>
                  <Link href={href} className="text-muted-foreground transition-colors hover:text-foreground">
                    {t(key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* For Farmers */}
          <div
            className="col-span-2 rounded-2xl border border-border p-7 lg:col-span-1"
            style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.06)' }}
          >
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.12)', color: 'var(--primary)' }}
            >
              {t('forFarmers')}
            </span>
            <h3 className="mt-4 font-display text-xl font-medium leading-snug tracking-tight text-foreground">
              {t('forFarmersTagline')}
            </h3>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
              {t('forFarmersDesc')}
            </p>
            <Link
              href="/farmers"
              className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {t('claimListing')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-8 sm:flex-row">
          <p className="text-xs text-muted-foreground">{t('copyright')}</p>
          <div className="flex items-center gap-5 text-xs text-muted-foreground">
            <Link href="/privacy" className="transition hover:text-foreground">{t('privacy')}</Link>
            <Link href="/terms" className="transition hover:text-foreground">{t('terms')}</Link>
          </div>
        </div>

      </div>
    </footer>
  )
}
