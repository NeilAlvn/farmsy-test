'use client'

import { useEffect, useState } from 'react'
import { Users, CreditCard, XCircle, Mail, Loader2 } from 'lucide-react'
import { getAdminStats, type ProfileAdminRow } from '../actions'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function displayName(p: ProfileAdminRow) {
  if (p.first_name || p.last_name) return [p.first_name, p.last_name].filter(Boolean).join(' ')
  return p.name ?? p.email ?? '—'
}

const STAT_ACCENT: Record<string, string> = {
  users: '#3B82F6',
  active: 'var(--primary)',
  canceled: '#DC2626',
  winback: '#D97706',
}

export default function OverviewPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSubscriptions: 0,
    canceledSubscriptions: 0,
    winbackSent: 0,
    totalContact: 0,
    recentSignups: [] as ProfileAdminRow[],
  })

  useEffect(() => {
    getAdminStats().then(data => { setStats(data); setLoading(false) })
  }, [])

  const cards = [
    { key: 'users',    label: 'Total Users',          value: stats.totalUsers,           sub: 'registered accounts',      accent: STAT_ACCENT.users    },
    { key: 'active',   label: 'Active Subscriptions', value: stats.activeSubscriptions,  sub: 'paying subscribers',       accent: STAT_ACCENT.active   },
    { key: 'canceled', label: 'Canceled',             value: stats.canceledSubscriptions,sub: 'churned accounts',         accent: STAT_ACCENT.canceled },
    { key: 'winback',  label: 'Win-back Sent',        value: stats.winbackSent,          sub: 'emails dispatched',        accent: STAT_ACCENT.winback  },
  ]

  return (
    <div className="space-y-8 max-w-6xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Overview</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map(card => (
            <div
              key={card.key}
              className="rounded-2xl p-5 space-y-3"
              style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <div className="w-8 h-0.5 rounded-full" style={{ backgroundColor: card.accent }} />
              <div>
                <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
                  {card.value.toLocaleString()}
                </p>
                <p className="text-sm font-medium mt-1" style={{ color: 'var(--muted-foreground)' }}>{card.label}</p>
                <p className="text-xs mt-0.5 opacity-60" style={{ color: 'var(--muted-foreground)' }}>{card.sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent signups */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Recent Signups</h2>

        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
            </div>
          ) : stats.recentSignups.length === 0 ? (
            <p className="text-center py-12 text-sm" style={{ color: 'var(--muted-foreground)' }}>No signups yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--cream)' }}>
                    {['Name', 'Email', 'Role', 'Joined', 'Status'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.recentSignups.map((u, i) => (
                    <tr
                      key={u.id}
                      style={{ borderBottom: i < stats.recentSignups.length - 1 ? '1px solid var(--border)' : 'none' }}
                      className="hover:bg-black/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--foreground)' }}>{displayName(u)}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>{u.email ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                          style={{
                            backgroundColor: u.role === 'admin' ? 'oklch(0.36 0.07 145 / 0.1)' : u.role === 'farmer' ? 'oklch(0.6 0.12 200 / 0.1)' : 'var(--border)',
                            color: u.role === 'admin' ? 'var(--primary)' : 'var(--muted-foreground)',
                          }}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>{fmtDate(u.created_at)}</td>
                      <td className="px-4 py-3">
                        {u.email_verified
                          ? <span className="text-xs font-medium" style={{ color: 'var(--primary)' }}>● Verified</span>
                          : <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>○ Pending</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Users,    label: 'Manage Users',    href: '/admin/users' },
          { icon: CreditCard, label: 'Subscriptions', href: '/admin/subscriptions' },
          { icon: Mail,     label: 'Win-back',        href: '/admin/winback' },
          { icon: XCircle,  label: 'Contact',         href: '/admin/contact' },
        ].map(({ icon: Icon, label, href }) => (
          <a
            key={href}
            href={href}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-80"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            <Icon size={15} style={{ color: 'var(--primary)' }} />
            {label}
          </a>
        ))}
      </div>

    </div>
  )
}
