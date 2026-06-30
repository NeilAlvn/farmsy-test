'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAdminUsers, type ProfileAdminRow } from '../actions'
import DataTable, { type Column } from '../_components/DataTable'
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
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [editingId, setEditingId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getAdminUsers().then(data => { setUsers(data); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const rows = useMemo(
    () => (roleFilter === 'all' ? users : users.filter(u => u.role === roleFilter)),
    [users, roleFilter],
  )

  const columns: Column<ProfileAdminRow>[] = [
    { key: 'name', header: 'Name', sortValue: displayName,
      render: u => <span className="font-medium whitespace-nowrap" style={{ color: 'var(--foreground)' }}>{displayName(u)}</span> },
    { key: 'email', header: 'Email', sortValue: u => u.email ?? '',
      render: u => <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{u.email ?? '—'}</span> },
    { key: 'role', header: 'Role', sortValue: u => u.role,
      render: u => (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize" style={{
          backgroundColor: u.role === 'admin' ? 'oklch(0.36 0.07 145 / 0.1)' : u.role === 'farmer' ? 'oklch(0.6 0.12 200 / 0.1)' : 'var(--border)',
          color: u.role === 'admin' ? 'var(--primary)' : u.role === 'farmer' ? 'oklch(0.4 0.1 200)' : 'var(--muted-foreground)',
        }}>{u.role}</span>
      ) },
    { key: 'sub', header: 'Subscription', sortValue: u => u.subscription_status ?? '',
      render: u => u.subscription_status
        ? <span className="text-xs font-medium capitalize" style={{ color: u.subscription_status === 'active' ? 'var(--primary)' : u.subscription_status === 'canceled' ? '#DC2626' : 'var(--muted-foreground)' }}>{u.subscription_status}{u.subscription_plan ? ` · ${u.subscription_plan.replace('_', ' ')}` : ''}</span>
        : <span style={{ color: 'var(--muted-foreground)' }}>—</span> },
    { key: 'joined', header: 'Joined', sortValue: u => new Date(u.created_at).getTime(),
      render: u => <span className="text-xs whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>{fmtDate(u.created_at)}</span> },
    { key: 'verified', header: 'Verified', sortValue: u => (u.email_verified ? 1 : 0),
      render: u => u.email_verified
        ? <span className="text-xs font-medium" style={{ color: 'var(--primary)' }}>● Yes</span>
        : <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>○ No</span> },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Users</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          {loading ? '…' : `${users.length.toLocaleString()} registered accounts · click a row to edit`}
        </p>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={u => u.id}
        loading={loading}
        searchText={u => `${displayName(u)} ${u.email ?? ''}`}
        searchPlaceholder="Search by name or email…"
        onRowClick={u => setEditingId(u.id)}
        emptyText="No users found"
        defaultSort={{ key: 'joined', dir: 'desc' }}
        toolbarRight={
          <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: 'var(--cream)' }}>
            {ROLE_FILTER.map(r => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                style={roleFilter === r ? { backgroundColor: 'var(--card)', color: 'var(--foreground)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : { color: 'var(--muted-foreground)' }}>
                {r}
              </button>
            ))}
          </div>
        }
      />

      {editingId && <EditUserDrawer userId={editingId} onClose={() => setEditingId(null)} onSaved={load} />}
    </div>
  )
}
