'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  X, Mail, Lock, Eye, EyeOff, Loader2,
  AlertCircle, CheckCircle2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props {
  onClose:    () => void
  onSuccess?: () => void   // called after successful sign-in (default: router.refresh)
}

function Modal({ onClose, onSuccess }: Props) {
  const router = useRouter()
  const [visible, setVisible]   = useState(false)
  const [mode, setMode]         = useState<'signin' | 'signup'>('signin')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState<string | null>(null)

  // Trigger enter animation after mount
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  // Animated close — fade out then unmount
  const close = useCallback(() => {
    setVisible(false)
    setTimeout(onClose, 220)
  }, [onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [close])

  async function handleGoogle() {
    setError(null)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    if (mode === 'signin') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) {
        setError('Sign in failed. Please check your email and password.')
        setLoading(false)
      } else {
        close()
        if (onSuccess) onSuccess()
        else router.refresh()
      }
    } else {
      const { error: err } = await supabase.auth.signUp({ email, password })
      if (err) {
        setError(err.message)
        setLoading(false)
      } else {
        setSuccess('Account created! Check your email to confirm, then sign in.')
        setMode('signin')
        setPassword('')
        setConfirm('')
        setLoading(false)
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      style={{
        transition: 'background-color 220ms ease',
        backgroundColor: visible ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)',
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backdropFilter: visible ? 'blur(4px)' : 'blur(0px)',
          transition: 'backdrop-filter 220ms ease',
        }}
        onClick={close}
      />

      {/* Card */}
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
          <div>
            <span className="font-display text-2xl font-medium italic tracking-tight text-foreground">
              Farmsy
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">
              {mode === 'signin' ? 'Sign in to your account' : 'Create a new account'}
            </p>
          </div>
          <button
            onClick={close}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-border/40 hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Mode tabs */}
          <div className="flex rounded-xl p-1" style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.06)' }}>
            {(['signin', 'signup'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); setSuccess(null) }}
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

          {/* Feedback */}
          {success && (
            <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm"
              style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.08)', border: '1px solid oklch(0.36 0.07 145 / 0.2)', color: 'var(--primary)' }}>
              <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
              {success}
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl px-4 py-3"
              style={{ backgroundColor: 'oklch(0.62 0.2 25 / 0.06)', border: '1px solid oklch(0.62 0.2 25 / 0.15)', color: 'var(--destructive)' }}>
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-semibold transition-opacity duration-150 hover:opacity-75"
            style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            <svg width="17" height="17" viewBox="0 0 48 48" fill="none">
              <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
              <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
              <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
              <path d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.021 35.596 44 30.138 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" style={{ borderColor: 'var(--border)' }} />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 text-xs font-medium" style={{ backgroundColor: 'var(--background)', color: 'var(--muted-foreground)' }}>
                or continue with email
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none transition-colors duration-150"
                style={{ border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
              />
            </div>

            <div className="relative">
              <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
              <input
                type={showPw ? 'text' : 'password'}
                required
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full pl-10 pr-11 py-3 rounded-xl text-sm focus:outline-none transition-colors duration-150"
                style={{ border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-opacity duration-150 hover:opacity-70"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {mode === 'signup' && (
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none transition-colors duration-150"
                  style={{ border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-sm transition-opacity duration-150 disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              {loading
                ? <><Loader2 size={14} className="animate-spin" /> Please wait…</>
                : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
            By signing in you agree to our{' '}
            <a href="/terms" className="underline underline-offset-2 hover:opacity-70 transition-opacity">terms of service</a>.
          </p>

        </div>
      </div>
    </div>
  )
}

// Portal wrapper — renders outside any stacking context into document.body
export default function SignInModal({ onClose, onSuccess }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  return createPortal(<Modal onClose={onClose} onSuccess={onSuccess} />, document.body)
}
