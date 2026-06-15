'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { destroySession } from '@/lib/session'
import { Wheat, Shield, MapPin, LogOut, Loader2, Menu, X } from 'lucide-react'

const NAV = [
  { href: '/admin/claims', label: 'Claims', icon: Shield },
  { href: '/admin/farms', label: 'Farms', icon: MapPin },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/auth/signin?redirect=/admin/claims')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle()
      if (profile?.role !== 'admin') {
        router.replace('/')
        return
      }
      setReady(true)
    })
  }, [router])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={22} className="animate-spin text-gray-300" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-white border-r border-gray-100 flex-col shrink-0">
        <div className="px-4 py-4 border-b border-gray-100 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
            <Wheat size={13} color="white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-900">Farmsy</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Admin</p>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith(href)
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t border-gray-100">
          <button
            onClick={async () => { await destroySession(); router.replace('/') }}
            className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header + content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-600 flex items-center justify-center">
              <Wheat size={11} color="white" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-bold text-gray-900">Admin</span>
          </div>
          <button onClick={() => setMenuOpen(o => !o)}>
            {menuOpen ? <X size={18} className="text-gray-500" /> : <Menu size={18} className="text-gray-500" />}
          </button>
        </header>

        {menuOpen && (
          <nav className="md:hidden bg-white border-b border-gray-100 px-3 py-2 space-y-0.5">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith(href) ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            ))}
          </nav>
        )}

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
