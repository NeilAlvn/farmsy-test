'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, ChevronLeft, Save, CheckCircle2, AlertCircle,
  Camera, Clock, Pencil, Upload, Link as LinkIcon, X,
  Wheat,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ContentLayout from '@/app/_components/ContentLayout'
import {
  updateFarmDetails, updateFarmHours, uploadFarmImage, updateFarmImageUrl,
  type FarmDetails,
} from '../actions'

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'details' | 'photos' | 'hours'
type DayKey = 'Mo' | 'Tu' | 'We' | 'Th' | 'Fr' | 'Sa' | 'Su'
interface DaySchedule { closed: boolean; from: string; to: string }
type WeekSchedule = Record<DayKey, DaySchedule>

interface FarmData {
  osm_id: string
  name: string
  description: string | null
  phone: string | null
  website: string | null
  email: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  farm_type: string[] | null
  image: string | null
  opening_hours: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'Mo', label: 'Monday' },
  { key: 'Tu', label: 'Tuesday' },
  { key: 'We', label: 'Wednesday' },
  { key: 'Th', label: 'Thursday' },
  { key: 'Fr', label: 'Friday' },
  { key: 'Sa', label: 'Saturday' },
  { key: 'Su', label: 'Sunday' },
]

const FARM_TYPES = [
  { id: 'eggs',    label: 'Eggs' },
  { id: 'dairy',   label: 'Dairy' },
  { id: 'meat',    label: 'Meat' },
  { id: 'fish',    label: 'Fish' },
  { id: 'produce', label: 'Produce' },
  { id: 'cheese',  label: 'Cheese' },
  { id: 'wine',    label: 'Wine' },
  { id: 'markets', label: 'Markets' },
  { id: 'honey',   label: 'Honey' },
  { id: 'organic', label: 'Organic' },
]

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
})

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 ' +
  'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ' +
  'focus:border-emerald-500 transition-colors bg-white'

// ── Hours helpers ─────────────────────────────────────────────────────────────

function defaultSchedule(): WeekSchedule {
  return Object.fromEntries(
    DAYS.map(d => [d.key, { closed: true, from: '09:00', to: '17:00' }])
  ) as WeekSchedule
}

function parseHours(raw: string | null): WeekSchedule {
  const schedule = defaultSchedule()
  if (!raw) return schedule

  const s = raw.trim()
  if (s === '24/7') {
    return Object.fromEntries(
      DAYS.map(d => [d.key, { closed: false, from: '00:00', to: '24:00' }])
    ) as WeekSchedule
  }

  const DAY_KEYS = DAYS.map(d => d.key)

  for (const seg of s.split(';')) {
    const t = seg.trim()
    if (!t) continue
    const isOff = /\boff\b/i.test(t)
    const timeMatch = t.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/)
    const from = timeMatch?.[1] ?? '09:00'
    const to   = timeMatch?.[2] ?? '17:00'
    const dayStr = timeMatch ? t.slice(0, t.indexOf(timeMatch[0])).trim() : t

    for (const group of dayStr.split(',')) {
      const g = group.trim()
      if (g.includes('-')) {
        const [a, b] = g.split('-')
        const ai = DAY_KEYS.indexOf(a as DayKey)
        const bi = DAY_KEYS.indexOf(b as DayKey)
        if (ai < 0 || bi < 0) continue
        const range = ai <= bi
          ? DAY_KEYS.slice(ai, bi + 1)
          : [...DAY_KEYS.slice(ai), ...DAY_KEYS.slice(0, bi + 1)]
        for (const day of range) schedule[day as DayKey] = { closed: isOff, from, to }
      } else {
        if (DAY_KEYS.includes(g as DayKey)) {
          schedule[g as DayKey] = { closed: isOff, from, to }
        }
      }
    }
  }

  return schedule
}

