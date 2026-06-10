'use client'

import dynamic from 'next/dynamic'
import { Search } from 'lucide-react'
import type { CSSProperties } from 'react'

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

export default function PhoneWrapper() {
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
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0F0F0F', letterSpacing: '-0.02em' }}>
              15:40
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

// ─── Status bar icons ─────────────────────────────────────────────────────────

function SignalIcon() {
  return (
    <svg width="15" height="11" viewBox="0 0 15 11" fill="#0F0F0F">
      <rect x="0" y="7" width="3" height="4" rx="0.5" />
      <rect x="4" y="5" width="3" height="6" rx="0.5" />
      <rect x="8" y="3" width="3" height="8" rx="0.5" />
      <rect x="12" y="0" width="3" height="11" rx="0.5" opacity="0.3" />
    </svg>
  )
}

function WifiIcon() {
  return (
    <svg
      width="16"
      height="12"
      viewBox="0 0 16 12"
      fill="none"
      stroke="#0F0F0F"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M1 4.5C3.9 1.8 8 1.5 11.5 3M3.5 7C5.5 5.2 8 5 10 6.5M6.5 9.5C7.2 9 8 9 8.5 9.5" />
      <circle cx="8" cy="11" r="0.7" fill="#0F0F0F" stroke="none" />
    </svg>
  )
}

function BatteryIcon() {
  return (
    <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
      <rect x="0.5" y="0.5" width="20" height="11" rx="3" stroke="#0F0F0F" strokeOpacity="0.5" />
      <rect x="21.5" y="3.5" width="2" height="5" rx="1" fill="#0F0F0F" fillOpacity="0.4" />
      <rect x="2" y="2" width="14" height="8" rx="2" fill="#3F5E3A" />
    </svg>
  )
}
