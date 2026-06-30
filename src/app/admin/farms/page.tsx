'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { getFarmsAdmin, deleteFarm, type FarmAdminRow } from '../actions'
import DataTable, { type Column } from '../_components/DataTable'
import { Trash2, CheckCircle2, Pencil, Loader2, AlertCircle, CheckCheck, X } from 'lucide-react'

const TYPE_LABEL: Record<string, string> = {
  eggs: 'Eggs', dairy: 'Dairy', meat: 'Meat', fish: 'Fish',
  produce: 'Produce', cheese: 'Cheese', wine: 'Wine', markets: 'Markets',
}

export default function FarmsPage() {
  const [farms, setFarms] = useState<FarmAdminRow[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<FarmAdminRow | null>(null)
  const [acting, setActing] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  function showToast(ok: boolean, msg: string) { setToast({ ok, msg }); setTimeout(() => setToast(null), 3500) }

  const load = useCallback(async () => {
    setLoading(true)
    const result = await getFarmsAdmin()
    setFarms(result.farms)
    setPendingCount(result.pendingCount)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

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

  const columns: Column<FarmAdminRow>[] = [
    { key: 'name', header: 'Farm', sortValue: f => f.name,
      render: f => (
        <div>
          <p className="font-medium" style={{ color: 'var(--foreground)' }}>{f.name}</p>
          {f.city && <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{f.city}</p>}
        </div>
      ) },
    { key: 'type', header: 'Type', sortValue: f => f.farm_type ?? '',
      render: f => <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{f.farm_type ? (TYPE_LABEL[f.farm_type] ?? f.farm_type) : '—'}</span> },
    { key: 'country', header: 'Country', sortValue: f => f.country ?? '',
      render: f => <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{f.country ?? '—'}</span> },
    { key: 'claimed', header: 'Claimed', sortValue: f => (f.is_claimed ? 1 : 0),
      render: f => f.is_claimed
        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.1)', color: 'var(--primary)' }}><CheckCircle2 size={10} /> Claimed</span>
        : <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>—</span> },
    { key: 'actions', header: '', tdClass: 'text-right',
      render: f => (
        <div className="flex items-center gap-1.5 justify-end">
          <Link href={`/admin/farms/${encodeURIComponent(f.osm_id)}`} className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Edit farm">
            <Pencil size={14} />
          </Link>
          <button onClick={() => setDeleteTarget(f)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete farm">
            <Trash2 size={14} />
          </button>
        </div>
      ) },
  ]

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium ${toast.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {toast.ok ? <CheckCheck size={15} /> : <AlertCircle size={15} />}{toast.msg}
          <button onClick={() => setToast(null)} className="ml-1 opacity-60 hover:opacity-100"><X size={13} /></button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Farms</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Manage all farms on the platform</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total farms', value: farms.length, color: 'var(--foreground)' },
          { label: 'Claimed', value: claimedCount, color: 'var(--primary)' },
          { label: 'Pending claims', value: pendingCount, color: '#D97706' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      <DataTable
        rows={farms}
        columns={columns}
        rowKey={f => f.osm_id}
        loading={loading}
        searchText={f => `${f.name} ${f.city ?? ''} ${f.country ?? ''}`}
        searchPlaceholder="Search by name, city, or country…"
        emptyText="No farms found"
        defaultSort={{ key: 'name', dir: 'asc' }}
      />

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4"><Trash2 size={22} className="text-red-500" /></div>
            <h2 className="text-base font-bold text-gray-900 text-center mb-1">Delete farm?</h2>
            <p className="text-sm text-gray-500 text-center leading-relaxed mb-5">
              <span className="font-medium text-gray-700">{deleteTarget.name}</span> will be permanently removed. This cannot be undone.
            </p>
            <div className="flex gap-2.5">
              <button onClick={() => setDeleteTarget(null)} disabled={acting} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={confirmDelete} disabled={acting} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {acting && <Loader2 size={14} className="animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
