'use client'

import { motion } from 'framer-motion'
import { Map, CreditCard, Leaf, Mail } from 'lucide-react'

const QUICK = [
  { Icon: Map,        label: 'Find farms', text: 'Use the interactive map and tap "Locate me" to discover farms near you. Filter by type, zoom in on any region, and tap a pin for full details.' },
  { Icon: CreditCard, label: 'Free trial',  text: '3-day free trial on every new account. Your card is collected upfront but not charged until day 3. Cancel any time before then — no cost.' },
  { Icon: Leaf,       label: 'Claim free',  text: 'Listing your farm is always free. Find it on the map, open the detail panel, and tap "Claim this farm" to take ownership and edit your info.' },
  { Icon: Mail,       label: 'Need help?',  text: "Can't find what you need here? Reach out via our contact page and we'll get back to you as quickly as we can." },
]

export default function FaqQuickCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {QUICK.map(({ Icon, label, text }, i) => (
        <motion.div
          key={label}
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
            <p className="mb-1.5 font-semibold" style={{ color: 'var(--foreground)' }}>{label}</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{text}</p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
