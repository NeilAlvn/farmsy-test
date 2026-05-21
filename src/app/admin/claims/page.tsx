'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getClaims, approveClaim, rejectClaim, type ClaimRow } from '../actions'
import {
  Clock, CheckCircle2, XCircle, Loader2,
  CheckCheck, AlertCircle, Mail, Phone, X,
} from 'lucide-react'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_CLASS: Record<string, string> = {
  pending:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending:  <Clock size={11} />,
  approved: <CheckCircle2 size={11} />,
  rejected: <XCircle size={11} />,
}

const TABS = ['all', 'pending', 'approved', 'rejected'] as const
type Tab = typeof TABS[number]

export default function ClaimsPage() {
  const [claims, setClaims] = useState<ClaimRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('pending')
  const [userId, setUserId] = useState('')

  const [approveTarget, setApproveTarget] = useState<ClaimRow | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ClaimRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [acting, setActing] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setClaims(await getClaims())
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUserId(session.user.id)
    })
    load()
  }, [load])

  const counts = {
    all:      claims.length,
    pending:  claims.filter(c => c.status === 'pending').length,
    approved: claims.filter(c => c.status === 'approved').length,
    rejected: claims.filter(c => c.status === 'rejected').length,
  }
  const filtered = tab === 'all' ? claims : claims.filter(c => c.status === tab)

  async function confirmApprove() {
    if (!approveTarget) return
    setActing(true)
    const err = await approveClaim(approveTarget.id, approveTarget.farm_osm_id, userId)
    setActing(false)
    const target = approveTarget
    setApproveTarget(null)
    if (err) showToast(false, `Error: ${err}`)
    else { showToast(true, `${target.farm_name} approved`); load() }
  }

  async function confirmReject() {
    if (!rejectTarget) return
    setActing(true)
    const err = await rejectClaim(rejectTarget.id, rejectReason, userId)
    setActing(false)
    setRejectTarget(null)
    setRejectReason('')
    if (err) showToast(false, `Error: ${err}`)
    else { showToast(true, 'Claim rejected'); load() }
  }

  return (
    <div className="space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium ${
          toast.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {toast.ok ? <CheckCheck size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-1 opacity-60 hover:opacity-100">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Claims</h1>
          <p className="text-sm text-gray-400 mt-0.5">Review and manage farm ownership requests</p>
        </div>
        {counts.pending > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold">
            {counts.pending} pending
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
              tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}{counts[t] > 0 && <span className="ml-1 opacity-50">{counts[t]}</span>}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-gray-400">
            No {tab === 'all' ? '' : tab} claims
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {['Farm', 'Claimant', 'Contact', 'Method', 'Status', 'Date', ''].map((h, i) => (
                    <th
                      key={i}
                      className={`text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${
                        i === 2 ? 'hidden md:table-cell' : i === 3 || i === 5 ? 'hidden lg:table-cell' : ''
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(claim => (
                  <tr key={claim.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{claim.farm_name}</span>
                      {claim.farm_city && (
                        <p className="text-xs text-gray-400 mt-0.5">{claim.farm_city}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{claim.full_name}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="space-y-0.5">
                        <a
                          href={`mailto:${claim.email}`}
                          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
                        >
                          <Mail size={11} className="text-gray-400 shrink-0" />
                          {claim.email}
                        </a>
                        <a
                          href={`tel:${claim.phone}`}
                          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
                        >
                          <Phone size={11} className="text-gray-400 shrink-0" />
                          {claim.phone}
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-gray-600 capitalize">{claim.verification_method}</span>
                      {claim.kvk_number && (
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{claim.kvk_number}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-semibold capitalize ${STATUS_CLASS[claim.status]}`}>
                        {STATUS_ICON[claim.status]}
                        {claim.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(claim.created_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {claim.status === 'pending' && (
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => setApproveTarget(claim)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => { setRejectTarget(claim); setRejectReason('') }}
                            className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors whitespace-nowrap"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approve modal */}
      {approveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={22} className="text-emerald-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900 text-center mb-1">Approve claim?</h2>
            <p className="text-sm text-gray-500 text-center leading-relaxed mb-5">
              <span className="font-medium text-gray-700">{approveTarget.farm_name}</span> will be marked as claimed
              and {approveTarget.full_name} will be the verified owner.
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setApproveTarget(null)}
                disabled={acting}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmApprove}
                disabled={acting}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {acting && <Loader2 size={14} className="animate-spin" />}
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle size={22} className="text-red-500" />
            </div>
            <h2 className="text-base font-bold text-gray-900 text-center mb-1">Reject claim?</h2>
            <p className="text-sm text-gray-500 text-center leading-relaxed mb-4">
              Rejecting the claim for <span className="font-medium text-gray-700">{rejectTarget.farm_name}</span>.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Reason for rejection (optional)"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 resize-none mb-4 transition-colors"
            />
            <div className="flex gap-2.5">
              <button
                onClick={() => setRejectTarget(null)}
                disabled={acting}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={acting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {acting && <Loader2 size={14} className="animate-spin" />}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
