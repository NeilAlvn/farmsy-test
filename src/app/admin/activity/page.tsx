'use client'

import { useEffect, useState } from 'react'
import { Activity, Loader2 } from 'lucide-react'
import { getActivityLog, type ActivityRow } from '../actions'

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

  useEffect(() => {
    getActivityLog().then(r => { setRows(r); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Activity size={20} style={{ color: 'var(--primary)' }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Activity</h1>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--muted-foreground)' }} /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm py-12 text-center" style={{ color: 'var(--muted-foreground)' }}>No activity recorded yet.</p>
        ) : (
          <ul className="block overflow-auto" style={{ maxHeight: 'calc(100vh - 240px)' }}>
            {rows.map((r, i) => {
              const t = TYPE_STYLE[r.type] ?? { label: r.type, bg: 'var(--border)', fg: 'var(--muted-foreground)' }
              return (
                <li key={r.id} className="flex items-start gap-3 px-4 py-3" style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
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
  )
}
