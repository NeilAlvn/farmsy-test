'use client'

import dynamic from 'next/dynamic'
import type { SlimFarm } from './FarmMap'

const FarmMap = dynamic(() => import('./FarmMap'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2"
          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }}
        />
        <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
          Loading map…
        </p>
      </div>
    </div>
  ),
})

export default function MapLoader({ farms }: { farms: SlimFarm[] }) {
  return <FarmMap farms={farms} />
}
