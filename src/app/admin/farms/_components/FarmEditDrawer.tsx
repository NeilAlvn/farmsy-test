'use client'

import { useEffect, useState } from 'react'
import { Loader2, X, Save, Upload, Trash2, Star, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/app/_components/ToastProvider'
import {
  getFarmForAdmin, adminUpdateFarm, adminAddFarmImage, adminDeleteFarmImage, adminSetFarmCover, deleteFarm,
  type AdminFarmDetail, type AdminFarmImage, type AdminFarmFields,
} from '../../actions'

const FARM_TYPES = ['eggs', 'dairy', 'meat', 'fish', 'produce', 'cheese', 'wine', 'markets', 'honey', 'organic']

const inputClass = 'w-full px-3 py-2 rounded-xl text-sm focus:outline-none'
const inputStyle = { backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' } as const
const labelClass = 'block text-sm font-medium mb-1.5'

export default function FarmEditDrawer({
  osmId, onClose, onSaved,
}: {
  osmId: string
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [actor, setActor] = useState('admin')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [cover, setCover] = useState<string | null>(null)
  const [images, setImages] = useState<AdminFarmImage[]>([])
  const [f, setF] = useState<AdminFarmFields>({
    name: '', description: '', phone: '', website: '', email: '',
    address: '', city: '', postal_code: '', country: '',
    farm_type: [], opening_hours: '', is_published: true,
  })

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data: { session } }) => { if (active) setActor(session?.user.email ?? 'admin') })
    setLoading(true); setNotFound(false)
    getFarmForAdmin(osmId).then((d: AdminFarmDetail | null) => {
      if (!active) return
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
    return () => { active = false }
  }, [osmId])

  async function save() {
    setSaving(true)
    const err = await adminUpdateFarm(osmId, f, actor)
    setSaving(false)
    if (err) { toast({ type: 'error', title: `Error: ${err}` }); return }
    toast({ type: 'success', title: 'Farm saved' })
    onSaved()
  }

  async function addImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setUploading(true)
    const fd = new FormData(); fd.append('image', file)
    const res = await adminAddFarmImage(osmId, fd, actor)
    setUploading(false)
    if (res.error) { toast({ type: 'error', title: `Error: ${res.error}` }); return }
    if (res.image) { setImages(prev => [...prev, res.image!]); setCover(c => c ?? res.image!.url); onSaved() }
  }

  async function removeImage(img: AdminFarmImage) {
    const err = await adminDeleteFarmImage(img.id, osmId, actor)
    if (err) { toast({ type: 'error', title: `Error: ${err}` }); return }
    setImages(prev => prev.filter(i => i.id !== img.id)); onSaved()
  }

  async function makeCover(url: string) {
    const err = await adminSetFarmCover(osmId, url, actor)
    if (err) { toast({ type: 'error', title: `Error: ${err}` }); return }
    setCover(url); onSaved()
  }

  async function doDelete() {
    setDeleting(true)
    const err = await deleteFarm(osmId, actor)
    if (err) { setDeleting(false); setConfirmDel(false); toast({ type: 'error', title: `Error: ${err}` }); return }
    toast({ type: 'success', title: 'Farm deleted' })
    onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="relative w-full max-w-lg h-full overflow-y-auto shadow-2xl flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4" style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
          <div className="min-w-0">
            <h2 className="text-base font-bold truncate" style={{ color: 'var(--foreground)' }}>{loading ? 'Edit farm' : (f.name || 'Edit farm')}</h2>
            <Link href={`/map?id=${encodeURIComponent(osmId)}`} target="_blank" className="text-[11px] inline-flex items-center gap-1" style={{ color: 'var(--primary)' }}>View on map <ExternalLink size={10} /></Link>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/[0.05] transition-colors"><X size={18} style={{ color: 'var(--muted-foreground)' }} /></button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 size={20} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} /></div>
        ) : notFound ? (
          <p className="p-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>Farm not found.</p>
        ) : (
          <>
            <div className="flex-1 px-6 py-5 space-y-5">
              {/* Publish */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Published (visible on map)</span>
                <button type="button" onClick={() => setF(s => ({ ...s, is_published: !s.is_published }))} className="relative w-11 h-6 rounded-full transition-colors" style={{ backgroundColor: f.is_published ? 'var(--primary)' : 'var(--border)' }}>
                  <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform" style={{ transform: f.is_published ? 'translateX(20px)' : 'none' }} />
                </button>
              </label>

              <div><label className={labelClass} style={{ color: 'var(--foreground)' }}>Name</label><input value={f.name} onChange={e => setF(s => ({ ...s, name: e.target.value }))} className={inputClass} style={inputStyle} /></div>
              <div><label className={labelClass} style={{ color: 'var(--foreground)' }}>Description</label><textarea rows={3} value={f.description} onChange={e => setF(s => ({ ...s, description: e.target.value }))} className={`${inputClass} resize-none`} style={inputStyle} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelClass} style={{ color: 'var(--foreground)' }}>Phone</label><input value={f.phone} onChange={e => setF(s => ({ ...s, phone: e.target.value }))} className={inputClass} style={inputStyle} /></div>
                <div><label className={labelClass} style={{ color: 'var(--foreground)' }}>Email</label><input value={f.email} onChange={e => setF(s => ({ ...s, email: e.target.value }))} className={inputClass} style={inputStyle} /></div>
              </div>
              <div><label className={labelClass} style={{ color: 'var(--foreground)' }}>Website</label><input value={f.website} onChange={e => setF(s => ({ ...s, website: e.target.value }))} className={inputClass} style={inputStyle} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2"><label className={labelClass} style={{ color: 'var(--foreground)' }}>Address</label><input value={f.address} onChange={e => setF(s => ({ ...s, address: e.target.value }))} className={inputClass} style={inputStyle} /></div>
                <div><label className={labelClass} style={{ color: 'var(--foreground)' }}>Postal</label><input value={f.postal_code} onChange={e => setF(s => ({ ...s, postal_code: e.target.value }))} className={inputClass} style={inputStyle} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelClass} style={{ color: 'var(--foreground)' }}>City</label><input value={f.city} onChange={e => setF(s => ({ ...s, city: e.target.value }))} className={inputClass} style={inputStyle} /></div>
                <div><label className={labelClass} style={{ color: 'var(--foreground)' }}>Country</label><input value={f.country} onChange={e => setF(s => ({ ...s, country: e.target.value }))} className={inputClass} style={inputStyle} /></div>
              </div>

              <div>
                <label className={labelClass} style={{ color: 'var(--foreground)' }}>Farm types</label>
                <div className="flex flex-wrap gap-2">
                  {FARM_TYPES.map(id => {
                    const active = f.farm_type.includes(id)
                    return (
                      <button key={id} type="button" onClick={() => setF(s => ({ ...s, farm_type: active ? s.farm_type.filter(t => t !== id) : [...s.farm_type, id] }))}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold border capitalize transition-all"
                        style={active ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)', color: 'var(--primary-foreground)' } : { backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
                        {id}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div><label className={labelClass} style={{ color: 'var(--foreground)' }}>Opening hours (raw)</label><input value={f.opening_hours} onChange={e => setF(s => ({ ...s, opening_hours: e.target.value }))} placeholder="Mo-Sa 09:00-17:00" className={inputClass} style={inputStyle} /></div>

              {/* Gallery */}
              <div>
                <label className={labelClass} style={{ color: 'var(--foreground)' }}>Photos</label>
                <div className="flex flex-wrap gap-2">
                  {images.map(img => (
                    <div key={img.id} className="relative w-20 h-20 rounded-xl overflow-hidden border-2" style={{ borderColor: cover === img.url ? 'var(--primary)' : 'var(--border)' }}>
                      <img src={img.url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      {cover === img.url && <span className="absolute top-1 left-1 rounded-full bg-emerald-600 text-white text-[8px] px-1 py-0.5 font-bold">Cover</span>}
                      <div className="absolute bottom-1 right-1 flex gap-1">
                        {cover !== img.url && <button onClick={() => makeCover(img.url)} title="Make cover" className="w-5 h-5 rounded-full bg-white shadow flex items-center justify-center"><Star size={10} className="text-gray-600" /></button>}
                        <button onClick={() => removeImage(img)} title="Remove" className="w-5 h-5 rounded-full bg-white shadow flex items-center justify-center"><Trash2 size={10} className="text-red-500" /></button>
                      </div>
                    </div>
                  ))}
                  <label className="w-20 h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer" style={{ borderColor: 'var(--border)' }}>
                    {uploading ? <Loader2 size={16} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} /> : <Upload size={16} style={{ color: 'var(--muted-foreground)' }} />}
                    <span className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>Add</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={addImage} disabled={uploading} />
                  </label>
                </div>
              </div>

              {/* Danger */}
              <div className="pt-2">
                {!confirmDel ? (
                  <button onClick={() => setConfirmDel(true)} className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: '#DC2626' }}><Trash2 size={14} /> Delete farm</button>
                ) : (
                  <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: 'oklch(0.62 0.2 25 / 0.3)', backgroundColor: 'oklch(0.62 0.2 25 / 0.04)' }}>
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>Delete <strong>{f.name}</strong> and its photos? This can&apos;t be undone.</p>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmDel(false)} disabled={deleting} className="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}>Cancel</button>
                      <button onClick={doDelete} disabled={deleting} className="flex-1 py-2 rounded-xl text-sm font-bold text-white bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2">{deleting && <Loader2 size={14} className="animate-spin" />} Delete</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 px-6 py-4" style={{ backgroundColor: 'var(--card)', borderTop: '1px solid var(--border)' }}>
              <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: 'var(--primary)' }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save changes
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
