'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  Loader2, Save, ChevronLeft, CheckCircle2, AlertCircle, Upload, Trash2, Star, ExternalLink,
} from 'lucide-react'
import {
  getFarmForAdmin, adminUpdateFarm, adminAddFarmImage, adminDeleteFarmImage, adminSetFarmCover, deleteFarm,
  type AdminFarmDetail, type AdminFarmImage, type AdminFarmFields,
} from '../../actions'

const FARM_TYPES = ['eggs', 'dairy', 'meat', 'fish', 'produce', 'cheese', 'wine', 'markets', 'honey', 'organic']

const inputClass = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors bg-white'
const labelClass = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5'

function decodeOsmId(raw: string): string {
  try { return decodeURIComponent(raw) } catch { return raw }
}

export default function AdminFarmEditor() {
  const rawOsmId = useParams().osmId as string
  const osmId = decodeOsmId(rawOsmId)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [actor, setActor] = useState('admin')
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [cover, setCover] = useState<string | null>(null)
  const [images, setImages] = useState<AdminFarmImage[]>([])

  const [f, setF] = useState<AdminFarmFields>({
    name: '', description: '', phone: '', website: '', email: '',
    address: '', city: '', postal_code: '', country: '',
    farm_type: [], opening_hours: '', is_published: true,
  })

  function showToast(ok: boolean, msg: string) { setToast({ ok, msg }); setTimeout(() => setToast(null), 3500) }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setActor(session?.user.email ?? 'admin'))
    getFarmForAdmin(osmId).then((d: AdminFarmDetail | null) => {
      if (!d) { setNotFound(true); setLoading(false); return }
      setF({
        name: d.name ?? '', description: d.description ?? '', phone: d.phone ?? '',
        website: d.website ?? '', email: d.email ?? '', address: d.address ?? '',
        city: d.city ?? '', postal_code: d.postal_code ?? '', country: d.country ?? '',
        farm_type: d.farm_type ?? [], opening_hours: d.opening_hours ?? '',
        is_published: d.is_published ?? true,
      })
      setCover(d.image)
      setImages(d.images)
      setLoading(false)
    })
  }, [osmId])

  async function save() {
    setSaving(true)
    const err = await adminUpdateFarm(osmId, f, actor)
    setSaving(false)
    showToast(!err, err ? `Error: ${err}` : 'Saved')
  }

  async function addImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('image', file)
    const res = await adminAddFarmImage(osmId, fd, actor)
    setUploading(false)
    if (res.error) { showToast(false, `Error: ${res.error}`); return }
    if (res.image) {
      setImages(prev => [...prev, res.image!])
      setCover(c => c ?? res.image!.url)
      showToast(true, 'Photo added')
    }
  }

  async function removeImage(img: AdminFarmImage) {
    const err = await adminDeleteFarmImage(img.id, osmId, actor)
    if (err) { showToast(false, `Error: ${err}`); return }
    setImages(prev => prev.filter(i => i.id !== img.id))
    showToast(true, 'Photo removed')
  }

  async function makeCover(url: string) {
    const err = await adminSetFarmCover(osmId, url, actor)
    if (err) { showToast(false, `Error: ${err}`); return }
    setCover(url)
    showToast(true, 'Cover updated')
  }

  async function doDelete() {
    setDeleting(true)
    const err = await deleteFarm(osmId, actor)
    if (err) { setDeleting(false); setConfirmDel(false); showToast(false, `Error: ${err}`); return }
    router.push('/admin/farms')
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" style={{ color: 'var(--muted-foreground)' }} /></div>
  if (notFound) return (
    <div className="text-center py-20">
      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Farm not found.</p>
      <Link href="/admin/farms" className="text-sm text-emerald-600 hover:underline mt-2 inline-block">Back to farms</Link>
    </div>
  )

  return (
    <div className="max-w-2xl space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold text-white ${toast.ok ? 'bg-emerald-600' : 'bg-red-500'}`}>
          {toast.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}{toast.msg}
        </div>
      )}

      <div>
        <Link href="/admin/farms" className="inline-flex items-center gap-1.5 text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}><ChevronLeft size={14} /> Farms</Link>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>{f.name || 'Edit farm'}</h1>
          <Link href={`/map?id=${encodeURIComponent(osmId)}`} target="_blank" className="text-xs inline-flex items-center gap-1" style={{ color: 'var(--primary)' }}>View on map <ExternalLink size={11} /></Link>
        </div>
      </div>

      {/* Details */}
      <div className="rounded-2xl border p-6 space-y-5" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        {/* Publish toggle */}
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Published (visible on map)</span>
          <button type="button" onClick={() => setF(s => ({ ...s, is_published: !s.is_published }))}
            className={`relative w-11 h-6 rounded-full transition-colors ${f.is_published ? 'bg-emerald-500' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${f.is_published ? 'left-5' : 'left-0.5'}`} />
          </button>
        </label>

        <div><label className={labelClass}>Name</label><input value={f.name} onChange={e => setF(s => ({ ...s, name: e.target.value }))} className={inputClass} /></div>
        <div><label className={labelClass}>Description</label><textarea rows={3} value={f.description} onChange={e => setF(s => ({ ...s, description: e.target.value }))} className={`${inputClass} resize-none`} /></div>

        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelClass}>Phone</label><input value={f.phone} onChange={e => setF(s => ({ ...s, phone: e.target.value }))} className={inputClass} /></div>
          <div><label className={labelClass}>Email</label><input value={f.email} onChange={e => setF(s => ({ ...s, email: e.target.value }))} className={inputClass} /></div>
        </div>
        <div><label className={labelClass}>Website</label><input value={f.website} onChange={e => setF(s => ({ ...s, website: e.target.value }))} className={inputClass} /></div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2"><label className={labelClass}>Address</label><input value={f.address} onChange={e => setF(s => ({ ...s, address: e.target.value }))} className={inputClass} /></div>
          <div><label className={labelClass}>Postal</label><input value={f.postal_code} onChange={e => setF(s => ({ ...s, postal_code: e.target.value }))} className={inputClass} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelClass}>City</label><input value={f.city} onChange={e => setF(s => ({ ...s, city: e.target.value }))} className={inputClass} /></div>
          <div><label className={labelClass}>Country</label><input value={f.country} onChange={e => setF(s => ({ ...s, country: e.target.value }))} className={inputClass} /></div>
        </div>

        <div>
          <label className={labelClass}>Farm types</label>
          <div className="flex flex-wrap gap-2">
            {FARM_TYPES.map(id => {
              const active = f.farm_type.includes(id)
              return (
                <button key={id} type="button"
                  onClick={() => setF(s => ({ ...s, farm_type: active ? s.farm_type.filter(t => t !== id) : [...s.farm_type, id] }))}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold border capitalize transition-all ${active ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-200 text-gray-600'}`}>
                  {id}
                </button>
              )
            })}
          </div>
        </div>

        <div><label className={labelClass}>Opening hours (raw)</label><input value={f.opening_hours} onChange={e => setF(s => ({ ...s, opening_hours: e.target.value }))} placeholder="Mo-Sa 09:00-17:00" className={inputClass} /></div>

        <div className="flex justify-end">
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ backgroundColor: 'var(--primary)' }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save details
          </button>
        </div>
      </div>

      {/* Gallery */}
      <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <h2 className="text-base font-bold mb-4" style={{ color: 'var(--foreground)' }}>Photos</h2>
        <div className="flex flex-wrap gap-3">
          {images.map(img => (
            <div key={img.id} className="relative w-24 h-24 rounded-xl overflow-hidden border" style={{ borderColor: cover === img.url ? 'var(--primary)' : 'var(--border)' }}>
              <img src={img.url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              {cover === img.url && <span className="absolute top-1 left-1 rounded-full bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 font-bold">Cover</span>}
              <div className="absolute bottom-1 right-1 flex gap-1">
                {cover !== img.url && <button onClick={() => makeCover(img.url)} title="Make cover" className="w-6 h-6 rounded-full bg-white shadow flex items-center justify-center"><Star size={11} className="text-gray-600" /></button>}
                <button onClick={() => removeImage(img)} title="Remove" className="w-6 h-6 rounded-full bg-white shadow flex items-center justify-center"><Trash2 size={11} className="text-red-500" /></button>
              </div>
            </div>
          ))}
          <label className="w-24 h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer" style={{ borderColor: 'var(--border)' }}>
            {uploading ? <Loader2 size={18} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} /> : <Upload size={18} style={{ color: 'var(--muted-foreground)' }} />}
            <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Add</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={addImage} disabled={uploading} />
          </label>
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl border p-6 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'oklch(0.62 0.2 25 / 0.3)', backgroundColor: 'oklch(0.62 0.2 25 / 0.04)' }}>
        <div>
          <p className="text-sm font-bold" style={{ color: '#DC2626' }}>Delete this farm</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Removes the listing and its photos from the map. This can&apos;t be undone.</p>
        </div>
        <button onClick={() => setConfirmDel(true)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700">
          <Trash2 size={14} /> Delete farm
        </button>
      </div>

      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => !deleting && setConfirmDel(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: 'var(--card)' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-center mb-1" style={{ color: 'var(--foreground)' }}>Delete {f.name}?</h3>
            <p className="text-sm text-center mb-5" style={{ color: 'var(--muted-foreground)' }}>The listing and its photos will be permanently removed from the map.</p>
            <div className="flex gap-2.5">
              <button onClick={() => setConfirmDel(false)} disabled={deleting} className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}>Cancel</button>
              <button onClick={doDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2">
                {deleting && <Loader2 size={14} className="animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
