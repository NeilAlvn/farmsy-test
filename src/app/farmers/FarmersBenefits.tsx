'use client'

import { motion } from 'framer-motion'
import { MapPin, Pencil, Users, Sparkles } from 'lucide-react'

const ICONS = [MapPin, Pencil, Users, Sparkles]

interface Props {
  benefits: { title: string; desc: string }[]
}

export default function FarmersBenefits({ benefits }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {benefits.map(({ title, desc }, i) => {
        const Icon = ICONS[i]
        return (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex flex-col gap-4 rounded-2xl border p-5"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
          >
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.1)' }}
            >
              <Icon className="h-5 w-5" style={{ color: 'var(--primary)' }} strokeWidth={1.5} />
            </div>
            <div>
              <p className="mb-1.5 font-semibold" style={{ color: 'var(--foreground)' }}>{title}</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{desc}</p>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
