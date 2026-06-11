'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User, LogOut, ChevronDown, Heart, LayoutDashboard, Route } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTrip } from './TripProvider'
import SignInModal from './SignInModal'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export default function HeaderAuth() {
  const router = useRouter()
  const [user, setUser]         = useState<SupabaseUser | null>(null)
  const [loading, setLoading]   = useState(true)
  const [open, setOpen]         = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { pendingFarms } = useTrip()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
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
    await supabase.auth.signOut()
    setOpen(false)
    router.push('/')
    router.refresh()
  }

  if (loading) return (
    <div className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-1.5 text-xs opacity-0 pointer-events-none select-none" aria-hidden>
      Sign in
    </div>
  )

  if (!user) {
    return (
      <>
        <button
          onClick={() => setShowSignIn(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
        >
          Sign in
        </button>
        {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} />}
      </>
    )
  }

  const initials = (user.user_metadata?.full_name as string | undefined)
    ? (user.user_metadata.full_name as string).split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : user.email?.[0].toUpperCase() ?? 'U'

  return (
    <div className="relative shrink-0" ref={menuRef}>
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
          {/* User info */}
          <div className="border-b border-border/60 px-4 py-3">
            <p className="mb-0.5 text-xs text-muted-foreground">Signed in as</p>
            <p className="truncate text-sm font-semibold text-foreground">{user.email}</p>
          </div>

          {/* Menu items */}
          <nav className="p-1.5 space-y-0.5">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-border/30 hover:text-foreground"
            >
              <User size={14} />
              My profile
            </Link>
            <Link
              href="/favorites"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-border/30 hover:text-foreground"
            >
              <Heart size={14} />
              My favorites
            </Link>
            <Link
              href="/trips"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-border/30 hover:text-foreground"
            >
              <Route size={14} />
              My trips
              {pendingFarms.length > 0 && (
                <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-primary-foreground" style={{ backgroundColor: 'var(--primary)' }}>
                  {pendingFarms.length}
                </span>
              )}
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-border/30 hover:text-foreground"
            >
              <LayoutDashboard size={14} />
              My farm
            </Link>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-border/30 hover:text-foreground"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </nav>
        </div>
      )}
    </div>
  )
}
