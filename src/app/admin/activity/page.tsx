'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, Loader2, Search } from 'lucide-react'
import { getActivityLog, type ActivityRow } from '../actions'

const CATEGORIES: { value: string; label: string; match: (t: string) => boolean }[] = [
  { value: 'all', label: 'All activity', match: () => true },
  { value: 'signup', label: 'Sign-ups', match: t => t === 'signup' },
  { value: 'billing', label: 'Subscriptions & payments', match: t => t.startsWith('subscription_') || t.startsWith('payment_') },
  { value: 'messages', label: 'Messages', match: t => t === 'contact_message' },
  { value: 'farms', label: 'Farms & claims', match: t => t.startsWith('submission_') || t.startsWith('claim_') || t.startsWith('farm_') },
]

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const TYPE_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  submission_created:  { label: 'Submission', bg: 'oklch(0.6 0.12 230 / 0.1)',  fg: '#2563EB' },
  submission_approved: { label: 'Published',  bg: 'oklch(0.36 0.07 145 / 0.12)', fg: 'var(--primary)' },
  submission_rejected: { label: 'Rejected',   bg: 'oklch(0.62 0.2 25 / 0.1)',    fg: '#DC2626' },
  claim_created:       { label: 'Claim',      bg: 'oklch(0.6 0.12 230 / 0.1)',  fg: '#2563EB' },
  claim_approved:      { label: 'Claim ✓',    bg: 'oklch(0.36 0.07 145 / 0.12)', fg: 'var(--primary)' },
  claim_rejected:      { label: 'Claim ✕',    bg: 'oklch(0.62 0.2 25 / 0.1)',    fg: '#DC2626' },
  farm_edited:         { label: 'Edit',       bg: 'var(--border)',               fg: 'var(--muted-foreground)' },
  farm_deleted:        { label: 'Deleted',    bg: 'oklch(0.62 0.2 25 / 0.1)',    fg: '#DC2626' },
  signup:              { label: 'Sign-up',    bg: 'oklch(0.6 0.12 230 / 0.1)',  fg: '#2563EB' },
  subscription_started:{ label: 'Subscribed', bg: 'oklch(0.36 0.07 145 / 0.12)', fg: 'var(--primary)' },
  subscription_cancelled:{ label: 'Cancelled',bg: 'oklch(0.62 0.2 25 / 0.1)',   fg: '#DC2626' },
  payment_succeeded:   { label: 'Payment',    bg: 'oklch(0.36 0.07 145 / 0.12)', fg: 'var(--primary)' },
  payment_failed:      { label: 'Payment ✕',  bg: 'oklch(0.62 0.2 25 / 0.1)',    fg: '#DC2626' },
  contact_message:     { label: 'Message',    bg: 'oklch(0.7 0.15 60 / 0.14)',   fg: '#B45309' },
}

export default function ActivityPage() {
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('all')

  useEffect(() => {
    getActivityLog().then(r => { setRows(r); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const visible = useMemo(() => {
    const matchCat = (CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[0]).match
    const q = search.trim().toLowerCase()
    return rows.filter(r =>
      matchCat(r.type) &&
      (q ? `${r.summary} ${r.actor ?? ''} ${r.type}`.toLowerCase().includes(q) : true),
    )
  }, [rows, cat, search])

  const selectStyle = { borderColor: 'var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity size={20} style={{ color: 'var(--primary)' }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Activity</h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search activity…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none" style={selectStyle} />
        </div>
        <select value={cat} onChange={e => setCat(e.target.value)} className="rounded-xl border px-3 py-2.5 text-sm outline-none" style={selectStyle}>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="overflow-auto" style={{ height: 'calc(100vh - 240px)' }}>
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin" style={{ color: 'var(--muted-foreground)' }} /></div>
          ) : visible.length === 0 ? (
            <p className="text-sm py-20 text-center" style={{ color: 'var(--muted-foreground)' }}>No activity matches your filters.</p>
          ) : (
            <ul>
              {visible.map((r, i) => {
                const t = TYPE_STYLE[r.type] ?? { label: r.type, bg: 'var(--border)', fg: 'var(--muted-foreground)' }
                return (
                  <li key={r.id} className="flex items-start gap-3 px-4 py-3" style={{ borderBottom: i < visible.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: t.bg, color: t.fg }}>{t.label}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm" style={{ color: 'var(--foreground)' }}>{r.summary}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{r.actor ?? 'system'} · {fmt(r.created_at)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
