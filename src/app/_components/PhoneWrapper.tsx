'use client'

import dynamic from 'next/dynamic'
import { Search } from 'lucide-react'
import { useState, useEffect, type CSSProperties } from 'react'

// ─── Dimensions ───────────────────────────────────────────────────────────────

const PHONE_W  = 260
const PHONE_H  = 560
const BEZEL    = 3
const SCREEN_W = PHONE_W - BEZEL * 2  // 254
const SCREEN_H = PHONE_H - BEZEL * 2  // 554
const SB_H     = 50   // status bar (includes Dynamic Island)
const HEADER_H = 38   // app header
const SEARCH_H = 44   // search bar row
const HOME_H   = 10   // home indicator row
const MAP_H    = SCREEN_H - SB_H - HEADER_H - SEARCH_H - HOME_H  // 412

// ─── Dynamic Leaflet import (SSR-safe) ────────────────────────────────────────

const LeafletPhoneMap = dynamic(() => import('./LeafletPhoneMap'), {
  ssr: false,
  loading: () => (
    <div style={{ height: MAP_H, width: '100%', background: 'oklch(0.985 0.005 85)' }} />
  ),
})

// ─── Floating cards ───────────────────────────────────────────────────────────

const FLOAT_CARDS: Array<{
  emoji: string
  label: string
  pos: CSSProperties
  delay: string
}> = [
  { emoji: '🌱', label: 'Organic',       pos: { top: 60,  left: -122 }, delay: '0s'   },
  { emoji: '✓',  label: 'Verified',      pos: { top: 90,  right: -116 }, delay: '1.1s' },
  { emoji: '📍', label: 'Near You',      pos: { top: 215, left: -122 }, delay: '0.5s' },
  { emoji: '🥕', label: 'Fresh Produce', pos: { top: 245, right: -116 }, delay: '1.7s' },
  { emoji: '🐄', label: 'Dairy & Meat',  pos: { top: 430, left: -122 }, delay: '0.9s' },
  { emoji: '🌾', label: 'Farm Shop',     pos: { top: 460, right: -116 }, delay: '2.2s' },
]

// ─── Component ────────────────────────────────────────────────────────────────

function useLiveClock() {
  const [time, setTime] = useState('')  // empty on server — avoids SSR/client mismatch
  useEffect(() => {
    const fmt = () => {
      const n = new Date()
      return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
    }
    setTime(fmt())
    const msToNext = (60 - new Date().getSeconds()) * 1000
    const t = setTimeout(() => {
      setTime(fmt())
      const iv = setInterval(() => setTime(fmt()), 60000)
      return () => clearInterval(iv)
    }, msToNext)
    return () => clearTimeout(t)
  }, [])
  return time
}

