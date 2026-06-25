'use client'

import { useState, useEffect, useCallback, useRef, type KeyboardEvent, type ClipboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  X, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, ArrowLeft, User, Calendar, MapPin, ShieldCheck,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props {
  onClose:         () => void
  onSuccess?:      () => void
  initialMessage?: { type: 'success' | 'error'; text: string }
}

const inputCls = 'w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none transition-colors duration-150'
const inputStyle = { border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }

function Modal({ onClose, onSuccess, initialMessage }: Props) {
  const router = useRouter()
  const [visible, setVisible]   = useState(false)
  const [mode, setMode]         = useState<'signin' | 'signup'>('signin')
  const [step, setStep]         = useState<1 | 2>(1)

  // Step 1 fields
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)

  // Step 2 fields
  const [firstName, setFirstName]         = useState('')
  const [lastName, setLastName]           = useState('')
  const [dob, setDob]                     = useState('')
  const [streetAddress, setStreetAddress] = useState('')
  const [city, setCity]                   = useState('')
  const [postalCode, setPostalCode]       = useState('')
  const [country, setCountry]             = useState('NL')

  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null)
  const [forgotView, setForgotView]   = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent]   = useState(false)

  // Admin OTP step
  const [adminOtpMode, setAdminOtpMode]   = useState(false)
  const [otpDigits, setOtpDigits]         = useState(['', '', '', '', '', ''])
  const [otpError, setOtpError]           = useState<string | null>(null)
  const [otpResent, setOtpResent]         = useState(false)
  const [adminSessionToken, setAdminSessionToken] = useState('')
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const close = useCallback(() => {
    if (adminOtpMode) return  // cannot dismiss while OTP verification is pending
    setVisible(false)
    setTimeout(onClose, 220)
  }, [onClose, adminOtpMode])

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [close])

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/auth/forgot-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: forgotEmail }),
    })
    setLoading(false)
    setForgotSent(true)
  }

  function handleOtpChange(i: number, val: string) {
    const char = val.replace(/\D/g, '').slice(-1)
    const next = [...otpDigits]; next[i] = char; setOtpDigits(next); setOtpError(null)
    if (char && i < 5) otpRefs.current[i + 1]?.focus()
  }

  function handleOtpKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otpDigits[i] && i > 0) otpRefs.current[i - 1]?.focus()
    if (e.key === 'Enter' && otpDigits.join('').length === 6) submitOtp(otpDigits.join(''))
  }

  function handleOtpPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const next = [...otpDigits]
    for (let i = 0; i < text.length; i++) next[i] = text[i]
    setOtpDigits(next)
    const idx = Math.min(text.length, 5)
    otpRefs.current[idx]?.focus()
    if (text.length === 6) submitOtp(text)
  }

  async function submitOtp(code: string) {
    setLoading(true); setOtpError(null)
    const res = await fetch('/api/admin/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: adminSessionToken, code }),
    })
    const data = await res.json()
    if (res.ok) {
      setVisible(false)
      router.replace('/admin/overview')
    } else {
      setOtpError(data.error ?? 'Invalid code, try again')
      setLoading(false)
      setOtpDigits(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
    }
  }

  async function resendOtp() {
    setOtpResent(false)
    await fetch('/api/admin/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: adminSessionToken }),
    }).catch(() => {})
    setOtpDigits(['', '', '', '', '', ''])
    setOtpError(null)
    setOtpResent(true)
    otpRefs.current[0]?.focus()
    setTimeout(() => setOtpResent(false), 4000)
  }

  function resetSignup() {
    setStep(1); setEmail(''); setPassword(''); setConfirm('')
    setFirstName(''); setLastName(''); setDob('')
    setStreetAddress(''); setCity(''); setPostalCode(''); setCountry('NL')
    setError(null)
  }

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setStep(2)
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const refCode = document.cookie
      .split('; ')
      .find(c => c.startsWith('farmsy_ref='))
      ?.split('=')[1]

    const res = await fetch('/api/auth/signup', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password, firstName, lastName, dob, streetAddress, city, postalCode, country, refCode }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong. Please try again.')
      setLoading(false)
    } else {
      // Clear referral cookie — already consumed
      document.cookie = 'farmsy_ref=; path=/; max-age=0'
      setVerifyEmail(email)
      setLoading(false)
    }
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

    const { data: signInData, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError('Sign in failed. Please check your email and password.')
      setLoading(false)
    } else {
      let sessionToken = ''
      if (signInData.user) {
        const d = await fetch('/api/session/create', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ user_id: signInData.user.id }),
        }).then(r => r.json()).catch(() => ({}))
        if (d.session_token) {
          sessionToken = d.session_token
          localStorage.setItem('farmsy_session_token', d.session_token)
        }
      }

      // Admin check — show OTP step inside this modal
      if (sessionToken) {
        const adminCheck = await fetch('/api/admin/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_token: sessionToken }),
        }).then(r => r.json()).catch(() => ({ isAdmin: false, otpVerified: false }))

        if (adminCheck.isAdmin) {
          await fetch('/api/admin/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_token: sessionToken }),
          }).catch(() => {})
          setAdminSessionToken(sessionToken)
          setAdminOtpMode(true)
          setLoading(false)
          setTimeout(() => otpRefs.current[0]?.focus(), 50)
          return
        }
      }

      if (onSuccess) {
        setVisible(false)
        onSuccess()
      } else {
        close()
        router.refresh()
      }
    }
  }

  const subtitle = adminOtpMode
    ? 'Admin verification'
    : verifyEmail
      ? 'Check your inbox'
      : forgotView
        ? 'Reset your password'
        : mode === 'signin'
          ? 'Sign in to your account'
          : step === 1 ? 'Create a new account' : 'Almost there'

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      style={{ transition: 'background-color 220ms ease', backgroundColor: visible ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)' }}
    >
      <div
        className="absolute inset-0"
        style={{ backdropFilter: visible ? 'blur(4px)' : 'blur(0px)', transition: 'backdrop-filter 220ms ease' }}
        onClick={close}
      />

      <div
        className="relative w-full max-w-sm rounded-3xl border border-border/60 bg-background shadow-2xl overflow-hidden"
        style={{
          transition: 'opacity 220ms ease, transform 220ms cubic-bezier(0.34,1.26,0.64,1)',
          opacity:   visible ? 1 : 0,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(16px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            {((mode === 'signup' && step === 2 && !verifyEmail) || forgotView) && (
              <button
                type="button"
                onClick={() => {
                  if (forgotView) { setForgotView(false); setForgotSent(false); setForgotEmail(''); setError(null) }
                  else { setStep(1); setError(null) }
                }}
                className="rounded-full p-1 text-muted-foreground hover:bg-border/40 hover:text-foreground transition-colors mr-1"
              >
                <ArrowLeft size={15} />
              </button>
            )}
            <div>
              <span className="font-display text-2xl font-medium italic tracking-tight text-foreground">Farmsy</span>
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            </div>
          </div>
          {!adminOtpMode && (
            <button onClick={close} className="rounded-full p-1.5 text-muted-foreground hover:bg-border/40 hover:text-foreground transition-colors">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* ── Admin OTP verification view ── */}
          {adminOtpMode ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center text-center gap-3 py-2">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.1)' }}>
                  <ShieldCheck size={22} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">Check your email</p>
                  <p className="text-xs text-muted-foreground mt-0.5">We sent a 6-digit code to your admin email</p>
                </div>
              </div>

              <div className="flex gap-2 justify-center">
                {otpDigits.map((d, i) => (
                  <input
                    key={i}
                    ref={el => { otpRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKey(i, e)}
                    onPaste={handleOtpPaste}
                    className="w-10 text-center text-xl font-bold rounded-xl focus:outline-none transition-all"
                    style={{
                      height: '48px',
                      border: `2px solid ${d ? 'var(--primary)' : 'var(--border)'}`,
                      backgroundColor: 'var(--background)',
                      color: 'var(--foreground)',
                    }}
                  />
                ))}
              </div>

              {otpError && (
                <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
                  style={{ backgroundColor: 'oklch(0.62 0.2 25 / 0.06)', border: '1px solid oklch(0.62 0.2 25 / 0.15)', color: 'var(--destructive)' }}>
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  {otpError}
                </div>
              )}

              {otpResent && (
                <p className="text-center text-xs font-medium" style={{ color: 'var(--primary)' }}>New code sent — check your inbox.</p>
              )}

              <button
                onClick={() => submitOtp(otpDigits.join(''))}
                disabled={otpDigits.join('').length < 6 || loading}
                className="w-full py-3.5 rounded-xl font-bold text-sm transition-opacity hover:opacity-85 disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--primary)', color: 'white' }}
              >
                {loading ? <><Loader2 size={14} className="animate-spin" /> Verifying…</> : 'Verify & open admin'}
              </button>

              <p className="text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Didn't get it?{' '}
                <button onClick={resendOtp} className="underline underline-offset-2 hover:opacity-70">Resend code</button>
              </p>
            </div>
          ) : (<>

          {/* Forgot password view */}
          {forgotView ? (
            forgotSent ? (
              <div className="flex flex-col items-center text-center py-4 gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.1)' }}>
                  <Mail size={26} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <p className="font-semibold text-base text-foreground">Check your inbox</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    If an account exists for <strong className="text-foreground">{forgotEmail}</strong>,<br />we've sent a reset link. It expires in 1 hour.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setForgotView(false); setForgotSent(false); setForgotEmail(''); setError(null) }}
                  className="mt-1 text-sm font-semibold underline underline-offset-2 hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--primary)' }}
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-3">
                <p className="text-sm text-muted-foreground">Enter your email and we'll send you a link to reset your password.</p>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
                  <input type="email" required autoComplete="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="you@example.com" className={inputCls} style={inputStyle} />
                </div>
                <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl font-bold text-sm transition-opacity hover:opacity-85 disabled:opacity-60 flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                  {loading ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : 'Send reset link'}
                </button>
              </form>
            )

          ) : null}

          {/* Verify inbox screen + main content */}
          {!forgotView && verifyEmail ? (
            <div className="flex flex-col items-center text-center py-4 gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.1)' }}>
                <Mail size={26} style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <p className="font-semibold text-base text-foreground">Verify your email</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  We sent a confirmation link to<br />
                  <strong className="text-foreground">{verifyEmail}</strong>
                </p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px]">
                Click the link in the email to activate your account, then come back to sign in.
              </p>
              <button
                type="button"
                onClick={() => { setVerifyEmail(null); setMode('signin'); resetSignup() }}
                className="mt-1 text-sm font-semibold underline underline-offset-2 hover:opacity-70 transition-opacity"
                style={{ color: 'var(--primary)' }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              {/* Mode tabs */}
              <div className="flex rounded-xl p-1" style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.06)' }}>
                {(['signin', 'signup'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMode(m); setError(null); setStep(1) }}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-150"
                    style={mode === m
                      ? { backgroundColor: 'var(--background)', color: 'var(--foreground)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                      : { color: 'var(--muted-foreground)' }
                    }
                  >
                    {m === 'signin' ? 'Sign in' : 'Register'}
                  </button>
                ))}
              </div>

              {/* Step indicator for signup */}
              {mode === 'signup' && (
                <div className="flex items-center gap-2">
                  {[1, 2].map(s => (
                    <div key={s} className="h-1 flex-1 rounded-full transition-colors duration-300"
                      style={{ backgroundColor: s <= step ? 'var(--primary)' : 'oklch(0.36 0.07 145 / 0.15)' }}
                    />
                  ))}
                  <span className="text-xs text-muted-foreground shrink-0">Step {step} of 2</span>
                </div>
              )}

              {initialMessage && step === 1 && (
                <div className="flex items-start gap-2.5 rounded-xl px-4 py-3"
                  style={initialMessage.type === 'success'
                    ? { backgroundColor: 'oklch(0.36 0.07 145 / 0.08)', border: '1px solid oklch(0.36 0.07 145 / 0.2)', color: 'var(--primary)' }
                    : { backgroundColor: 'oklch(0.62 0.2 25 / 0.06)', border: '1px solid oklch(0.62 0.2 25 / 0.15)', color: 'var(--destructive)' }
                  }>
                  {initialMessage.type === 'success' ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> : <AlertCircle size={15} className="shrink-0 mt-0.5" />}
                  <p className="text-sm">{initialMessage.text}</p>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl px-4 py-3"
                  style={{ backgroundColor: 'oklch(0.62 0.2 25 / 0.06)', border: '1px solid oklch(0.62 0.2 25 / 0.15)', color: 'var(--destructive)' }}>
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {/* ── Sign in form ── */}
              {mode === 'signin' && (
                <form onSubmit={handleSignIn} className="space-y-3">
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
                    <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} style={inputStyle} />
                  </div>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
                    <input type={showPw ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className={`${inputCls} pr-11`} style={inputStyle} />
                    <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity" style={{ color: 'var(--muted-foreground)' }}>
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => { setForgotView(true); setForgotEmail(email); setError(null) }} className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'var(--muted-foreground)' }}>
                      Forgot password?
                    </button>
                  </div>
                  <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl font-bold text-sm transition-opacity hover:opacity-85 disabled:opacity-60 flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                    {loading ? <><Loader2 size={14} className="animate-spin" /> Please wait…</> : 'Sign in'}
                  </button>
                </form>
              )}

              {/* ── Signup step 1: email + password ── */}
              {mode === 'signup' && step === 1 && (
                <form onSubmit={handleStep1} className="space-y-3">
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
                    <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} style={inputStyle} />
                  </div>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
                    <input type={showPw ? 'text' : 'password'} required autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className={`${inputCls} pr-11`} style={inputStyle} />
                    <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity" style={{ color: 'var(--muted-foreground)' }}>
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
                    <input type={showPw ? 'text' : 'password'} required autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm password" className={inputCls} style={inputStyle} />
                  </div>
                  <button type="submit" className="w-full py-3.5 rounded-xl font-bold text-sm transition-opacity hover:opacity-85 flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                    Continue →
                  </button>
                </form>
              )}

              {/* ── Signup step 2: personal details ── */}
              {mode === 'signup' && step === 2 && (
                <form onSubmit={handleStep2} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
                      <input type="text" required autoComplete="given-name" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" className={inputCls} style={inputStyle} />
                    </div>
                    <div className="relative">
                      <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
                      <input type="text" required autoComplete="family-name" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" className={inputCls} style={inputStyle} />
                    </div>
                  </div>

                  <div className="relative">
                    <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
                    <input type="date" required autoComplete="bday" value={dob} onChange={e => setDob(e.target.value)} className={inputCls} style={{ ...inputStyle, colorScheme: 'light dark' }} />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Address <span className="font-normal opacity-60">(optional)</span></p>
                    <div className="relative">
                      <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
                      <input type="text" autoComplete="street-address" value={streetAddress} onChange={e => setStreetAddress(e.target.value)} placeholder="Street address" className={inputCls} style={inputStyle} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="text" autoComplete="postal-code" value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="Postal code" className="w-full px-3 py-3 rounded-xl text-sm focus:outline-none" style={inputStyle} />
                      <input type="text" autoComplete="address-level2" value={city} onChange={e => setCity(e.target.value)} placeholder="City" className="w-full px-3 py-3 rounded-xl text-sm focus:outline-none" style={inputStyle} />
                    </div>
                    <select value={country} onChange={e => setCountry(e.target.value)} className="w-full px-3 py-3 rounded-xl text-sm focus:outline-none" style={inputStyle}>
                      <option value="NL">🇳🇱 Netherlands</option>
                      <option value="BE">🇧🇪 Belgium</option>
                    </select>
                  </div>

                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                    🔒 Your data is stored securely and never shared with third parties.
                  </p>

                  <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl font-bold text-sm transition-opacity hover:opacity-85 disabled:opacity-60 flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                    {loading ? <><Loader2 size={14} className="animate-spin" /> Creating account…</> : 'Create account'}
                  </button>
                </form>
              )}

              <p className="text-center text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                By signing in you agree to our{' '}
                <a href="/terms" className="underline underline-offset-2 hover:opacity-70 transition-opacity">terms of service</a>.
              </p>
            </>
          )}

          </>)} {/* end adminOtpMode conditional */}

        </div>
      </div>
    </div>
  )
}

export default function SignInModal({ onClose, onSuccess, initialMessage }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  return createPortal(<Modal onClose={onClose} onSuccess={onSuccess} initialMessage={initialMessage} />, document.body)
}
