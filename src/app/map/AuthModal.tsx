'use client'

import { useState } from 'react'
import {
  X, Mail, Lock, Eye, EyeOff, Loader2,
  AlertCircle, Wheat, LogOut, User, Calendar, MapPin, ArrowLeft,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { destroySession } from '@/lib/session'
import AddressAutocomplete from '../_components/AddressAutocomplete'

interface User {
  id: string
  email: string
}

interface Props {
  user: User | null
  onClose: () => void
  onAuth: (user: User) => void
  onSignOut: () => void
}

const inputCls = 'w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors'

export default function AuthModal({ user, onClose, onAuth, onSignOut }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Step 2
  const [firstName, setFirstName]         = useState('')
  const [lastName, setLastName]           = useState('')
  const [dob, setDob]                     = useState('')
  const [streetAddress, setStreetAddress] = useState('')
  const [city, setCity]                   = useState('')
  const [postalCode, setPostalCode]       = useState('')
  const [country, setCountry]             = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null)

  function resetSignup() {
    setStep(1); setEmail(''); setPassword(''); setConfirmPassword('')
    setFirstName(''); setLastName(''); setDob('')
    setStreetAddress(''); setCity(''); setPostalCode(''); setCountry('')
    setError(null)
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const preCheck = await fetch('/api/auth/email-verified', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const { verified } = await preCheck.json()
    if (!verified) {
      setError('Please verify your email first. Check your inbox for the confirmation link.')
      setLoading(false)
      return
    }

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('Sign in failed. Please check your email and password.')
      setLoading(false)
    } else if (data.user) {
      onAuth({ id: data.user.id, email: data.user.email ?? email })
    }
  }

  function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setStep(2)
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await fetch('/api/auth/signup', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password, firstName, lastName, dob, streetAddress, city, postalCode, country }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong. Please try again.')
      setLoading(false)
    } else {
      setVerifyEmail(email)
      setLoading(false)
    }
  }

  async function handleSignOut() {
    await destroySession()
    onSignOut()
  }

  return (
    <div className="fixed inset-0 z-[10002] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-1">
          <div className="flex items-center gap-2">
            {mode === 'signup' && step === 2 && !verifyEmail && (
              <button type="button" onClick={() => { setStep(1); setError(null) }} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                <ArrowLeft size={16} className="text-gray-500" />
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center">
                <Wheat size={15} color="white" strokeWidth={2.5} />
              </div>
              <span className="text-base font-bold text-gray-900">Farmsy</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Verify email screen */}
        {verifyEmail ? (
          <div className="px-5 pb-8 pt-6 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <Mail size={26} className="text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Check your inbox</p>
              <p className="mt-1 text-sm text-gray-500">
                We sent a verification link to<br />
                <strong className="text-gray-800">{verifyEmail}</strong>
              </p>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed max-w-[220px]">
              Click the link to activate your account, then come back to sign in.
            </p>
            <button
              type="button"
              onClick={() => { setVerifyEmail(null); setMode('signin'); resetSignup() }}
              className="text-sm font-semibold text-emerald-600 underline underline-offset-2 hover:opacity-70 transition-opacity"
            >
              Back to sign in
            </button>
          </div>

        ) : user ? (
          /* Logged-in state */
          <div className="px-5 pb-8 pt-4">
            <div className="bg-gray-50 rounded-2xl p-4 mb-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <span className="text-emerald-700 font-bold text-sm">{user.email[0].toUpperCase()}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{user.email}</p>
                <p className="text-xs text-gray-400">Signed in</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>

        ) : (
          <div className="px-5 pb-8 pt-4">
            {/* Tabs */}
            <div className="flex rounded-xl bg-gray-100 p-1 mb-4">
              {(['signin', 'signup'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError(null); setStep(1) }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    mode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {m === 'signin' ? 'Sign in' : 'Register'}
                </button>
              ))}
            </div>

            {/* Step progress for signup */}
            {mode === 'signup' && (
              <div className="flex items-center gap-2 mb-4">
                {[1, 2].map(s => (
                  <div key={s} className="h-1 flex-1 rounded-full transition-colors duration-300"
                    style={{ backgroundColor: s <= step ? '#059669' : '#e5e7eb' }}
                  />
                ))}
                <span className="text-xs text-gray-400 shrink-0">Step {step} of 2</span>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">
                <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Sign in form */}
            {mode === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-3">
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className={inputCls} />
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className={`${inputCls} pr-11`} />
                  <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 mt-1 transition-colors">
                  {loading ? <><Loader2 size={15} className="animate-spin" /> Please wait…</> : 'Sign in'}
                </button>
              </form>
            )}

            {/* Signup step 1 */}
            {mode === 'signup' && step === 1 && (
              <form onSubmit={handleStep1} className="space-y-3">
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className={inputCls} />
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input type={showPassword ? 'text' : 'password'} required autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className={`${inputCls} pr-11`} />
                  <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input type={showPassword ? 'text' : 'password'} required autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm password" className={inputCls} />
                </div>
                <button type="submit" className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 mt-1 transition-colors">
                  Continue →
                </button>
              </form>
            )}

            {/* Signup step 2 */}
            {mode === 'signup' && step === 2 && (
              <form onSubmit={handleStep2} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input type="text" required autoComplete="given-name" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" className={inputCls} />
                  </div>
                  <div className="relative">
                    <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input type="text" required autoComplete="family-name" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" className={inputCls} />
                  </div>
                </div>

                <div className="relative">
                  <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input type="date" required autoComplete="bday" value={dob} onChange={e => setDob(e.target.value)} className={`${inputCls} pr-4`} style={{ colorScheme: 'light' }} />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500">Address</p>
                  <AddressAutocomplete
                    inputCls={inputCls}
                    inputStyle={{}}
                    onSelect={a => { setStreetAddress(a.streetAddress); setPostalCode(a.postalCode); setCity(a.city); setCountry(a.country) }}
                  />
                  <div className="relative">
                    <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input type="text" required autoComplete="street-address" value={streetAddress} onChange={e => setStreetAddress(e.target.value)} placeholder="Street and house number" className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" required autoComplete="postal-code" value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="Postal code" className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors" />
                    <input type="text" required autoComplete="address-level2" value={city} onChange={e => setCity(e.target.value)} placeholder="City" className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors" />
                  </div>
                  <input type="text" required autoComplete="country-name" value={country} onChange={e => setCountry(e.target.value)} placeholder="Country" className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors" />
                </div>

                <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 mt-1 transition-colors">
                  {loading ? <><Loader2 size={15} className="animate-spin" /> Creating account…</> : 'Create account'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
