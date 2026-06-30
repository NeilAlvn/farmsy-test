'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  Loader2, Wheat, CheckCircle2, AlertCircle, Upload, X, Lock, ArrowRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ContentLayout from '@/app/_components/ContentLayout'
import SignInModal from '@/app/_components/SignInModal'
import { submitFarmShop } from './actions'

type Access = 'checking' | 'guest' | 'no-sub' | 'allowed'

const FARM_TYPES = [
  { id: 'eggs', label: 'Eggs' }, { id: 'dairy', label: 'Dairy' }, { id: 'meat', label: 'Meat' },
  { id: 'fish', label: 'Fish' }, { id: 'produce', label: 'Produce' }, { id: 'cheese', label: 'Cheese' },
  { id: 'wine', label: 'Wine' }, { id: 'markets', label: 'Markets' }, { id: 'honey', label: 'Honey' },
  { id: 'organic', label: 'Organic' },
]
const MAX_IMAGES = 5

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors'
const inputStyle = { borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' } as const

export default function SubmitFarmPage() {
  const router = useRouter()
  const t = useTranslations('submit')
  const [access, setAccess] = useState<Access>('checking')
  const [showSignIn, setShowSignIn] = useState(false)
  const [token, setToken] = useState('')

  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [description, setDescription] = useState('')
  const [types, setTypes] = useState<Set<string>>(new Set())
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [country, setCountry] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [email, setEmail] = useState('')
  const [hours, setHours] = useState('')
  const [files, setFiles] = useState<File[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function checkAccess() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setAccess('guest'); return }
    setToken(session.access_token)
    try {
      const res = await fetch('/api/profile/status', { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (!res.ok) { setAccess('no-sub'); return }
      const p = await res.json() as { subscription_status: string | null; subscription_end_date: string | null }
      const paid = p.subscription_status === 'active' || p.subscription_status === 'trialing' ||
        (p.subscription_status === 'canceled' && !!p.subscription_end_date && new Date(p.subscription_end_date) > new Date())
      setAccess(paid ? 'allowed' : 'no-sub')
    } catch { setAccess('no-sub') }
  }

  useEffect(() => { checkAccess() }, [])

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    setFiles(prev => [...prev, ...picked].slice(0, MAX_IMAGES))
    e.target.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const fd = new FormData()
    fd.set('token', token)
    fd.set('name', name); fd.set('city', city); fd.set('description', description)
    fd.set('farm_type', [...types].join(',')); fd.set('address', address)
    fd.set('postal_code', postalCode); fd.set('country', country)
    fd.set('phone', phone); fd.set('website', website); fd.set('email', email)
    fd.set('opening_hours', hours)
    files.forEach(f => fd.append('images', f))

    const res = await submitFarmShop(fd)
    setSubmitting(false)
    if (!res.ok) setError(res.error ?? t('genericError'))
    else setDone(true)
  }

  // ── Gated states ────────────────────────────────────────────────────────────
  if (access === 'checking') {
    return <ContentLayout><div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-gray-300" /></div></ContentLayout>
  }

  if (access === 'guest' || access === 'no-sub') {
    return (
      <ContentLayout>
        {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} onSuccess={() => { setShowSignIn(false); setAccess('checking'); checkAccess() }} />}
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-24">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.1)' }}>
            <Lock size={28} style={{ color: 'var(--primary)' }} />
          </div>
          <h1 className="font-display text-2xl font-medium mb-2" style={{ color: 'var(--foreground)' }}>{t('title')}</h1>
          <p className="text-sm mb-8 max-w-sm" style={{ color: 'var(--muted-foreground)' }}>
            {access === 'guest' ? t('lockGuest') : t('lockNoSub')}
          </p>
          {access === 'guest'
            ? <button onClick={() => setShowSignIn(true)} className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>{t('signInBtn')} <ArrowRight size={15} /></button>
            : <Link href="/pricing" className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>{t('plansBtn')} <ArrowRight size={15} /></Link>}
        </div>
      </ContentLayout>
    )
  }

  if (done) {
    return (
      <ContentLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-24">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-6"><CheckCircle2 size={32} className="text-emerald-600" /></div>
          <h1 className="font-display text-2xl font-medium mb-2" style={{ color: 'var(--foreground)' }}>{t('doneTitle')}</h1>
          <p className="text-sm mb-8 max-w-sm" style={{ color: 'var(--muted-foreground)' }}>
            {t('doneDesc', { name })}
          </p>
          <Link href="/map" className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>{t('backBtn')}</Link>
        </div>
      </ContentLayout>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <ContentLayout>
      <section className="px-6 pt-16 pb-10" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="mx-auto max-w-2xl">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>{t('eyebrow')}</p>
          <h1 className="font-display text-4xl font-medium leading-tight" style={{ color: 'var(--foreground)' }}>{t('title')}</h1>
          <p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            {t('introLead')}
          </p>
          <ul className="mt-3 space-y-1.5 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            <li>• {t('tip1')}</li>
            <li>• {t('tip2', { max: MAX_IMAGES })}</li>
            <li>• {t('tip3')}</li>
          </ul>
        </div>
      </section>

      <section className="px-6 py-10" style={{ backgroundColor: 'var(--background)' }}>
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl px-4 py-3" style={{ backgroundColor: 'oklch(0.62 0.2 25 / 0.06)', border: '1px solid oklch(0.62 0.2 25 / 0.15)', color: 'var(--destructive)' }}>
              <AlertCircle size={15} className="shrink-0 mt-0.5" /><p className="text-sm">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted-foreground)' }}>{t('name')} *</label>
              <input required value={name} onChange={e => setName(e.target.value)} className={inputClass} style={inputStyle} placeholder="Boerderij de Zonnehof" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted-foreground)' }}>{t('city')} *</label>
              <input required value={city} onChange={e => setCity(e.target.value)} className={inputClass} style={inputStyle} placeholder="Utrecht" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted-foreground)' }}>{t('description')}</label>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} className={`${inputClass} resize-none`} style={inputStyle} placeholder="What you sell, what makes you special…" />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>{t('sell')}</label>
            <div className="flex flex-wrap gap-2">
              {FARM_TYPES.map(({ id, label }) => {
                const active = types.has(id)
                return (
                  <button key={id} type="button"
                    onClick={() => setTypes(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })}
                    className="px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-all"
                    style={active
                      ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)', color: 'var(--primary-foreground)' }
                      : { backgroundColor: 'var(--background)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted-foreground)' }}>{t('address')}</label>
              <input value={address} onChange={e => setAddress(e.target.value)} className={inputClass} style={inputStyle} placeholder="Dorpsstraat 1" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted-foreground)' }}>{t('postal')}</label>
              <input value={postalCode} onChange={e => setPostalCode(e.target.value)} className={inputClass} style={inputStyle} placeholder="1234 AB" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted-foreground)' }}>{t('country')}</label>
              <input value={country} onChange={e => setCountry(e.target.value)} className={inputClass} style={inputStyle} placeholder="Netherlands" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted-foreground)' }}>{t('phone')}</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} style={inputStyle} placeholder="+31 6 …" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted-foreground)' }}>{t('website')}</label>
              <input value={website} onChange={e => setWebsite(e.target.value)} className={inputClass} style={inputStyle} placeholder="https://…" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted-foreground)' }}>{t('email')}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} style={inputStyle} placeholder="info@…" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted-foreground)' }}>{t('hours')}</label>
            <input value={hours} onChange={e => setHours(e.target.value)} className={inputClass} style={inputStyle} placeholder={t('hoursPh')} />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>{t('photos')} ({files.length}/{MAX_IMAGES})</label>
            <div className="flex flex-wrap gap-3">
              {files.map((f, i) => (
                <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                  <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white shadow flex items-center justify-center"><X size={12} className="text-gray-500" /></button>
                </div>
              ))}
              {files.length < MAX_IMAGES && (
                <label className="w-24 h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer" style={{ borderColor: 'var(--border)' }}>
                  <Upload size={18} style={{ color: 'var(--muted-foreground)' }} />
                  <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{t('add')}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={onPickFiles} />
                </label>
              )}
            </div>
          </div>

          <div className="pt-2">
            <button type="submit" disabled={submitting} className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold disabled:opacity-50" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Wheat size={15} />}
              {t('submitBtn')}
            </button>
          </div>
        </form>
      </section>
    </ContentLayout>
  )
}
