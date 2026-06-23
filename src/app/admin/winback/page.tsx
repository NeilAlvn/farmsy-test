'use client'

import { useEffect, useState } from 'react'
import { Loader2, Info } from 'lucide-react'
import { getAdminWinback, type ProfileAdminRow } from '../actions'

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

  return (
    <div className="space-y-6 max-w-6xl">

      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Win-back</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          {loading ? '…' : `${rows.length} emails sent · ${resubscribed} resubscribed`}
        </p>
      </div>

      {/* Info banner */}
      <div
        className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
        style={{
          backgroundColor: 'oklch(0.36 0.07 145 / 0.07)',
          border: '1px solid oklch(0.36 0.07 145 / 0.2)',
          color: 'oklch(0.28 0.07 145)',
        }}
      >
        <Info size={15} className="shrink-0 mt-0.5" />
        <p>
          Win-back emails are sent automatically at <strong>10:00 AM daily</strong> to users who canceled
          a yearly subscription and have <code className="text-xs bg-black/5 px-1 py-0.5 rounded">win_back_sent = false</code>.
          The <strong>COMEBACK20</strong> coupon (20% off) is applied on resubscribe.
        </p>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-center py-16 text-sm" style={{ color: 'var(--muted-foreground)' }}>No win-back emails sent yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--cream)' }}>
                  {['User', 'Email', 'Canceled On', 'Current Status', 'Resubscribed'].map(h => (
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
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>{fmtDate(r.cancelled_at)}</td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-medium capitalize"
                        style={{ color: r.subscription_status === 'active' ? 'var(--primary)' : r.subscription_status === 'canceled' ? '#DC2626' : 'var(--muted-foreground)' }}
                      >
                        {r.subscription_status ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.subscription_status === 'active'
                        ? <span className="text-xs font-medium" style={{ color: 'var(--primary)' }}>● Yes</span>
                        : <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>✗ No</span>
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
  )
}
