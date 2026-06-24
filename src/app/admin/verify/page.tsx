'use client'

import { useRef, useState, useEffect, KeyboardEvent, ClipboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react'

export default function AdminVerifyPage() {
  const router = useRouter()
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  function handleChange(i: number, val: string) {
    const char = val.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = char
    setDigits(next)
    setError(null)
    if (char && i < 5) inputRefs.current[i + 1]?.focus()
  }

  function handleKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus()
    }
    if (e.key === 'Enter') {
      const code = digits.join('')
      if (code.length === 6) submit(code)
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const next = [...digits]
    for (let i = 0; i < text.length; i++) next[i] = text[i]
    setDigits(next)
    const focusIdx = Math.min(text.length, 5)
    inputRefs.current[focusIdx]?.focus()
    if (text.length === 6) submit(text)
  }

  async function submit(code: string) {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/admin/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const data = await res.json()
    if (res.ok) {
      router.replace('/admin/overview')
    } else {
      setError(data.error ?? 'Something went wrong.')
      setLoading(false)
      setDigits(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    }
  }

  async function resend() {
    setResending(true)
    const token = typeof window !== 'undefined' ? localStorage.getItem('farmsy_session_token') : null
    await fetch('/api/admin/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: token }),
    }).catch(() => {})
    setResending(false)
    setResent(true)
    setDigits(['', '', '', '', '', ''])
    setError(null)
    inputRefs.current[0]?.focus()
    setTimeout(() => setResent(false), 4000)
  }

  const code = digits.join('')

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-8 space-y-6"
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {/* Icon */}
        <div className="flex justify-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.1)' }}
          >
            <ShieldCheck size={26} style={{ color: 'var(--primary)' }} />
          </div>
        </div>

        {/* Header */}
        <div className="text-center space-y-1">
          <p className="font-display italic text-2xl" style={{ color: 'var(--foreground)' }}>Farmsy Admin</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Check your email</p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            We sent a 6-digit code to your admin email.<br />Enter it below to continue.
          </p>
        </div>

        {/* OTP inputs */}
        <div className="flex gap-2 justify-center">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKey(i, e)}
              onPaste={handlePaste}
              className="w-11 h-13 text-center text-xl font-bold rounded-xl focus:outline-none transition-all"
              style={{
                height: '52px',
                border: `2px solid ${d ? 'var(--primary)' : 'var(--border)'}`,
                backgroundColor: 'var(--background)',
                color: 'var(--foreground)',
              }}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div
            className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm"
            style={{ backgroundColor: 'oklch(0.62 0.2 25 / 0.06)', border: '1px solid oklch(0.62 0.2 25 / 0.15)', color: 'var(--destructive)' }}
          >
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {resent && (
          <p className="text-center text-xs font-medium" style={{ color: 'var(--primary)' }}>
            New code sent — check your inbox.
          </p>
        )}

        {/* Submit */}
        <button
          onClick={() => submit(code)}
          disabled={code.length < 6 || loading}
          className="w-full py-3.5 rounded-xl font-bold text-sm transition-opacity hover:opacity-85 disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ backgroundColor: 'var(--primary)', color: 'white' }}
        >
          {loading ? <><Loader2 size={14} className="animate-spin" /> Verifying…</> : 'Verify'}
        </button>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.replace('/')}
            className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <ArrowLeft size={12} />
            Back to site
          </button>
          <button
            onClick={resend}
            disabled={resending}
            className="text-xs transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {resending ? 'Sending…' : 'Resend code'}
          </button>
        </div>
      </div>
    </div>
  )
}
