import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#F5F3EE',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          fontFamily: 'Georgia, serif',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 24,
            background: '#3F5E3A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="60" height="60" viewBox="0 0 20 20" fill="none">
            <path d="M10 17 L10 9" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M10 12 C10 12 6 11 5 8 C5 8 8 7 10 10" fill="white" />
            <path d="M10 9 C10 9 14 8 15 5 C15 5 12 4 10 7" fill="white" />
          </svg>
        </div>

        {/* Wordmark */}
        <div
          style={{
            fontSize: 112,
            fontWeight: 700,
            color: '#3F5E3A',
            letterSpacing: '-4px',
            fontStyle: 'italic',
            lineHeight: 1,
          }}
        >
          Farmsy
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 32,
            color: '#6B7B6A',
            letterSpacing: '-0.5px',
            fontStyle: 'normal',
            fontWeight: 400,
          }}
        >
          Discover local farms across the Netherlands &amp; Belgium
        </div>
      </div>
    ),
    { ...size },
  )
}
