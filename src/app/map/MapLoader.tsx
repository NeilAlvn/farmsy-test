'use client'

import dynamic from 'next/dynamic'
import type { SlimFarm } from './FarmMap'

const FarmMap = dynamic(() => import('./FarmMap'), { ssr: false })

export default function MapLoader({ farms }: { farms: SlimFarm[] }) {
  return <FarmMap farms={farms} />
}
