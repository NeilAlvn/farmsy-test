'use client'

import { useEffect } from 'react'

// Runs on every page — captures ?ref= from the URL and stores it as a cookie
// so SignInModal can pass it during signup regardless of which page the user lands on.
export default function RefCapture() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref && /^[A-Z0-9]{6,12}$/i.test(ref)) {
      document.cookie = `farmsy_ref=${ref.toUpperCase()}; path=/; max-age=604800; SameSite=Lax`
    }
  }, [])

  return null
}
