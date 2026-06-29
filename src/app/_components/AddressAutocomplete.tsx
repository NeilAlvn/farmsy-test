'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, Loader2 } from 'lucide-react'

export interface ParsedAddress {
  streetAddress: string
  postalCode:    string
  city:          string
  country:       string
}

interface Feature {
  properties: {
    name?: string; housenumber?: string; street?: string
    postcode?: string; city?: string; town?: string; village?: string
    county?: string; state?: string; country?: string; countrycode?: string
  }
}

// Worldwide address autocomplete powered by Photon (photon.komoot.io), an
// open geocoder built on OpenStreetMap data. No API key required.
function formatLabel(p: Feature['properties']): string {
  const line1 = [p.name && p.name !== p.street ? p.name : null, p.street, p.housenumber]
    .filter(Boolean).join(' ')
  const line2 = [p.postcode, p.city || p.town || p.village || p.county, p.country]
    .filter(Boolean).join(', ')
  return [line1, line2].filter(Boolean).join(' · ')
}

function parse(p: Feature['properties']): ParsedAddress {
  return {
    streetAddress: [p.street || p.name, p.housenumber].filter(Boolean).join(' ').trim(),
    postalCode:    p.postcode ?? '',
    city:          p.city || p.town || p.village || p.county || '',
    country:       p.country ?? '',
  }
}

export default function AddressAutocomplete({
  inputCls, inputStyle, onSelect,
}: {
  inputCls:   string
  inputStyle: React.CSSProperties
  onSelect:   (address: ParsedAddress) => void
}) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<Feature[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const boxRef   = useRef<HTMLDivElement>(null)
  const timer    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Close the dropdown on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // Debounced lookup
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (query.trim().length < 3) { setResults([]); return }
    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res  = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=en`)
        const data = await res.json()
        const feats = (data.features as Feature[] ?? []).filter(f => f.properties.country)
        setResults(feats)
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [query])

  function pick(f: Feature) {
    onSelect(parse(f.properties))
    setQuery(formatLabel(f.properties))
    setResults([])
    setOpen(false)
  }

  return (
    <div className="relative" ref={boxRef}>
      <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => { if (results.length) setOpen(true) }}
        placeholder="Start typing your address…"
        autoComplete="off"
        className={`${inputCls} pr-9`}
        style={inputStyle}
      />
      {loading && (
        <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border shadow-lg" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
          {results.map((f, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => pick(f)}
                className="block w-full px-3.5 py-2.5 text-left text-xs transition-colors hover:bg-border/30"
                style={{ color: 'var(--foreground)' }}
              >
                {formatLabel(f.properties)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
