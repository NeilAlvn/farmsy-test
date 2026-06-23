'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'

export default function ResetForm({ token }: { token: string }) {
  const router = useRouter()
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const inputCls = 'w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none transition-colors'
  const inputStyle = { border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    const res = await fetch('/api/auth/reset-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token, password }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(
        data.error === 'token-expired'
          ? 'This reset link has expired. Please request a new one.'
          : 'Something went wrong. Please try again.',
      )
      setLoading(false)
      return
    }

    router.replace('/auth/signin?reset=true')
  }

  return (
    <div className="w-full max-w-sm rounded-3xl border border-border/60 bg-background shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border/40">
        <span className="font-display text-2xl font-medium italic tracking-tight text-foreground">Farmsy</span>
        <p className="text-xs text-muted-foreground mt-0.5">Set a new password</p>
      </div>

      <div className="px-6 py-5 space-y-4">
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl px-4 py-3"
            style={{ backgroundColor: 'oklch(0.62 0.2 25 / 0.06)', border: '1px solid oklch(0.62 0.2 25 / 0.15)', color: 'var(--destructive)' }}>
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
            <input
              type={showPw ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="New password"
              className={`${inputCls} pr-11`}
              style={inputStyle}
            />
            <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity" style={{ color: 'var(--muted-foreground)' }}>
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          <div className="relative">
            <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
            <input
              type={showPw ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              className={inputCls}
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold text-sm transition-opacity hover:opacity-85 disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            {loading ? <><Loader2 size={14} className="animate-spin" /> Updating…</> : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  )
}
