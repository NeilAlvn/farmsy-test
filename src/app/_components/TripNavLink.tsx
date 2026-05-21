'use client'

import Link from 'next/link'
import { useTrip } from './TripProvider'

export default function TripNavLink() {
  const { pendingFarms } = useTrip()

  return (
    <Link
      href="/trips/new"
      className="relative px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-full transition-all"
    >
      Trip Builder
      {pendingFarms.length > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 leading-none">
          {pendingFarms.length}
        </span>
      )}
    </Link>
  )
}