export default function PhoneWrapper() {
  const time = useLiveClock()
  return (
    <div style={{ position: 'relative', width: PHONE_W, height: PHONE_H + 40 }}>

      {/* Floating cards — lg+ only */}
      <div className="hidden lg:block">
        {FLOAT_CARDS.map(({ emoji, label, pos, delay }) => (
          <div
            key={label}
            style={{
              position: 'absolute',
              ...pos,
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 20px oklch(0.18 0.01 60 / 0.1)',
              animation: `farmFloat 3s ease-in-out infinite`,
              animationDelay: delay,
              zIndex: 10,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: 16 }}>{emoji}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Phone shell ──────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 0,
          width: PHONE_W,
          height: PHONE_H,
          background: '#111111',
          borderRadius: 44,
          boxShadow: `
            0 0 0 ${BEZEL}px #2a2a2a,
            0 0 0 ${BEZEL + 1}px #0a0a0a,
            0 32px 80px rgba(0,0,0,0.35),
            0 8px 32px rgba(0,0,0,0.2)
          `,
          overflow: 'hidden',
        }}
      >
        {/* Side buttons */}
        <div style={{ position: 'absolute', left: -3, top: 110, width: 3, height: 32, background: '#2a2a2a', borderRadius: '2px 0 0 2px' }} />
        <div style={{ position: 'absolute', left: -3, top: 150, width: 3, height: 52, background: '#2a2a2a', borderRadius: '2px 0 0 2px' }} />
        <div style={{ position: 'absolute', left: -3, top: 208, width: 3, height: 52, background: '#2a2a2a', borderRadius: '2px 0 0 2px' }} />
        <div style={{ position: 'absolute', right: -3, top: 140, width: 3, height: 72, background: '#2a2a2a', borderRadius: '0 2px 2px 0' }} />

        {/* ── Screen ─────────────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            top: BEZEL,
            left: BEZEL,
            width: SCREEN_W,
            height: SCREEN_H,
            background: 'oklch(0.985 0.005 85)',
            borderRadius: 41,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Status bar */}
          <div
            style={{
              height: SB_H,
              background: 'oklch(0.985 0.005 85)',
              display: 'flex',
              alignItems: 'flex-end',
              paddingBottom: 8,
              paddingLeft: 16,
              paddingRight: 16,
              flexShrink: 0,
              position: 'relative',
            }}
          >
            {/* Dynamic Island */}
            <div
              style={{
                position: 'absolute',
                top: 10,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 118,
                height: 32,
                background: '#111111',
                borderRadius: 20,
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0F0F0F', letterSpacing: '-0.02em', minWidth: 28 }} suppressHydrationWarning>
              {time}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
              <SignalIcon />
              <WifiIcon />
              <BatteryIcon />
            </div>
          </div>

          {/* App header */}
          <div
            style={{
              height: HEADER_H,
              paddingLeft: 16,
              paddingRight: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              borderBottom: '1px solid oklch(0.9 0.008 80 / 0.5)',
            }}
          >
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#0F0F0F',
                fontStyle: 'italic',
                letterSpacing: '-0.02em',
                fontFamily: 'Georgia, serif',
              }}
            >
              Farmsy
            </span>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 10,
                backgroundColor: 'oklch(0.36 0.07 145 / 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Search style={{ width: 14, height: 14, color: '#3F5E3A' }} />
            </div>
          </div>

          {/* Search bar */}
          <div
            style={{
              height: SEARCH_H,
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                height: '100%',
                backgroundColor: 'oklch(0.94 0.025 85)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                paddingLeft: 12,
                paddingRight: 12,
              }}
            >
              <Search style={{ width: 13, height: 13, color: '#9a9a9a', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#9a9a9a', letterSpacing: '-0.01em' }}>
                Find farms near you...
              </span>
            </div>
          </div>

          {/* Map — takes remaining space */}
          <div style={{ height: MAP_H, overflow: 'hidden', flexShrink: 0 }}>
            <LeafletPhoneMap height={MAP_H} />
          </div>

          {/* Home indicator */}
          <div
            style={{
              height: HOME_H,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'oklch(0.985 0.005 85)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 90,
                height: 4,
                background: '#111111',
                borderRadius: 4,
                opacity: 0.2,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── iOS-style status bar icons ───────────────────────────────────────────────

function SignalIcon() {
  // iOS 17 cellular signal: 4 rounded bars, 3 full + 1 faded
  return (
    <svg width="17" height="12" viewBox="0 0 17 12" fill="#0F0F0F">
      <rect x="0"  y="8"  width="3" height="4"  rx="1" />
      <rect x="4.5" y="5.5" width="3" height="6.5" rx="1" />
      <rect x="9"  y="3"  width="3" height="9"  rx="1" />
      <rect x="13.5" y="0" width="3" height="12" rx="1" opacity="0.28" />
    </svg>
  )
}

function WifiIcon() {
  return (
    <svg width="16" height="11" viewBox="0 3.8 14 8.2" fill="none" stroke="#0F0F0F" strokeLinecap="round">
      <path d="M5.23 9.23 A2.5 2.5 0 0 1 8.77 9.23"  strokeWidth="1.4" />
      <path d="M3.82 7.82 A4.5 4.5 0 0 1 10.18 7.82" strokeWidth="1.4" />
      <path d="M2.40 6.40 A6.5 6.5 0 0 1 11.60 6.40" strokeWidth="1.4" />
      <circle cx="7" cy="11" r="0.9" fill="#0F0F0F" stroke="none" />
    </svg>
  )
}

function BatteryIcon() {
  // iOS 17 battery: outline + nub + green fill ~80%
  return (
    <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
      <rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="#0F0F0F" strokeOpacity="0.35" strokeWidth="1" />
      <rect x="22.5" y="3.8" width="2" height="4.4" rx="1" fill="#0F0F0F" fillOpacity="0.4" />
      <rect x="2" y="2" width="15" height="8" rx="2.5" fill="#3F5E3A" />
    </svg>
  )
}