function serializeHours(schedule: WeekSchedule): string {
  const DAY_KEYS = DAYS.map(d => d.key)
  const openDays = DAY_KEYS.filter(d => !schedule[d as DayKey].closed)
  if (openDays.length === 0) return ''

  const segments: string[] = []
  let i = 0
  while (i < openDays.length) {
    const startDay = openDays[i] as DayKey
    const { from, to } = schedule[startDay]
    let j = i + 1
    while (j < openDays.length) {
      const prevIdx = DAY_KEYS.indexOf(openDays[j - 1] as DayKey)
      const curIdx  = DAY_KEYS.indexOf(openDays[j] as DayKey)
      if (curIdx !== prevIdx + 1) break
      const cur = schedule[openDays[j] as DayKey]
      if (cur.from !== from || cur.to !== to) break
      j++
    }
    const endDay = openDays[j - 1] as DayKey
    segments.push(startDay === endDay ? `${startDay} ${from}-${to}` : `${startDay}-${endDay} ${from}-${to}`)
    i = j
  }
  return segments.join('; ')
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FarmEditorPage() {
  const router = useRouter()
  const params = useParams()
  const osmId = params.osmId as string

  const [userId, setUserId]     = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [farm, setFarm]         = useState<FarmData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<Tab>('details')
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // ── Details form
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [phone, setPhone]             = useState('')
  const [website, setWebsite]         = useState('')
  const [email, setEmail]             = useState('')
  const [address, setAddress]         = useState('')
  const [city, setCity]               = useState('')
  const [postalCode, setPostalCode]   = useState('')
  const [farmTypes, setFarmTypes]     = useState<Set<string>>(new Set())
  const [savingDetails, setSavingDetails] = useState(false)

  // ── Photos form
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [imageUrl, setImageUrl]         = useState('')
  const [uploadFile, setUploadFile]     = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [photoMode, setPhotoMode]       = useState<'url' | 'upload'>('upload')
  const [savingPhoto, setSavingPhoto]   = useState(false)

  // ── Hours form
  const [schedule, setSchedule]   = useState<WeekSchedule>(defaultSchedule())
  const [savingHours, setSavingHours] = useState(false)

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/auth/signin?redirect=/dashboard')
        return
      }

      setUserId(session.user.id)
      setUserEmail(session.user.email ?? '')

      // Verify claim
      const { data: claim } = await supabase
        .from('farm_claims')
        .select('id')
        .eq('farm_osm_id', osmId)
        .eq('status', 'approved')
        .or(`user_id.eq.${session.user.id},email.eq.${session.user.email}`)
        .maybeSingle()

      if (!claim) {
        router.replace('/dashboard')
        return
      }

      const { data } = await supabase
        .from('farms')
        .select('osm_id, name, description, phone, website, email, address, city, postal_code, farm_type, image, opening_hours')
        .eq('osm_id', osmId)
        .maybeSingle()

      if (data) {
        const f = data as FarmData
        setFarm(f)
        setName(f.name ?? '')
        setDescription(f.description ?? '')
        setPhone(f.phone ?? '')
        setWebsite(f.website ?? '')
        setEmail(f.email ?? '')
        setAddress(f.address ?? '')
        setCity(f.city ?? '')
        setPostalCode(f.postal_code ?? '')
        setFarmTypes(new Set(f.farm_type ?? []))
        setCurrentImage(f.image)
        setSchedule(parseHours(f.opening_hours))
      }

      setLoading(false)
    })
  }, [osmId, router])

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(msg: string, ok = true) {
    clearTimeout(toastTimer.current)
    setToast({ msg, ok })
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  // ── Saves ─────────────────────────────────────────────────────────────────

  async function saveDetails() {
    setSavingDetails(true)
    const details: FarmDetails = {
      name, description, phone, website, email,
      address, city, postal_code: postalCode,
      farm_type: [...farmTypes],
    }
    const err = await updateFarmDetails(osmId, userId, userEmail, details)
    setSavingDetails(false)
    if (err) showToast(`Error: ${err}`, false)
    else { setFarm(f => f ? { ...f, ...details, farm_type: [...farmTypes] } : f); showToast('Details saved!') }
  }

  async function savePhoto() {
    setSavingPhoto(true)
    let err: string | null = null

    if (photoMode === 'upload' && uploadFile) {
      const fd = new FormData()
      fd.append('image', uploadFile)
      const result = await uploadFarmImage(osmId, userId, userEmail, fd)
      if (result.error) err = result.error
      else if (result.url) { setCurrentImage(result.url); setFarm(f => f ? { ...f, image: result.url! } : f) }
    } else if (photoMode === 'url' && imageUrl) {
      err = await updateFarmImageUrl(osmId, userId, userEmail, imageUrl)
      if (!err) { setCurrentImage(imageUrl); setFarm(f => f ? { ...f, image: imageUrl } : f) }
    }

    setSavingPhoto(false)
    if (err) showToast(`Error: ${err}`, false)
    else { setUploadFile(null); setUploadPreview(null); setImageUrl(''); showToast('Photo updated!') }
  }

  async function saveHours() {
    setSavingHours(true)
    const hours = serializeHours(schedule)
    const err = await updateFarmHours(osmId, userId, userEmail, hours)
    setSavingHours(false)
    if (err) showToast(`Error: ${err}`, false)
    else { setFarm(f => f ? { ...f, opening_hours: hours } : f); showToast('Hours saved!') }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <ContentLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 size={22} className="animate-spin text-gray-300" />
        </div>
      </ContentLayout>
    )
  }

  if (!farm) {
    return (
      <ContentLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
          <p className="text-gray-400">Farm not found.</p>
          <Link href="/dashboard" className="mt-4 text-sm text-emerald-600 hover:underline">Back to dashboard</Link>
        </div>
      </ContentLayout>
    )
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'details', label: 'Details',  icon: Pencil },
    { id: 'photos',  label: 'Photos',   icon: Camera },
    { id: 'hours',   label: 'Hours',    icon: Clock  },
  ]

  return (
    <ContentLayout>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold transition-all ${
          toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.ok
            ? <CheckCircle2 size={15} />
            : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-3">
            <ChevronLeft size={14} />
            Dashboard
          </Link>
          <div className="flex items-center gap-3">
            {currentImage ? (
              <img src={currentImage} alt="" referrerPolicy="no-referrer" className="w-10 h-10 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                <Wheat size={18} className="text-gray-300" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-none">{farm.name}</h1>
              {farm.city && <p className="text-sm text-gray-400 mt-0.5">{farm.city}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-4">
        <div className="max-w-3xl mx-auto flex gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                tab === id
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="py-8 px-4 bg-gray-50 min-h-[60vh]">
        <div className="max-w-3xl mx-auto">

          {/* ── Details tab ───────────────────────────────────────────────── */}
          {tab === 'details' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
              <h2 className="text-base font-bold text-gray-900">Farm details</h2>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Farm name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="e.g. Boerderij de Zonnehof" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
                <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} className={`${inputClass} resize-none`} placeholder="Tell visitors what makes your farm special…" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Phone</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} placeholder="+31 6 12 34 56 78" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="info@uw-boerderij.nl" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Website</label>
                <input type="url" value={website} onChange={e => setWebsite(e.target.value)} className={inputClass} placeholder="https://www.uw-boerderij.nl" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Street address</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} className={inputClass} placeholder="Dorpsstraat 1" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Postal code</label>
                  <input type="text" value={postalCode} onChange={e => setPostalCode(e.target.value)} className={inputClass} placeholder="1234 AB" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">City</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value)} className={inputClass} placeholder="Amsterdam" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Farm types</label>
                <div className="flex flex-wrap gap-2">
                  {FARM_TYPES.map(({ id, label }) => {
                    const active = farmTypes.has(id)
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setFarmTypes(prev => {
                          const next = new Set(prev)
                          active ? next.delete(id) : next.add(id)
                          return next
                        })}
                        className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                          active
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-300'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={saveDetails}
                  disabled={savingDetails}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold transition-colors"
                >
                  {savingDetails ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save details
                </button>
              </div>
            </div>
          )}

          {/* ── Photos tab ────────────────────────────────────────────────── */}
          {tab === 'photos' && (
            <div className="space-y-4">

              {/* Current photo */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h2 className="text-base font-bold text-gray-900 mb-4">Current photo</h2>
                {currentImage ? (
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100">
                    <img src={currentImage} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-full aspect-video rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2">
                    <Camera size={32} className="text-gray-200" />
                    <p className="text-sm text-gray-400">No photo yet</p>
                  </div>
                )}
              </div>

              {/* Upload / URL */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h2 className="text-base font-bold text-gray-900 mb-4">Update photo</h2>

                {/* Mode toggle */}
                <div className="flex gap-2 mb-5">
                  {([['upload', Upload, 'Upload file'], ['url', LinkIcon, 'Paste URL']] as const).map(([mode, Icon, label]) => (
                    <button
                      key={mode}
                      onClick={() => setPhotoMode(mode as 'upload' | 'url')}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                        photoMode === mode
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'border-gray-200 text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Icon size={13} />
                      {label}
                    </button>
                  ))}
                </div>

                {photoMode === 'upload' ? (
                  <div>
                    {uploadPreview ? (
                      <div className="relative mb-4">
                        <div className="w-full aspect-video rounded-xl overflow-hidden bg-gray-100">
                          <img src={uploadPreview} alt="" className="w-full h-full object-cover" />
                        </div>
                        <button
                          onClick={() => { setUploadFile(null); setUploadPreview(null) }}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white shadow border border-gray-200 flex items-center justify-center"
                        >
                          <X size={13} className="text-gray-500" />
                        </button>
                      </div>
                    ) : (
                      <label className="block w-full aspect-video rounded-xl border-2 border-dashed border-gray-200 hover:border-emerald-300 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 bg-gray-50 hover:bg-emerald-50/30">
                        <Upload size={28} className="text-gray-300" />
                        <p className="text-sm text-gray-400 font-medium">Click to choose a photo</p>
                        <p className="text-xs text-gray-300">JPG, PNG, WebP — max 5 MB</p>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            setUploadFile(file)
                            setUploadPreview(URL.createObjectURL(file))
                          }}
                        />
                      </label>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Image URL</label>
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={e => setImageUrl(e.target.value)}
                      className={inputClass}
                      placeholder="https://example.com/photo.jpg"
                    />
                    {imageUrl && (
                      <div className="mt-3 w-full aspect-video rounded-xl overflow-hidden bg-gray-100">
                        <img src={imageUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-4 flex justify-end">
                  <button
                    onClick={savePhoto}
                    disabled={savingPhoto || (photoMode === 'upload' ? !uploadFile : !imageUrl)}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold transition-colors"
                  >
                    {savingPhoto ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save photo
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Hours tab ─────────────────────────────────────────────────── */}
          {tab === 'hours' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="text-base font-bold text-gray-900 mb-1">Opening hours</h2>
              <p className="text-sm text-gray-400 mb-6">Set your opening hours for each day of the week.</p>

              <div className="space-y-2">
                {DAYS.map(({ key, label }) => {
                  const day = schedule[key]
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                        day.closed ? 'bg-gray-50' : 'bg-emerald-50/40'
                      }`}
                    >
                      {/* Closed toggle */}
                      <button
                        type="button"
                        onClick={() => setSchedule(s => ({ ...s, [key]: { ...s[key], closed: !s[key].closed } }))}
                        className={`relative w-10 h-5.5 rounded-full transition-colors shrink-0 ${
                          day.closed ? 'bg-gray-200' : 'bg-emerald-500'
                        }`}
                        style={{ height: '22px', width: '40px' }}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            day.closed ? 'left-0.5' : 'left-5'
                          }`}
                        />
                      </button>

                      {/* Day label */}
                      <span className={`w-24 text-sm font-semibold shrink-0 ${day.closed ? 'text-gray-400' : 'text-gray-700'}`}>
                        {label}
                      </span>

                      {day.closed ? (
                        <span className="text-sm text-gray-300 italic">Closed</span>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <select
                            value={day.from}
                            onChange={e => setSchedule(s => ({ ...s, [key]: { ...s[key], from: e.target.value } }))}
                            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-emerald-400 bg-white"
                          >
                            {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <span className="text-gray-400 text-sm shrink-0">–</span>
                          <select
                            value={day.to}
                            onChange={e => setSchedule(s => ({ ...s, [key]: { ...s[key], to: e.target.value } }))}
                            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-emerald-400 bg-white"
                          >
                            {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Preview */}
              {serializeHours(schedule) && (
                <div className="mt-5 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Preview</p>
                  <p className="text-sm text-gray-700 font-mono">{serializeHours(schedule)}</p>
                </div>
              )}

              <div className="pt-5 flex justify-end">
                <button
                  onClick={saveHours}
                  disabled={savingHours}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold transition-colors"
                >
                  {savingHours ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save hours
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </ContentLayout>
  )
}
