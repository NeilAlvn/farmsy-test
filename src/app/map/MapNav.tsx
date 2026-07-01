'use client'

import { useState, useRef, useEffect, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  Search, X, SlidersHorizontal, Globe, ChevronDown, Check,
  Clock, Camera, MapPin, List, Map as MapIcon,
} from 'lucide-react'
import HeaderAuth from '@/app/_components/HeaderAuth'
import { useMapSearch } from './MapSearchContext'

const LANGUAGES = [
  { code: 'en', label: 'English'    },
  { code: 'nl', label: 'Nederlands' },
  { code: 'fr', label: 'Français'   },
  { code: 'de', label: 'Deutsch'    },
  { code: 'es', label: 'Español'    },
]

function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const current = LANGUAGES.find(l => l.code === locale) ?? LANGUAGES[0]

  function switchLocale(code: string) {
    document.cookie = `NEXT_LOCALE=${code};path=/;max-age=31536000;SameSite=Lax`
    setOpen(false)
    startTransition(() => router.refresh())
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
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="animate-dropdown absolute right-0 top-full z-[200] mt-2 w-40 overflow-hidden rounded-xl border border-border/60 bg-background shadow-[0_8px_24px_-8px_rgba(0,0,0,0.15)]">
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              type="button"
              onClick={() => switchLocale(l.code)}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs transition-colors hover:bg-border/30"
              style={{
                color:      l.code === locale ? 'var(--foreground)' : 'var(--muted-foreground)',
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

export default function MapNav() {
  const {
    farms,
    query, setQuery,
    selected, toggleCategory, clearCategories,
    filterOpenToday, setFilterOpenToday,
    filterHasPhotos, setFilterHasPhotos,
    availableCategories,
    totalFarms,
    view, setView,
    setFlyTarget,
  } = useMapSearch()

  const [filtersOpen,    setFiltersOpen]    = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef  = useRef<HTMLDivElement>(null)
  const filtersRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setFiltersOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const suggestions = useMemo(() => {
    if (query.trim().length < 2) return []
    const q = query.toLowerCase()
    return farms
      .filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.city?.toLowerCase().includes(q) ||
        f.address?.toLowerCase().includes(q),
      )
      .slice(0, 6)
  }, [farms, query])

  function handleSuggestionClick(farm: (typeof farms)[number]) {
    setQuery(farm.name)
    setShowSuggestions(false)
    setFlyTarget({ pos: [farm.lat, farm.lng], key: 0 }) // key is overwritten in context
    setView('map')
  }

  const activeFilterCount = selected.size
    + (filterOpenToday ? 1 : 0)
    + (filterHasPhotos ? 1 : 0)

  return (
    <header className="sticky top-0 z-[10000] border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">

        {/* Logo */}
        <Link
          href="/"
          className="shrink-0 font-display text-xl font-medium italic tracking-tight text-foreground sm:text-2xl"
        >
          Farmsy
        </Link>

        {/* Search bar */}
        <div ref={searchRef} className="relative min-w-0 flex-1">
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background px-4 py-2 shadow-sm focus-within:border-primary/40 transition-colors">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowSuggestions(true) }}
              onFocus={() => { if (query.trim().length >= 2) setShowSuggestions(true) }}
              placeholder="Search farms by name, city…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none min-w-0"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setShowSuggestions(false) }}
                className="shrink-0 rounded-full p-0.5 hover:bg-border/40 transition-colors"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}

            {/* Divider */}
            <div className="h-4 w-px shrink-0 bg-border/60" />

            {/* Filters button */}
            <div ref={filtersRef} className="relative">
              <button
                onClick={() => setFiltersOpen(o => !o)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeFilterCount > 0
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-border/30'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-foreground text-[10px] font-bold text-primary">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Filters dropdown */}
              {filtersOpen && (
                <div className="animate-dropdown absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-border/60 bg-background shadow-[0_8px_24px_-8px_rgba(0,0,0,0.15)]">
                  <div className="max-h-80 overflow-y-auto">

                    {/* All */}
                    <button
                      onClick={clearCategories}
                      className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs transition-colors hover:bg-border/30"
                      style={{
                        color:      selected.size === 0 && !filterOpenToday && !filterHasPhotos ? 'var(--foreground)' : 'var(--muted-foreground)',
                        fontWeight: selected.size === 0 && !filterOpenToday && !filterHasPhotos ? 600 : 400,
                      }}
                    >
                      <span>All</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-border/40 text-muted-foreground">
                        {totalFarms.toLocaleString('nl-NL')}
                      </span>
                    </button>

                    <div className="h-px bg-border/40 mx-3" />

                    {/* Categories */}
                    {availableCategories.map(cat => {
                      const active = selected.has(cat.id)
                      return (
                        <button
                          key={cat.id}
                          onClick={() => toggleCategory(cat.id)}
                          className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs transition-colors hover:bg-border/30"
                          style={{
                            color:      active ? 'var(--foreground)' : 'var(--muted-foreground)',
                            fontWeight: active ? 600 : 400,
                          }}
                        >
                          <span className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: cat.color }}>
                              <cat.Icon className="h-3 w-3 text-white" />
                            </span>
                            {cat.label}
                          </span>
                          {active && <Check className="h-3 w-3" style={{ color: cat.color }} />}
                        </button>
                      )
                    })}

                    <div className="h-px bg-border/40 mx-3" />

                    {/* Open today */}
                    <button
                      onClick={() => setFilterOpenToday(v => !v)}
                      className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs transition-colors hover:bg-border/30"
                      style={{
                        color:      filterOpenToday ? 'var(--foreground)' : 'var(--muted-foreground)',
                        fontWeight: filterOpenToday ? 600 : 400,
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-border/40">
                          <Clock className="h-3 w-3" />
                        </span>
                        Open today
                      </span>
                      {filterOpenToday && <Check className="h-3 w-3" style={{ color: 'var(--primary)' }} />}
                    </button>

                    {/* Has photos */}
                    <button
                      onClick={() => setFilterHasPhotos(v => !v)}
                      className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs transition-colors hover:bg-border/30"
                      style={{
                        color:      filterHasPhotos ? 'var(--foreground)' : 'var(--muted-foreground)',
                        fontWeight: filterHasPhotos ? 600 : 400,
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-border/40">
                          <Camera className="h-3 w-3" />
                        </span>
                        Has photos
                      </span>
                      {filterHasPhotos && <Check className="h-3 w-3" style={{ color: 'var(--primary)' }} />}
                    </button>

                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="animate-dropdown-left absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border/60 bg-background shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18)] py-1">
              {suggestions.map(farm => (
                <button
                  key={farm.osm_id ?? farm.id}
                  onMouseDown={e => { e.preventDefault(); handleSuggestionClick(farm) }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-border/20 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{farm.name}</p>
                    {farm.city && (
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{farm.city}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View toggle */}
        <button
          onClick={() => setView(v => v === 'map' ? 'list' : 'map')}
          className="hidden sm:flex shrink-0 items-center gap-1.5 rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
        >
          {view === 'map'
            ? <><List className="h-3.5 w-3.5" /> List</>
            : <><MapIcon className="h-3.5 w-3.5" /> Map</>
          }
        </button>

        {/* Right side */}
        <div className="flex shrink-0 items-center gap-2">
          <LanguageSwitcher />
          <HeaderAuth />
        </div>

      </div>
    </header>
  )
}
