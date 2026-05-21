'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'

interface Props {
  rating: number
  size?: number
  interactive?: boolean
  onRate?: (rating: number) => void
  className?: string
}

export default function StarRating({ rating, size = 14, interactive = false, onRate, className }: Props) {
  const [hover, setHover] = useState(0)
  const displayed = interactive ? (hover || rating) : rating

  return (
    <div className={`flex gap-0.5 ${className ?? ''}`}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && onRate?.(star)}
          onMouseEnter={() => interactive && setHover(star)}
          onMouseLeave={() => interactive && setHover(0)}
          className={interactive ? 'cursor-pointer transition-transform hover:scale-110' : 'cursor-default pointer-events-none'}
        >
          <Star
            size={size}
            className={star <= Math.round(displayed)
              ? 'text-amber-400 fill-amber-400'
              : 'text-gray-200 fill-gray-200'
            }
          />
        </button>
      ))}
    </div>
  )
}
