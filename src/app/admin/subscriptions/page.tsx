'use client'

import { useEffect, useMemo, useState } from 'react'
import { getAdminSubscriptions, type ProfileAdminRow } from '../actions'
import DataTable, { type Column } from '../_components/DataTable'

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function displayName(p: ProfileAdminRow) {
  if (p.first_name || p.last_name) return [p.first_name, p.last_name].filter(Boolean).join(' ')
  return p.name ?? p.email ?? '—'
}

const TABS = ['all', 'active', 'canceled', 'past_due'] as const
type Tab = typeof TABS[number]

export default function SubscriptionsPage() {
  const [rows, setRows] = useState<ProfileAdminRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('active')

  useEffect(() => {
    getAdminSubscriptions().then(data => { setRows(data); setLoading(false) })
  }, [])

  const counts = useMemo(() => ({
    all: rows.length,
    active: rows.filter(r => r.subscription_status === 'active').length,
    canceled: rows.filter(r => r.subscription_status === 'canceled').length,
    past_due: rows.filter(r => r.subscription_status === 'past_due').length,
  }), [rows])

  const filtered = useMemo(() => (tab === 'all' ? rows : rows.filter(r => r.subscription_status === tab)), [rows, tab])

  const activeRows = rows.filter(r => r.subscription_status === 'active')
  const mrr = activeRows.filter(r => r.subscription_plan?.includes('month')).length * 9.99
    + activeRows.filter(r => r.subscription_plan?.includes('year')).length * (99 / 12)
  const arr = mrr * 12
  const churn = rows.length > 0 ? ((counts.canceled / rows.length) * 100).toFixed(1) : '0.0'

  const columns: Column<ProfileAdminRow>[] = [
    { key: 'user', header: 'User', sortValue: displayName,
      render: r => <span className="font-medium whitespace-nowrap" style={{ color: 'var(--foreground)' }}>{displayName(r)}</span> },
    { key: 'email', header: 'Email', sortValue: r => r.email ?? '',
      render: r => <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{r.email ?? '—'}</span> },
    { key: 'plan', header: 'Plan', sortValue: r => r.subscription_plan ?? '',
      render: r => <span className="text-xs capitalize" style={{ color: 'var(--muted-foreground)' }}>{r.subscription_plan?.replace('_', ' ') ?? '—'}</span> },
    { key: 'status', header: 'Status', sortValue: r => r.subscription_status ?? '',
      render: r => <span className="text-xs font-medium capitalize" style={{ color: r.subscription_status === 'active' ? 'var(--primary)' : r.subscription_status === 'canceled' ? '#DC2626' : '#D97706' }}>{r.subscription_status === 'active' ? '●' : '✗'} {r.subscription_status}</span> },
    { key: 'canceled', header: 'Canceled On', sortValue: r => (r.cancelled_at ? new Date(r.cancelled_at).getTime() : 0),
      render: r => <span className="text-xs whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>{fmtDate(r.cancelled_at)}</span> },
    { key: 'winback', header: 'Win-back', sortValue: r => (r.win_back_sent ? 1 : 0),
      render: r => r.win_back_sent ? <span className="text-xs font-medium" style={{ color: '#D97706' }}>● Sent</span> : <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>—</span> },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Subscriptions</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          {loading ? '…' : `${counts.active} active · ${counts.canceled} canceled`}
        </p>
      </div>

      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'MRR', value: `€ ${mrr.toFixed(0)}`, color: 'var(--primary)' },
            { label: 'ARR (est.)', value: `€ ${arr.toFixed(0)}`, color: '#3B82F6' },
            { label: 'Churn rate', value: `${churn}%`, color: '#DC2626' },
            { label: 'Active', value: counts.active.toString(), color: 'var(--primary)' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={r => r.id}
        loading={loading}
        searchText={r => `${displayName(r)} ${r.email ?? ''}`}
        searchPlaceholder="Search subscribers…"
        emptyText="No subscriptions"
        defaultSort={{ key: 'canceled', dir: 'desc' }}
        toolbarRight={
          <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: 'var(--cream)' }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                style={tab === t ? { backgroundColor: 'var(--card)', color: 'var(--foreground)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : { color: 'var(--muted-foreground)' }}>
                {t.replace('_', ' ')}{counts[t] > 0 && <span className="ml-1 opacity-50">{counts[t]}</span>}
              </button>
            ))}
          </div>
        }
      />
    </div>
  )
}
