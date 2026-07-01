'use client'

import Link from 'next/link'
import { useState, useRef, useEffect, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Globe, ChevronDown, Check, Menu, X } from 'lucide-react'
import HeaderAuth from './HeaderAuth'
import MapGateLink from './MapGateLink'
import NotificationBell from './NotificationBell'

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
        <span className="hidden sm:inline">{currentLang.label}</span>
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
  const [mobileOpen, setMobileOpen] = useState(false)

  const NAV_LINKS = [
    { label: t('map'),     href: '/map' },
    { label: t('about'),   href: '/about' },
    { label: t('faq'),     href: '/faq' },
  ]

  // Close the mobile panel on Escape.
  useEffect(() => {
    if (!mobileOpen) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setMobileOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  return (
    <header className="sticky top-0 z-[10000] border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-4 sm:gap-6 sm:px-6">
        {/* Logo */}
        <Link
          href="/"
          className="shrink-0 font-display text-2xl font-medium italic tracking-tight text-foreground"
        >
          Farmsy
        </Link>

        {/* Page links — centered (desktop) */}
        <nav className="hidden items-center justify-center gap-6 lg:flex">
          {NAV_LINKS.map(({ label, href }) => (
            href === '/map' ? (
              <MapGateLink
                key={href}
                href={href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {label}
              </MapGateLink>
            ) : (
              <Link
                key={href}
                href={href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {label}
              </Link>
            )
          ))}
          <Link
            href="/farmers"
            className="text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: 'var(--primary)' }}
          >
            {t('forFarmers')}
          </Link>
        </nav>

        {/* Right */}
        <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3">
          <LanguageSwitcher />
          <NotificationBell />
          <HeaderAuth />
          {/* Hamburger — only below the desktop nav breakpoint */}
          <button
            type="button"
            onClick={() => setMobileOpen(o => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 text-foreground transition hover:border-border lg:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {mobileOpen && (
        <>
          {/* Backdrop closes the menu on outside tap */}
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 top-[65px] z-40 bg-black/20 lg:hidden"
          />
          <nav className="animate-dropdown absolute left-0 right-0 top-full z-50 border-b border-border/60 bg-background px-4 py-3 shadow-[0_12px_28px_-12px_rgba(0,0,0,0.18)] lg:hidden">
            <div className="mx-auto flex max-w-6xl flex-col gap-0.5">
              {NAV_LINKS.map(({ label, href }) => (
                href === '/map' ? (
                  <MapGateLink
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-border/30"
                  >
                    {label}
                  </MapGateLink>
                ) : (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-border/30"
                  >
                    {label}
                  </Link>
                )
              ))}
              <Link
                href="/farmers"
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-semibold transition-colors hover:bg-border/30"
                style={{ color: 'var(--primary)' }}
              >
                {t('forFarmers')}
              </Link>
            </div>
          </nav>
        </>
      )}
    </header>
  )
}
