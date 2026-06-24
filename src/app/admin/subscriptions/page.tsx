'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getAdminSubscriptions, type ProfileAdminRow } from '../actions'

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
    all:      rows.length,
    active:   rows.filter(r => r.subscription_status === 'active').length,
    canceled: rows.filter(r => r.subscription_status === 'canceled').length,
    past_due: rows.filter(r => r.subscription_status === 'past_due').length,
  }), [rows])

  const filtered = useMemo(() =>
    tab === 'all' ? rows : rows.filter(r => r.subscription_status === tab),
    [rows, tab]
  )

  const activeRows = rows.filter(r => r.subscription_status === 'active')
  const monthlyMRR = activeRows.filter(r => r.subscription_plan?.includes('month')).length * 9.99
  const yearlyMRR  = activeRows.filter(r => r.subscription_plan?.includes('year')).length * (99 / 12)
  const mrr = monthlyMRR + yearlyMRR
  const arr = mrr * 12
  const churn = rows.length > 0 ? ((counts.canceled / rows.length) * 100).toFixed(1) : '0.0'

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Subscriptions</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          {loading ? '…' : `${counts.active} active · ${counts.canceled} canceled`}
        </p>
      </div>

      {/* MRR strip */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'MRR',        value: `€ ${mrr.toFixed(0)}`,  color: 'var(--primary)' },
            { label: 'ARR (est.)', value: `€ ${arr.toFixed(0)}`,  color: '#3B82F6' },
            { label: 'Churn rate', value: `${churn}%`,            color: '#DC2626' },
            { label: 'Active',     value: counts.active.toString(), color: 'var(--primary)' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1 w-fit" style={{ backgroundColor: 'var(--cream)' }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
            style={tab === t
              ? { backgroundColor: 'var(--card)', color: 'var(--foreground)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
              : { color: 'var(--muted-foreground)' }
            }
          >
            {t.replace('_', ' ')}
            {counts[t] > 0 && <span className="ml-1 opacity-50">{counts[t]}</span>}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-16 text-sm" style={{ color: 'var(--muted-foreground)' }}>No subscriptions</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--cream)' }}>
                  {['User', 'Email', 'Plan', 'Status', 'Canceled On', 'Win-back'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr
                    key={r.id}
                    style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}
                    className="hover:bg-black/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: 'var(--foreground)' }}>{displayName(r)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>{r.email ?? '—'}</td>
                    <td className="px-4 py-3 text-xs capitalize" style={{ color: 'var(--muted-foreground)' }}>
                      {r.subscription_plan?.replace('_', ' ') ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-medium capitalize"
                        style={{ color: r.subscription_status === 'active' ? 'var(--primary)' : r.subscription_status === 'canceled' ? '#DC2626' : '#D97706' }}
                      >
                        {r.subscription_status === 'active' ? '●' : '✗'} {r.subscription_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>{fmtDate(r.cancelled_at)}</td>
                    <td className="px-4 py-3">
                      {r.win_back_sent
                        ? <span className="text-xs font-medium" style={{ color: '#D97706' }}>● Sent</span>
                        : <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>—</span>
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
