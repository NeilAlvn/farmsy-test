'use client'

import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { getAdminWinback, type ProfileAdminRow } from '../actions'
import DataTable, { type Column } from '../_components/DataTable'

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function displayName(p: ProfileAdminRow) {
  if (p.first_name || p.last_name) return [p.first_name, p.last_name].filter(Boolean).join(' ')
  return p.name ?? p.email ?? '—'
}

export default function WinbackPage() {
  const [rows, setRows] = useState<ProfileAdminRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAdminWinback().then(data => { setRows(data); setLoading(false) })
  }, [])

  const resubscribed = rows.filter(r => r.subscription_status === 'active').length

  const columns: Column<ProfileAdminRow>[] = [
    { key: 'user', header: 'User', sortValue: displayName,
      render: r => <span className="font-medium whitespace-nowrap" style={{ color: 'var(--foreground)' }}>{displayName(r)}</span> },
    { key: 'email', header: 'Email', sortValue: r => r.email ?? '',
      render: r => <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{r.email ?? '—'}</span> },
    { key: 'canceled', header: 'Canceled On', sortValue: r => (r.cancelled_at ? new Date(r.cancelled_at).getTime() : 0),
      render: r => <span className="text-xs whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>{fmtDate(r.cancelled_at)}</span> },
    { key: 'status', header: 'Current Status', sortValue: r => r.subscription_status ?? '',
      render: r => <span className="text-xs font-medium capitalize" style={{ color: r.subscription_status === 'active' ? 'var(--primary)' : r.subscription_status === 'canceled' ? '#DC2626' : 'var(--muted-foreground)' }}>{r.subscription_status ?? '—'}</span> },
    { key: 'resub', header: 'Resubscribed', sortValue: r => (r.subscription_status === 'active' ? 1 : 0),
      render: r => r.subscription_status === 'active'
        ? <span className="text-xs font-medium" style={{ color: 'var(--primary)' }}>● Yes</span>
        : <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>✗ No</span> },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Win-back</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          {loading ? '…' : `${rows.length} emails sent · ${resubscribed} resubscribed`}
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.07)', border: '1px solid oklch(0.36 0.07 145 / 0.2)', color: 'oklch(0.28 0.07 145)' }}>
        <Info size={15} className="shrink-0 mt-0.5" />
        <p>Win-back emails are sent automatically at <strong>10:00 AM daily</strong> to users who canceled a yearly subscription and have <code className="text-xs bg-black/5 px-1 py-0.5 rounded">win_back_sent = false</code>. The <strong>COMEBACK20</strong> coupon (20% off) is applied on resubscribe.</p>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={r => r.id}
        loading={loading}
        searchText={r => `${displayName(r)} ${r.email ?? ''}`}
        searchPlaceholder="Search win-back recipients…"
        emptyText="No win-back emails sent yet"
        maxHeight="calc(100vh - 360px)"
        defaultSort={{ key: 'canceled', dir: 'desc' }}
      />
    </div>
  )
}
