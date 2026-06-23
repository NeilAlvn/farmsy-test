'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getAdminWinback, type ProfileAdminRow } from '../actions'

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
      const resubscribed = data.filter(r => r.subscription_status === 'active')
      setRows(resubscribed)
      setLoading(false)
    })
  }, [])

  const totalDiscount = rows.reduce((sum, r) => {
    if (r.subscription_plan?.includes('year')) return sum + 9.90
    return sum + 1.00
  }, 0)

  return (
    <div className="space-y-6 max-w-6xl">

      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Discounts</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Active coupons and redemption stats</p>
      </div>

      {/* COMEBACK20 card */}
      <div
        className="rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center gap-6"
        style={{ backgroundColor: 'var(--primary)' }}
      >
        <div className="flex-1 space-y-2">
          <p className="text-xl font-bold text-white tracking-wide">COMEBACK20</p>
          <p className="text-sm text-white/75">
            20% off — once per user — win-back only
          </p>
          <p className="text-xs text-white/50">
            Eligibility: <code className="bg-white/10 px-1.5 py-0.5 rounded text-white/80">subscription_status = 'canceled'</code> &amp; <code className="bg-white/10 px-1.5 py-0.5 rounded text-white/80">win_back_sent = true</code>
          </p>
        </div>
        <div className="flex gap-8 shrink-0">
          {[
            { label: 'Redemptions',   value: loading ? '…' : rows.length.toString() },
            { label: 'Discount given',value: loading ? '…' : `€ ${totalDiscount.toFixed(2)}` },
            { label: 'Status',        value: 'Active ✓' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-white/60 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Redemption history */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Redemption History</h2>

        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center py-16 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              No redemptions yet — users who resubscribe via win-back will appear here
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--cream)' }}>
                    {['User', 'Email', 'Coupon', 'Plan', 'Canceled On', 'Discount Amt.'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={r.id}
                      style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}
                      className="hover:bg-black/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: 'var(--foreground)' }}>{displayName(r)}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>{r.email ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold tracking-wide" style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.1)', color: 'var(--primary)' }}>
                          COMEBACK20
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs capitalize" style={{ color: 'var(--muted-foreground)' }}>
                        {r.subscription_plan?.replace('_', ' ') ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>{fmtDate(r.cancelled_at)}</td>
                      <td className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                        {r.subscription_plan?.includes('year') ? '€ 9.90 off' : '€ 1.00 off'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
