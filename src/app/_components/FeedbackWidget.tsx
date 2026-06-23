'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageSquare, X, Loader2, CheckCircle2 } from 'lucide-react'

const HIDDEN_ON = ['/map', '/admin']

export default function FeedbackWidget() {
  const pathname = usePathname()
  const [open, setOpen]       = useState(false)
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState(false)

  // Hide on map and admin pages
  if (HIDDEN_ON.some(p => pathname.startsWith(p))) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(false)
    const res = await fetch('/api/contact', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, topic: 'feedback', message, source: 'widget' }),
    })
    setLoading(false)
    if (res.ok) {
      setSent(true)
    } else {
      setError(true)
    }
  }

  function handleClose() {
    setOpen(false)
    // Reset after animation
    setTimeout(() => { setSent(false); setError(false); setName(''); setEmail(''); setMessage('') }, 300)
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none transition-colors'
  const inputStyle = { border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }

  return (
    <>
      {/* Floating pill button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[9000] flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold shadow-lg transition-all hover:scale-105 hover:shadow-xl"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          aria-label="Give feedback"
        >
          <MessageSquare size={14} />
          Feedback
        </button>
      )}

      {/* Widget panel */}
      {open && (
        <div
          className="fixed bottom-5 right-5 z-[9000] w-80 rounded-2xl border border-border/60 bg-background shadow-2xl overflow-hidden"
          style={{ transition: 'opacity 200ms ease, transform 200ms ease' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} style={{ color: 'var(--primary)' }} />
              <span className="text-sm font-semibold text-foreground">Share feedback</span>
            </div>
            <button onClick={handleClose} className="rounded-full p-1 text-muted-foreground hover:bg-border/40 hover:text-foreground transition-colors">
              <X size={14} />
            </button>
          </div>

          <div className="p-4">
            {sent ? (
              <div className="flex flex-col items-center text-center py-4 gap-3">
                <CheckCircle2 size={32} style={{ color: 'var(--primary)' }} />
                <div>
                  <p className="font-semibold text-sm text-foreground">Thanks!</p>
                  <p className="text-xs text-muted-foreground mt-1">We'll get back to you soon.</p>
                </div>
                <button onClick={handleClose} className="text-xs font-medium underline underline-offset-2 hover:opacity-70 transition-opacity" style={{ color: 'var(--primary)' }}>
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-2.5">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  className={inputCls}
                  style={inputStyle}
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Your email"
                  className={inputCls}
                  style={inputStyle}
                />
                <textarea
                  required
                  rows={3}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="What's on your mind?"
                  className={inputCls}
                  style={{ ...inputStyle, resize: 'none' }}
                />
                {error && (
                  <p className="text-xs font-medium" style={{ color: 'var(--destructive)' }}>
                    Something went wrong. Please try again.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  {loading ? <><Loader2 size={13} className="animate-spin" /> Sending…</> : 'Send feedback'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
