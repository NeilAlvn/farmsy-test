import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: '#3F5E3A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Sprout: stem + two leaves */}
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          {/* Stem */}
          <path d="M10 17 L10 9" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          {/* Left leaf */}
          <path d="M10 12 C10 12 6 11 5 8 C5 8 8 7 10 10" fill="white" />
          {/* Right leaf */}
          <path d="M10 9 C10 9 14 8 15 5 C15 5 12 4 10 7" fill="white" />
        </svg>
      </div>
    ),
    { ...size },
  )
}
