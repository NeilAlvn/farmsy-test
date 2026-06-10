'use client'

import Link from 'next/link'
import { useState, useRef, useEffect, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Globe, ChevronDown, Check } from 'lucide-react'
import HeaderAuth from './HeaderAuth'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
]

function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const currentLang = LANGUAGES.find(l => l.code === locale) ?? LANGUAGES[0]

  function switchLocale(code: string) {
    document.cookie = `NEXT_LOCALE=${code};path=/;max-age=31536000;SameSite=Lax`
    setOpen(false)
    startTransition(() => { router.refresh() })
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground disabled:opacity-60"
      >
        <Globe className="h-3.5 w-3.5" />
        <span>{currentLang.label}</span>
        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="animate-dropdown absolute right-0 top-full z-[200] mt-2 w-40 overflow-hidden rounded-xl border border-border/60 bg-background shadow-[0_8px_24px_-8px_rgba(0,0,0,0.15)]">
          {LANGUAGES.map(l => (
            <button
              type="button"
              key={l.code}
              onClick={() => switchLocale(l.code)}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs transition-colors hover:bg-border/30"
              style={{
                color: l.code === locale ? 'var(--foreground)' : 'var(--muted-foreground)',
                fontWeight: l.code === locale ? 600 : 400,
              }}
            >
              <span>{l.label}</span>
              {l.code === locale && <Check className="h-3 w-3" style={{ color: 'var(--primary)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SiteNav() {
  const t = useTranslations('nav')

  const NAV_LINKS = [
    { label: t('map'),     href: '/map' },
    { label: t('about'),   href: '/about' },
    { label: t('faq'),     href: '/faq' },
    { label: t('contact'), href: '/contact' },
  ]

  return (
    <header className="sticky top-0 z-[10000] border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        {/* Logo */}
        <Link
          href="/"
          className="shrink-0 font-display text-2xl font-medium italic tracking-tight text-foreground"
        >
          Farmsy
        </Link>

        {/* Page links */}
        <nav className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </Link>
          ))}
          <Link
            href="/farmers"
            className="text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: 'var(--primary)' }}
          >
            {t('forFarmers')}
          </Link>
        </nav>

        {/* Right — shrink-0 + whitespace-nowrap prevents layout shift on language switch */}
        <div className="flex shrink-0 items-center gap-3">
          <LanguageSwitcher />
          <HeaderAuth />
          <span className="hidden shrink-0 items-center gap-2 whitespace-nowrap text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground sm:inline-flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            {t('comingSoon')}
          </span>
        </div>
      </div>
    </header>
  )
}
