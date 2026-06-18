import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 40,
          background: '#3F5E3A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="110" height="110" viewBox="0 0 20 20" fill="none">
          <path d="M10 17 L10 9" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M10 12 C10 12 6 11 5 8 C5 8 8 7 10 10" fill="white" />
          <path d="M10 9 C10 9 14 8 15 5 C15 5 12 4 10 7" fill="white" />
        </svg>
      </div>
    ),
    { ...size },
  )
}
