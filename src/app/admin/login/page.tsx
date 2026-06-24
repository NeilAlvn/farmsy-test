'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'

const inputCls = 'w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none transition-colors'
const inputStyle = {
  border: '1px solid var(--border)',
  backgroundColor: 'var(--background)',
  color: 'var(--foreground)',
}

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Email verified check
    const preCheck = await fetch('/api/auth/email-verified', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).then(r => r.json()).catch(() => ({ verified: true }))

    if (!preCheck.verified) {
      setError('Email not verified. Check your inbox.')
      setLoading(false)
      return
    }

    const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
    if (signInErr || !data.user) {
      setError('Incorrect email or password.')
      setLoading(false)
      return
    }

    // Create session
    const d = await fetch('/api/session/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: data.user.id }),
    }).then(r => r.json()).catch(() => ({}))

    const sessionToken = d.session_token ?? ''
    if (sessionToken) localStorage.setItem('farmsy_session_token', sessionToken)

    // Check admin
    const adminCheck = await fetch('/api/admin/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: sessionToken }),
    }).then(r => r.json()).catch(() => ({ isAdmin: false }))

    if (!adminCheck.isAdmin) {
      setError('This account does not have admin access.')
      setLoading(false)
      return
    }

    if (adminCheck.otpVerified) {
      router.replace('/admin/overview')
      return
    }

    // Send OTP
    await fetch('/api/admin/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: sessionToken }),
    }).catch(() => {})

    router.replace('/admin/verify')
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="text-center">
          <p className="font-display italic text-4xl" style={{ color: 'var(--primary)' }}>Farmsy</p>
          <p className="text-sm mt-1 font-medium" style={{ color: 'var(--muted-foreground)' }}>Admin Portal</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8 space-y-5"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>Sign in</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              Admin access only. You'll receive a verification code by email.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@email.com"
                className={inputCls}
                style={inputStyle}
              />
            </div>

            <div className="relative">
              <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
              <input
                type={showPw ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                className={`${inputCls} pr-11`}
                style={inputStyle}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {error && (
              <div
                className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm"
                style={{ backgroundColor: 'oklch(0.62 0.2 25 / 0.06)', border: '1px solid oklch(0.62 0.2 25 / 0.15)', color: 'var(--destructive)' }}
              >
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-sm transition-opacity hover:opacity-85 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--primary)', color: 'white' }}
            >
              {loading
                ? <><Loader2 size={14} className="animate-spin" /> Signing in…</>
                : 'Sign in →'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
          <a href="/" className="hover:underline">← Back to Farmsy</a>
        </p>
      </div>
    </div>
  )
}
