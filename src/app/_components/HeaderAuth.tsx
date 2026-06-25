'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, ChevronDown, CreditCard, Gift } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { destroySession } from '@/lib/session'
import { useTrip } from './TripProvider'
import SignInModal from './SignInModal'
import type { User as SupabaseUser } from '@supabase/supabase-js'

function getStoredUser(): SupabaseUser | null {
  try {
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!key) return null
    const parsed = JSON.parse(localStorage.getItem(key) ?? 'null')
    const user = parsed?.user
    return user?.id ? (user as SupabaseUser) : null
  } catch {
    return null
  }
}

export default function HeaderAuth() {
  const router = useRouter()
  const [user, setUser]             = useState<SupabaseUser | null | 'loading'>('loading')
  const [open, setOpen]             = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { pendingFarms } = useTrip()

  useEffect(() => {
    // Read localStorage on client before the async session check, to avoid flash
    const stored = getStoredUser()
    if (stored) setUser(stored)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  async function signOut() {
    await destroySession()
    setOpen(false)
    router.push('/')
    router.refresh()
  }

  // Empty placeholder while auth state is unknown — prevents sign-in button flash.
  if (user === 'loading') {
    return <div className="shrink-0 w-[72px] h-9" suppressHydrationWarning />
  }

  const initials = user
    ? ((user.user_metadata?.full_name as string | undefined)
        ? (user.user_metadata.full_name as string).split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
        : user.email?.[0].toUpperCase() ?? 'U')
    : ''

  return (
    <>
      {/* Modal lives outside the !user conditional so it survives Supabase auth state changes mid-flow (e.g. admin OTP step) */}
      {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} onSuccess={() => setShowSignIn(false)} />}

      <div className="shrink-0 w-[72px] h-9 flex items-center justify-end" suppressHydrationWarning>
        {!user ? (
          <button
            onClick={() => setShowSignIn(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            Sign in
          </button>
        ) : (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 rounded-full p-1 pr-2 transition-colors hover:bg-border/30"
          aria-label="User menu"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-primary-foreground" style={{ backgroundColor: 'var(--primary)' }}>
            {initials}
          </div>
          <ChevronDown
            size={13}
            className={`text-muted-foreground transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div className="animate-dropdown absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-border/60 bg-background shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)]">
            <div className="border-b border-border/60 px-4 py-3">
              <p className="mb-0.5 text-xs text-muted-foreground">Signed in as</p>
              <p className="truncate text-sm font-semibold text-foreground">{user.email}</p>
            </div>
            <nav className="p-1.5 space-y-0.5">
              <Link href="/account/subscription" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-border/30 hover:text-foreground">
                <CreditCard size={14} /> Subscription
              </Link>
              <Link href="/invite" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-border/30" style={{ color: 'var(--primary)' }}>
                <Gift size={14} /> Invite &amp; Earn
              </Link>
              <button onClick={signOut} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-border/30 hover:text-foreground">
                <LogOut size={14} /> Sign out
              </button>
            </nav>
          </div>
        )}
        </div>
        )}
      </div>
    </>
  )
}
