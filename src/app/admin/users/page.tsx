'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { getAdminUsers, type ProfileAdminRow } from '../actions'
import EditUserDrawer from './_components/EditUserDrawer'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function displayName(p: ProfileAdminRow) {
  if (p.first_name || p.last_name) return [p.first_name, p.last_name].filter(Boolean).join(' ')
  return p.name ?? '—'
}

const ROLE_FILTER = ['all', 'user', 'farmer', 'admin'] as const
type RoleFilter = typeof ROLE_FILTER[number]

export default function UsersPage() {
  const [users, setUsers] = useState<ProfileAdminRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [editingId, setEditingId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getAdminUsers().then(data => { setUsers(data); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    let list = users
    if (roleFilter !== 'all') list = list.filter(u => u.role === roleFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(u =>
        displayName(u).toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [users, search, roleFilter])

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Users</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          {loading ? '…' : `${users.length.toLocaleString()} registered accounts · click a row to edit`}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: 'var(--cream)' }}>
          {ROLE_FILTER.map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
              style={roleFilter === r
                ? { backgroundColor: 'var(--card)', color: 'var(--foreground)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                : { color: 'var(--muted-foreground)' }
              }
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-16 text-sm" style={{ color: 'var(--muted-foreground)' }}>No users found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--cream)' }}>
                  {['Name', 'Email', 'Role', 'Subscription', 'Joined', 'Verified'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => (
                  <tr
                    key={u.id}
                    onClick={() => setEditingId(u.id)}
                    style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}
                    className="hover:bg-black/[0.02] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: 'var(--foreground)' }}>{displayName(u)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>{u.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                        style={{
                          backgroundColor: u.role === 'admin' ? 'oklch(0.36 0.07 145 / 0.1)' : u.role === 'farmer' ? 'oklch(0.6 0.12 200 / 0.1)' : 'var(--border)',
                          color: u.role === 'admin' ? 'var(--primary)' : u.role === 'farmer' ? 'oklch(0.4 0.1 200)' : 'var(--muted-foreground)',
                        }}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.subscription_status ? (
                        <span
                          className="text-xs font-medium capitalize"
                          style={{ color: u.subscription_status === 'active' ? 'var(--primary)' : u.subscription_status === 'canceled' ? '#DC2626' : 'var(--muted-foreground)' }}
                        >
                          {u.subscription_status}
                          {u.subscription_plan ? ` · ${u.subscription_plan.replace('_', ' ')}` : ''}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--muted-foreground)' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>{fmtDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      {u.email_verified
                        ? <span className="text-xs font-medium" style={{ color: 'var(--primary)' }}>● Yes</span>
                        : <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>○ No</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingId && (
        <EditUserDrawer
          userId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={load}
        />
      )}

    </div>
  )
}
