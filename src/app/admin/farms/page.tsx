'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { getFarmsAdmin, deleteFarm, type FarmAdminRow } from '../actions'
import {
  Search, Trash2, CheckCircle2, Pencil,
  Loader2, AlertCircle, CheckCheck, X,
} from 'lucide-react'

const TYPE_LABEL: Record<string, string> = {
  eggs: 'Eggs', dairy: 'Dairy', meat: 'Meat', fish: 'Fish',
  produce: 'Produce', cheese: 'Cheese', wine: 'Wine', markets: 'Markets',
}

export default function FarmsPage() {
  const [farms, setFarms] = useState<FarmAdminRow[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<FarmAdminRow | null>(null)
  const [acting, setActing] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const result = await getFarmsAdmin()
    setFarms(result.farms)
    setPendingCount(result.pendingCount)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = farms.filter(f => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      f.name.toLowerCase().includes(q) ||
      (f.city ?? '').toLowerCase().includes(q) ||
      (f.country ?? '').toLowerCase().includes(q)
    )
  })

  const claimedCount = farms.filter(f => f.is_claimed).length

  async function confirmDelete() {
    if (!deleteTarget) return
    setActing(true)
    const err = await deleteFarm(deleteTarget.osm_id)
    setActing(false)
    const target = deleteTarget
    setDeleteTarget(null)
    if (err) showToast(false, `Error: ${err}`)
    else { showToast(true, `${target.name} deleted`); load() }
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
      <div>
        <h1 className="text-xl font-bold text-gray-900">Farms</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage all farms on the platform</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total farms',    value: farms.length,  color: 'text-gray-900' },
          { label: 'Claimed',        value: claimedCount,  color: 'text-emerald-600' },
          { label: 'Pending claims', value: pendingCount,  color: 'text-yellow-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, city, or country…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-gray-400">
            {search ? 'No farms match your search' : 'No farms found'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Farm</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Country</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Claimed</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(farm => (
                  <tr key={farm.osm_id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{farm.name}</p>
                      {farm.city && <p className="text-xs text-gray-400 mt-0.5">{farm.city}</p>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-gray-500">
                        {farm.farm_type ? (TYPE_LABEL[farm.farm_type] ?? farm.farm_type) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-gray-500">{farm.country ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {farm.is_claimed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                          <CheckCircle2 size={10} />
                          Claimed
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        <Link
                          href={`/admin/farms/${encodeURIComponent(farm.osm_id)}`}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title="Edit farm"
                        >
                          <Pencil size={14} />
                        </Link>
                        <button
                          onClick={() => setDeleteTarget(farm)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete farm"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">
              Showing {filtered.length} of {farms.length} farms
            </div>
          </div>
        )}
      </div>

      {/* Delete modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h2 className="text-base font-bold text-gray-900 text-center mb-1">Delete farm?</h2>
            <p className="text-sm text-gray-500 text-center leading-relaxed mb-5">
              <span className="font-medium text-gray-700">{deleteTarget.name}</span> will be permanently removed.
              This cannot be undone.
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={acting}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={acting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {acting && <Loader2 size={14} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
