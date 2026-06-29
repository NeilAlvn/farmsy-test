'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { getAdminStats, getPeople, type PeopleRow } from '../actions'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STAT_ACCENT: Record<string, string> = {
  users: '#3B82F6',
  active: 'var(--primary)',
  canceled: '#DC2626',
  winback: '#D97706',
  waitlist: '#8B5CF6',
}

// Subscription / list status → badge colours
const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  active:   { bg: 'oklch(0.36 0.07 145 / 0.12)', fg: 'var(--primary)' },
  trialing: { bg: 'oklch(0.6 0.12 230 / 0.12)',  fg: '#2563EB' },
  canceled: { bg: 'oklch(0.62 0.2 25 / 0.1)',    fg: '#DC2626' },
  past_due: { bg: 'oklch(0.7 0.15 60 / 0.14)',   fg: '#D97706' },
  free:     { bg: 'var(--border)',               fg: 'var(--muted-foreground)' },
  waitlist: { bg: 'oklch(0.6 0.18 300 / 0.12)',  fg: '#8B5CF6' },
}

type SortKey = 'newest' | 'oldest' | 'name'
type TypeFilter = 'all' | 'user' | 'waitlist' | 'converted'

export default function OverviewPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSubscriptions: 0,
    canceledSubscriptions: 0,
    winbackSent: 0,
    totalContact: 0,
    waitlistCount: 0,
  })

  const [people, setPeople]   = useState<PeopleRow[]>([])
  const [search, setSearch]   = useState('')
  const [sort, setSort]       = useState<SortKey>('newest')
  const [typeF, setTypeF]     = useState<TypeFilter>('all')

  useEffect(() => {
    Promise.all([getAdminStats(), getPeople()])
      .then(([s, p]) => {
        setStats({
          totalUsers: s.totalUsers,
          activeSubscriptions: s.activeSubscriptions,
          canceledSubscriptions: s.canceledSubscriptions,
          winbackSent: s.winbackSent,
          totalContact: s.totalContact,
          waitlistCount: s.waitlistCount,
        })
        setPeople(p)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const cards = [
    { key: 'users',    label: 'Total Users',          value: stats.totalUsers,           sub: 'registered accounts', accent: STAT_ACCENT.users    },
    { key: 'active',   label: 'Active Subscriptions', value: stats.activeSubscriptions,  sub: 'paying subscribers',  accent: STAT_ACCENT.active   },
    { key: 'canceled', label: 'Canceled',             value: stats.canceledSubscriptions,sub: 'churned accounts',    accent: STAT_ACCENT.canceled },
    { key: 'winback',  label: 'Win-back Sent',        value: stats.winbackSent,          sub: 'emails dispatched',   accent: STAT_ACCENT.winback  },
    { key: 'waitlist', label: 'Waiting List',         value: stats.waitlistCount,        sub: 'pre-launch signups',  accent: STAT_ACCENT.waitlist },
  ]

  const visible = useMemo(() => {
    let rows = people
    if (typeF === 'user')      rows = rows.filter(p => p.kind === 'user')
    else if (typeF === 'waitlist')  rows = rows.filter(p => p.kind === 'waitlist')
    else if (typeF === 'converted') rows = rows.filter(p => p.kind === 'user' && p.fromWaitlist)

    const q = search.trim().toLowerCase()
    if (q) rows = rows.filter(p => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))

    const sorted = [...rows]
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'oldest') sorted.sort((a, b) => new Date(a.joined).getTime() - new Date(b.joined).getTime())
    else sorted.sort((a, b) => new Date(b.joined).getTime() - new Date(a.joined).getTime())
    return sorted
  }, [people, typeF, search, sort])

  const selectStyle = {
    borderColor: 'var(--border)',
    backgroundColor: 'var(--background)',
    color: 'var(--foreground)',
  }

  return (
    <div className="space-y-8">

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
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

      {/* People — users + waiting list in one table */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            People <span className="font-normal" style={{ color: 'var(--muted-foreground)' }}>({visible.length})</span>
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name or email…"
                className="rounded-xl border pl-8 pr-3 py-1.5 text-sm outline-none w-56"
                style={selectStyle}
              />
            </div>
            {/* Type filter */}
            <select value={typeF} onChange={e => setTypeF(e.target.value as TypeFilter)}
              className="rounded-xl border px-3 py-1.5 text-sm outline-none" style={selectStyle}>
              <option value="all">All people</option>
              <option value="user">Users</option>
              <option value="waitlist">Waiting list</option>
              <option value="converted">Converted from waitlist</option>
            </select>
            {/* Sort */}
            <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
              className="rounded-xl border px-3 py-1.5 text-sm outline-none" style={selectStyle}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
            </div>
          ) : visible.length === 0 ? (
            <p className="text-center py-12 text-sm" style={{ color: 'var(--muted-foreground)' }}>No people match your filters</p>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: 460 }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--cream)' }}>
                    {['Name', 'Email', 'Type', 'Status', 'Joined'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)', backgroundColor: 'var(--cream)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p, i) => {
                    const st = STATUS_STYLE[p.status] ?? STATUS_STYLE.free
                    return (
                      <tr
                        key={p.id}
                        style={{ borderBottom: i < visible.length - 1 ? '1px solid var(--border)' : 'none' }}
                        className="hover:bg-black/[0.02] transition-colors"
                      >
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--foreground)' }}>
                          {p.name}
                          {p.kind === 'user' && p.fromWaitlist && (
                            <span className="ml-2 align-middle rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.12)', color: 'var(--primary)' }}>
                              ✓ from waitlist
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--muted-foreground)' }}>{p.email || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{
                              backgroundColor: p.kind === 'user' ? 'oklch(0.6 0.12 230 / 0.1)' : 'oklch(0.6 0.18 300 / 0.1)',
                              color: p.kind === 'user' ? '#2563EB' : '#8B5CF6',
                            }}>
                            {p.kind === 'user' ? 'User' : 'Waiting list'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
                            style={{ backgroundColor: st.bg, color: st.fg }}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>{fmtDate(p.joined)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
