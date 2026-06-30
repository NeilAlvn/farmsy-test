'use client'

import { useEffect, useState } from 'react'
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

export default function DiscountsPage() {
  const [rows, setRows] = useState<ProfileAdminRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAdminWinback().then(data => {
      setRows(data.filter(r => r.subscription_status === 'active'))
      setLoading(false)
    })
  }, [])

  const totalDiscount = rows.reduce((sum, r) => sum + (r.subscription_plan?.includes('year') ? 9.90 : 1.00), 0)

  const columns: Column<ProfileAdminRow>[] = [
    { key: 'user', header: 'User', sortValue: displayName,
      render: r => <span className="font-medium whitespace-nowrap" style={{ color: 'var(--foreground)' }}>{displayName(r)}</span> },
    { key: 'email', header: 'Email', sortValue: r => r.email ?? '',
      render: r => <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{r.email ?? '—'}</span> },
    { key: 'coupon', header: 'Coupon',
      render: () => <span className="px-2 py-0.5 rounded-full text-xs font-bold tracking-wide" style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.1)', color: 'var(--primary)' }}>COMEBACK20</span> },
    { key: 'plan', header: 'Plan', sortValue: r => r.subscription_plan ?? '',
      render: r => <span className="text-xs capitalize" style={{ color: 'var(--muted-foreground)' }}>{r.subscription_plan?.replace('_', ' ') ?? '—'}</span> },
    { key: 'canceled', header: 'Canceled On', sortValue: r => (r.cancelled_at ? new Date(r.cancelled_at).getTime() : 0),
      render: r => <span className="text-xs whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>{fmtDate(r.cancelled_at)}</span> },
    { key: 'amt', header: 'Discount Amt.', sortValue: r => (r.subscription_plan?.includes('year') ? 9.9 : 1),
      render: r => <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{r.subscription_plan?.includes('year') ? '€ 9.90 off' : '€ 1.00 off'}</span> },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Discounts</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Active coupons and redemption stats</p>
      </div>

      <div className="rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center gap-6" style={{ backgroundColor: 'var(--primary)' }}>
        <div className="flex-1 space-y-2">
          <p className="text-xl font-bold text-white tracking-wide">COMEBACK20</p>
          <p className="text-sm text-white/75">20% off — once per user — win-back only</p>
          <p className="text-xs text-white/50">
            Eligibility: <code className="bg-white/10 px-1.5 py-0.5 rounded text-white/80">subscription_status = &apos;canceled&apos;</code> &amp; <code className="bg-white/10 px-1.5 py-0.5 rounded text-white/80">win_back_sent = true</code>
          </p>
        </div>
        <div className="flex gap-8 shrink-0">
          {[
            { label: 'Redemptions', value: loading ? '…' : rows.length.toString() },
            { label: 'Discount given', value: loading ? '…' : `€ ${totalDiscount.toFixed(2)}` },
            { label: 'Status', value: 'Active ✓' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-white/60 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Redemption History</h2>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={r => r.id}
          loading={loading}
          searchText={r => `${displayName(r)} ${r.email ?? ''}`}
          searchPlaceholder="Search redemptions…"
          emptyText="No redemptions yet — users who resubscribe via win-back will appear here"
          maxHeight="calc(100vh - 470px)"
          defaultSort={{ key: 'canceled', dir: 'desc' }}
        />
      </div>
    </div>
  )
}
