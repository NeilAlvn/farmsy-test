'use client'

import { useState } from 'react'
import {
  X, Mail, Lock, Eye, EyeOff, Loader2,
  AlertCircle, Wheat, LogOut,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { destroySession } from '@/lib/session'

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

export default function AuthModal({ user, onClose, onAuth, onSignOut }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    if (mode === 'signin') {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        setError('Sign in failed. Please check your email and password.')
        setLoading(false)
      } else if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email_verified')
          .eq('id', data.user.id)
          .single()
        if (profile?.email_verified === false) {
          await supabase.auth.signOut()
          setError('Please verify your email first. Check your inbox for the confirmation link.')
          setLoading(false)
          return
        }
        onAuth({ id: data.user.id, email: data.user.email ?? email })
      }
    } else {
      const res = await fetch('/api/auth/signup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
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
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Wheat size={15} color="white" strokeWidth={2.5} />
            </div>
            <span className="text-base font-bold text-gray-900">Farmsy</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

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
              onClick={() => { setVerifyEmail(null); setMode('signin'); setPassword(''); setConfirmPassword('') }}
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
                <span className="text-emerald-700 font-bold text-sm">
                  {user.email[0].toUpperCase()}
                </span>
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
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        ) : (
          /* Auth form */
          <div className="px-5 pb-8 pt-4">
            {/* Tabs */}
            <div className="flex rounded-xl bg-gray-100 p-1 mb-5">
              {(['signin', 'signup'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError(null) }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    mode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {m === 'signin' ? 'Sign in' : 'Register'}
                </button>
              ))}
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">
                <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {mode === 'signup' && (
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 mt-1 transition-colors"
              >
                {loading
                  ? <><Loader2 size={15} className="animate-spin" /> Please wait…</>
                  : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
