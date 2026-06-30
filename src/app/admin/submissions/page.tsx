'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Inbox, CheckCircle2, XCircle, Loader2, Clock, MapPin, ExternalLink } from 'lucide-react'
import { getSubmissions, approveSubmission, rejectSubmission, type SubmissionRow } from '../actions'

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  pending:  { bg: 'oklch(0.7 0.15 60 / 0.14)',  fg: '#B45309' },
  approved: { bg: 'oklch(0.36 0.07 145 / 0.12)', fg: 'var(--primary)' },
  rejected: { bg: 'oklch(0.62 0.2 25 / 0.1)',    fg: '#DC2626' },
}

export default function SubmissionsPage() {
  const [rows, setRows] = useState<SubmissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [adminEmail, setAdminEmail] = useState('')
  const [acting, setActing] = useState<string | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    getSubmissions().then(r => { setRows(r); setLoading(false) })
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setAdminEmail(session?.user.email ?? 'admin'))
    load()
  }, [load])

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3500)
  }

  async function approve(id: string) {
    setActing(id)
    const err = await approveSubmission(id, adminEmail)
    setActing(null)
    if (err) showToast(false, `Error: ${err}`)
    else { showToast(true, 'Published to the map'); load() }
  }

  async function confirmReject() {
    if (!rejectId) return
    setActing(rejectId)
    const err = await rejectSubmission(rejectId, rejectReason, adminEmail)
    setActing(null)
    setRejectId(null)
    setRejectReason('')
    if (err) showToast(false, `Error: ${err}`)
    else { showToast(true, 'Submission rejected'); load() }
  }

  const pending = rows.filter(r => r.status === 'pending')
  const others = rows.filter(r => r.status !== 'pending')

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold text-white ${toast.ok ? 'bg-emerald-600' : 'bg-red-500'}`}>
          {toast.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}{toast.msg}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Inbox size={20} style={{ color: 'var(--primary)' }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Submissions</h1>
        {pending.length > 0 && (
          <span className="ml-1 rounded-full px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: 'oklch(0.7 0.15 60 / 0.14)', color: '#B45309' }}>
            {pending.length} pending
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--muted-foreground)' }} /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm py-12 text-center" style={{ color: 'var(--muted-foreground)' }}>No submissions yet.</p>
      ) : (
        <div className="space-y-3 overflow-auto pr-1" style={{ height: 'calc(100vh - 200px)' }}>
          {[...pending, ...others].map(s => {
            const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.pending
            return (
              <div key={s.id} className="rounded-2xl border p-5" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>{s.name}</h2>
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium capitalize" style={{ backgroundColor: st.bg, color: st.fg }}>{s.status}</span>
                    </div>
                    <p className="text-sm mt-0.5 flex items-center gap-1" style={{ color: 'var(--muted-foreground)' }}>
                      <MapPin size={12} /> {[s.address, s.postal_code, s.city, s.country].filter(Boolean).join(', ') || '—'}
                    </p>
                  </div>
                  <p className="text-xs flex items-center gap-1" style={{ color: 'var(--muted-foreground)' }}><Clock size={12} /> {fmt(s.created_at)}</p>
                </div>

                {s.description && <p className="text-sm mt-3" style={{ color: 'var(--muted-foreground)' }}>{s.description}</p>}

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {s.submitter_email && <span>By: {s.submitter_email}</span>}
                  {s.phone && <span>📞 {s.phone}</span>}
                  {s.website && <span className="flex items-center gap-1">🌐 <a href={s.website} target="_blank" rel="noreferrer" className="underline">site <ExternalLink size={10} className="inline" /></a></span>}
                  {s.opening_hours && <span>🕒 {s.opening_hours}</span>}
                  {s.farm_type && s.farm_type.length > 0 && <span>Tags: {s.farm_type.join(', ')}</span>}
                </div>

                {s.image_urls.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {s.image_urls.map((u, i) => (
                      <img key={i} src={u} alt="" referrerPolicy="no-referrer" className="w-20 h-20 rounded-lg object-cover border" style={{ borderColor: 'var(--border)' }} />
                    ))}
                  </div>
                )}

                {s.status === 'rejected' && s.rejection_reason && (
                  <p className="mt-3 text-xs" style={{ color: '#DC2626' }}>Reason: {s.rejection_reason}</p>
                )}

                {s.status === 'pending' && (
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => approve(s.id)} disabled={acting === s.id}
                      className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: 'var(--primary)' }}>
                      {acting === s.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Approve & publish
                    </button>
                    <button onClick={() => setRejectId(s.id)} disabled={acting === s.id}
                      className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}>
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Reject modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setRejectId(null)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ backgroundColor: 'var(--card)' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>Reject submission</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="Reason (optional, shared with the submitter)"
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRejectId(null)} className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}>Cancel</button>
              <button onClick={confirmReject} className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-red-500">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
