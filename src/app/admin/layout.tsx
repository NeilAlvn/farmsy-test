'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { destroySession } from '@/lib/session'
import { getAdminNavCounts, type AdminNavCounts } from './actions'
import {
  LayoutDashboard, Users, CreditCard, Mail, MessageSquare, Tag,
  Shield, MapPin, LogOut, Loader2, Menu, X, Inbox, Activity,
} from 'lucide-react'

// nav href → counts key (for the "new since last seen" badges)
const SECTION_BY_HREF: Record<string, keyof AdminNavCounts> = {
  '/admin/users': 'users',
  '/admin/submissions': 'submissions',
  '/admin/claims': 'claims',
  '/admin/contact': 'contact',
  '/admin/activity': 'activity',
}
const seenKey = (section: string) => `farmsy_admin_seen_${section}`
const fmtBadge = (n: number) => (n > 99 ? '99+' : String(n))

const NAV_MAIN = [
  { href: '/admin/overview',      label: 'Overview',      icon: LayoutDashboard },
  { href: '/admin/users',         label: 'Users',         icon: Users },
  { href: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { href: '/admin/winback',       label: 'Win-back',      icon: Mail },
  { href: '/admin/contact',       label: 'Contact',       icon: MessageSquare },
  { href: '/admin/discounts',     label: 'Discounts',     icon: Tag },
]

const NAV_TOOLS = [
  { href: '/admin/claims',      label: 'Claims',      icon: Shield },
  { href: '/admin/submissions', label: 'Submissions', icon: Inbox },
  { href: '/admin/farms',       label: 'Farms',       icon: MapPin },
  { href: '/admin/activity',    label: 'Activity',    icon: Activity },
]

function SidebarLink({
  href, label, icon: Icon, active, onClick, badge = 0,
}: {
  href: string; label: string; icon: React.ComponentType<{ size: number }>
  active: boolean; onClick?: () => void; badge?: number
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${
        active
          ? 'bg-white/[0.15] text-white font-semibold'
          : 'text-white/70 hover:text-white hover:bg-white/[0.08] font-medium'
      }`}
    >
      <Icon size={15} />
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span className="ml-auto inline-flex min-w-[20px] h-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold leading-none" style={{ color: 'var(--primary)' }}>
          {fmtBadge(badge)}
        </span>
      )}
    </Link>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setState] = useState<'loading' | 'ready'>('loading')
  const [menuOpen, setMenuOpen] = useState(false)
  const [counts, setCounts] = useState<AdminNavCounts | null>(null)
  const [seenTick, setSeenTick] = useState(0) // bump to recompute badges after marking seen

  // Fetch section totals on mount and whenever the route changes.
  useEffect(() => {
    if (state !== 'ready') return
    getAdminNavCounts().then(setCounts).catch(() => {})
  }, [state, pathname])

  // Mark the section the admin is currently viewing as "seen" (clears its badge).
  useEffect(() => {
    if (!counts) return
    const section = SECTION_BY_HREF[pathname]
    if (!section) return
    try {
      localStorage.setItem(seenKey(section), String(counts[section]))
      setSeenTick(t => t + 1)
    } catch { /* ignore */ }
  }, [counts, pathname])

  function badgeFor(href: string): number {
    const section = SECTION_BY_HREF[href]
    if (!section || !counts) return 0
    void seenTick // recompute when seen changes
    let seen = 0
    try { seen = Number(localStorage.getItem(seenKey(section)) ?? '0') || 0 } catch { /* ignore */ }
    return Math.max(0, counts[section] - seen)
  }

  useEffect(() => {
    const token = localStorage.getItem('farmsy_session_token')
    if (!token) {
      router.replace('/')
      return
    }
    fetch('/api/admin/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: token }),
    })
      .then(r => r.json())
      .then(({ isAdmin, otpVerified }: { isAdmin: boolean; otpVerified: boolean }) => {
        // Not an admin, or admin who hasn't passed OTP this session → home
        if (!isAdmin || !otpVerified) { router.replace('/'); return }
        setState('ready')
      })
      .catch(() => router.replace('/'))
  }, [router])

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <Loader2 size={22} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
      </div>
    )
  }

  const allNav = [...NAV_MAIN, ...NAV_TOOLS]
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--background)' }}>

      {/* ── Desktop sidebar ───────────────────────── */}
      <aside className="hidden md:flex w-60 flex-col shrink-0" style={{ backgroundColor: 'var(--primary)' }}>
        <div className="px-6 py-6 border-b border-white/10">
          <p className="font-display italic text-[1.6rem] leading-none text-white">Farmsy</p>
          <p className="text-[11px] text-white/50 mt-1">Admin Dashboard</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_MAIN.map(item => (
            <SidebarLink key={item.href} {...item} active={isActive(item.href)} badge={badgeFor(item.href)} />
          ))}
          <div className="h-px bg-white/10 my-3 mx-1" />
          {NAV_TOOLS.map(item => (
            <SidebarLink key={item.href} {...item} active={isActive(item.href)} badge={badgeFor(item.href)} />
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={async () => {
              await fetch('/api/admin/sign-out', { method: 'POST' }).catch(() => {})
              await destroySession()
              router.replace('/')
            }}
            className="flex items-center gap-2.5 px-3 py-2.5 w-full rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/[0.08] transition-all"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile ────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="md:hidden border-b border-white/10 px-4 py-3 flex items-center justify-between"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <p className="font-display italic text-xl text-white">Farmsy</p>
          <button onClick={() => setMenuOpen(o => !o)}>
            {menuOpen ? <X size={18} className="text-white/70" /> : <Menu size={18} className="text-white/70" />}
          </button>
        </header>

        {menuOpen && (
          <nav
            className="md:hidden border-b border-white/10 px-3 py-2 space-y-0.5"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {allNav.map(item => (
              <SidebarLink
                key={item.href}
                {...item}
                active={isActive(item.href)}
                badge={badgeFor(item.href)}
                onClick={() => setMenuOpen(false)}
              />
            ))}
          </nav>
        )}

        <main className="flex-1 p-6 md:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
