'use client'

import { useEffect } from 'react'

export default function BfcacheReload() {
  useEffect(() => {
    // On mount: if we set the flag before leaving for Stripe, reload now
    if (sessionStorage.getItem('stripe_redirect')) {
      sessionStorage.removeItem('stripe_redirect')
      window.location.reload()
      return
    }

    // Also catch bfcache restores (page was cached and restored)
    const handler = (e: PageTransitionEvent) => {
      if (e.persisted) {
        sessionStorage.removeItem('stripe_redirect')
        window.location.reload()
      }
    }
    window.addEventListener('pageshow', handler)
    return () => window.removeEventListener('pageshow', handler)
  }, [])

  return null
}
