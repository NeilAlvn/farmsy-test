'use client'

import { useState, useEffect } from 'react'
import {
  X, User, Mail, Phone, FileText, Shield,
  Loader2, CheckCircle2, AlertCircle, ChevronDown,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Farm } from './FarmMap'

interface Props {
  farm: Farm
  onClose: () => void
}

const inputClass =
  'w-full py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors'

export default function ClaimModal({ farm, onClose }: Props) {
  const [userId, setUserId] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [verificationMethod, setVerificationMethod] = useState<'email' | 'kvk'>('email')
  const [kvkNumber, setKvkNumber] = useState('')
  const [message, setMessage] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user.id ?? null)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setSubmitting(true)

    const { error } = await supabase.from('farm_claims').insert({
      farm_osm_id: farm.osm_id,
      user_id: userId,
      full_name: fullName,
      email,
      phone,
      verification_method: verificationMethod,
      kvk_number: verificationMethod === 'kvk' ? kvkNumber : null,
      message: message || null,
      status: 'pending',
    })

    if (error) {
      setSubmitError('Something went wrong. Please try again.')
      setSubmitting(false)
    } else {
      setSuccess(true)
    }
  }

  return (
    <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Shield size={18} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 leading-none">Claim this farm</h2>
              <p className="text-xs text-gray-400 mt-0.5">{farm.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {success ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Claim submitted!</h3>
              <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
                We'll review your request and get back to you at{' '}
                <span className="font-medium text-gray-700">{email}</span>.
              </p>
              <button
                onClick={onClose}
                className="mt-6 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <form onSubmit={handleSubmit} className="p-5 space-y-4">

              {submitError && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{submitError}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Full name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" className={`${inputClass} pl-10 pr-4`} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email address <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@farm.com" className={`${inputClass} pl-10 pr-4`} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Phone number <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="+31 6 12 34 56 78" className={`${inputClass} pl-10 pr-4`} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Verification method <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <select value={verificationMethod} onChange={e => setVerificationMethod(e.target.value as 'email' | 'kvk')} className={`${inputClass} pl-4 pr-10 appearance-none bg-white`}>
                    <option value="email">Email verification</option>
                    <option value="kvk">KVK number</option>
                  </select>
                  <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {verificationMethod === 'kvk' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    KVK number <span className="text-red-400">*</span>
                  </label>
                  <input type="text" required value={kvkNumber} onChange={e => setKvkNumber(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="12345678" maxLength={8} className={`${inputClass} px-4 font-mono tracking-widest`} />
                  <p className="text-xs text-gray-400 mt-1.5">8-digit KVK number of your business</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Additional notes <span className="text-gray-400 font-normal ml-1">(optional)</span>
                </label>
                <div className="relative">
                  <FileText size={15} className="absolute left-3.5 top-3.5 text-gray-400 pointer-events-none" />
                  <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Tell us why you are the owner of this farm…" className={`${inputClass} pl-10 pr-4 resize-none`} />
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <div className="relative mt-0.5 shrink-0">
                  <input type="checkbox" required checked={agreed} onChange={e => setAgreed(e.target.checked)} className="sr-only" />
                  <div className={`w-5 h-5 rounded-[5px] border-2 flex items-center justify-center transition-colors ${agreed ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300 bg-white'}`}>
                    {agreed && (
                      <svg viewBox="0 0 10 8" className="w-2.5 h-2" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 4l3 3 5-6" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-sm text-gray-600 leading-relaxed">
                  I confirm I am the owner or authorised representative of{' '}
                  <span className="font-medium text-gray-800">{farm.name}</span>.
                </span>
              </label>

              <button
                type="submit"
                disabled={submitting || !agreed}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2"
              >
                {submitting
                  ? <><Loader2 size={15} className="animate-spin" /> Submitting…</>
                  : <><Shield size={15} /> Submit claim</>}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
