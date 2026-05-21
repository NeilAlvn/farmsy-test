'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User, LogOut, ChevronDown, Heart, LayoutDashboard, Route } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTrip } from './TripProvider'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export default function HeaderAuth() {
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
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

  // Reserve space while loading to avoid layout shift
  if (loading) return <div className="w-9 h-9" />

  if (!user) {
    return (
      <Link
        href="/auth/signin"
        className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-4 py-2 rounded-full transition-all"
      >
        Sign in
      </Link>
    )
  }

  const initials = (user.user_metadata?.full_name as string | undefined)
    ? (user.user_metadata.full_name as string).split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : user.email?.[0].toUpperCase() ?? 'U'

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 hover:bg-gray-100 rounded-full p-1 pr-2 transition-colors"
        aria-label="User menu"
      >
        <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
          {initials}
        </div>
        <ChevronDown
          size={13}
          className={`text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-100 rounded-2xl shadow-lg shadow-black/5 overflow-hidden z-50">
          {/* User info */}
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs text-gray-400 mb-0.5">Signed in as</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{user.email}</p>
          </div>

          {/* Menu items */}
          <nav className="p-1.5 space-y-0.5">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <User size={14} className="text-gray-400" />
              My profile
            </Link>
            <Link
              href="/favorites"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Heart size={14} className="text-gray-400" />
              My favorites
            </Link>
            <Link
              href="/trips"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Route size={14} className="text-gray-400" />
              My trips
              {pendingFarms.length > 0 && (
                <span className="ml-auto min-w-[18px] h-[18px] bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">
                  {pendingFarms.length}
                </span>
              )}
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <LayoutDashboard size={14} className="text-gray-400" />
              My farm
            </Link>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors text-left"
            >
              <LogOut size={14} className="text-gray-400" />
              Sign out
            </button>
          </nav>
        </div>
      )}
    </div>
  )
}
