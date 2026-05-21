'use client'

import { Heart } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useFavorites } from './FavoritesProvider'

interface Props {
  osmId: string
  /** Extra Tailwind classes for positioning */
  className?: string
  size?: number
}

export default function HeartButton({ osmId, className = '', size = 15 }: Props) {
  const { favorites, isLoggedIn, toggle } = useFavorites()
  const router = useRouter()
  const isFaved = favorites.has(osmId)

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!isLoggedIn) {
      router.push(`/auth/signin?redirect=${encodeURIComponent(window.location.pathname)}`)
      return
    }

    toggle(osmId)
  }

  return (
    <button
      onClick={handleClick}
      aria-label={isFaved ? 'Remove from favorites' : 'Save to favorites'}
      className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
        isFaved
          ? 'bg-red-500 shadow-md shadow-red-500/30'
          : 'bg-black/30 backdrop-blur-sm hover:bg-black/50'
      } ${className}`}
    >
      <Heart
        size={size}
        className={isFaved ? 'fill-white text-white' : 'text-white'}
      />
    </button>
  )
}
