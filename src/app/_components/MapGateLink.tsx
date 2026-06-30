'use client'

import Link from 'next/link'
import { type ReactNode, type CSSProperties } from 'react'

interface Props {
  href: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}

// Map teaser: everyone can open the map and see the pins. The paywall is applied
// when a visitor clicks a farm for details (handled in FarmMap), so this link no
// longer blocks navigation — it's a plain link, kept as a component so existing
// call sites don't change.
export default function MapGateLink({ href, className, style, children }: Props) {
  return (
    <Link href={href} className={className} style={style}>
      {children}
    </Link>
  )
}
