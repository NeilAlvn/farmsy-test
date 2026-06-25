'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, Loader2, Send, X } from 'lucide-react'
import {
  getAllUsersForBulkSend,
  sendBulkMessage,
  type BulkSendRow,
  type BulkSendUser,
  type RecipientFilter,
} from '../actions'
import { useToast } from '@/app/_components/ToastProvider'

// ─── Template presets ─────────────────────────────────────────────────────────

const TEMPLATES: { key: string; label: string; subject: string; body: string }[] = [
  {
    key: 'blank',
    label: 'Blank',
    subject: '',
    body: 'Hi {{name}},\n\n\n\nBest,\nThe Farmsy Team',
  },
  {
    key: 'announcement',
    label: 'Announcement',
    subject: 'Exciting news from Farmsy 🌱',
    body: 'Hi {{name}},\n\nWe have exciting news to share with you!\n\n\n\nBest,\nThe Farmsy Team',
  },
  {
    key: 'winback',
    label: 'Win-back (COMEBACK20)',
    subject: 'We miss you — come back with 20% off',
    body: 'Hi {{name}},\n\nWe noticed you haven\'t been active on Farmsy for a while. We\'d love to have you back!\n\nAs a special offer, use code COMEBACK20 for 20% off your next subscription month.\n\nBest,\nThe Farmsy Team',
  },
  {
    key: 'trialreminder',
    label: 'Trial reminder',
    subject: 'Your Farmsy trial is ending soon',
    body: 'Hi {{name}},\n\nJust a friendly reminder that your free trial ends soon. Upgrade now to keep access to all Farmsy features without interruption.\n\nIf you have any questions, we\'re here to help.\n\nBest,\nThe Farmsy Team',
  },
]

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const FILTERS: { value: RecipientFilter; label: string }[] = [
  { value: 'all',      label: 'All users' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'active',   label: 'Active' },
  { value: 'free',     label: 'Free' },
  { value: 'canceled', label: 'Canceled' },
]

// ─── Main modal ───────────────────────────────────────────────────────────────

interface BulkSendModalProps {
  onClose: () => void
  onSent: (bulkSend: BulkSendRow) => void
}

export default function BulkSendModal({ onClose, onSent }: BulkSendModalProps) {
  const { toast } = useToast()
  const overlayRef = useRef<HTMLDivElement>(null)

  const [step, setStep] = useState<1 | 2 | 3>(1)

  // ── Step 1 state ──────────────────────────────────────────────────────────
  const [filter, setFilter]             = useState<RecipientFilter>('all')
  const [allUsers, setAllUsers]         = useState<BulkSendUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const [searchQ, setSearchQ]           = useState('')

  // ── Step 2 state ──────────────────────────────────────────────────────────
  const [template, setTemplate] = useState('blank')
  const [subject, setSubject]   = useState('')
  const [body, setBody]         = useState(TEMPLATES[0].body)

  // ── Step 3 state ──────────────────────────────────────────────────────────
  const [sending, setSending]         = useState(false)
  const [progress, setProgress]       = useState(0)
  const [progressLabel, setProgressLabel] = useState('')

  // ── Load users when filter changes ────────────────────────────────────────
  useEffect(() => {
    setLoadingUsers(true)
    getAllUsersForBulkSend(filter).then(users => {
      setAllUsers(users)
      setLoadingUsers(false)
    })
  }, [filter])

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredUsers = allUsers.filter(u => {
    if (!searchQ.trim()) return true
    const q = searchQ.toLowerCase()
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  const selectedUsers = allUsers.filter(u => selected.has(u.id))

  function toggleUser(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (filteredUsers.every(u => selected.has(u.id))) {
      setSelected(prev => {
        const next = new Set(prev)
        filteredUsers.forEach(u => next.delete(u.id))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        filteredUsers.forEach(u => next.add(u.id))
        return next
      })
    }
  }

  function applyTemplate(key: string) {
    const t = TEMPLATES.find(t => t.key === key)
    if (!t) return
    setTemplate(key)
    if (t.subject) setSubject(t.subject)
    setBody(t.body)
  }

  async function handleSend() {
    setSending(true)
    setProgress(10)
    setProgressLabel('Creating campaign…')

    const result = await sendBulkMessage({
      subject,
      body,
      recipients: selectedUsers,
    })

    setProgress(100)

    if (!result.ok) {
      toast({ type: 'error', title: result.error ?? 'Send failed' })
      setSending(false)
      return
    }

    setProgressLabel(`Sent to ${result.successCount} recipients`)

    // Build a BulkSendRow to hand back
    const sent: BulkSendRow = {
      id: result.bulkSendId!,
      subject,
      body,
      recipientCount: selectedUsers.length,
      successCount: result.successCount,
      failedCount: result.failedCount,
      status: result.failedCount === 0 ? 'done' : 'partial',
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }
    onSent(sent)
  }

  // ── Backdrop click ────────────────────────────────────────────────────────
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{ backgroundColor: 'var(--card)', maxHeight: '85vh' }}
      >
        {/* ── Modal header ──────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            {step > 1 && !sending && (
              <button
                onClick={() => setStep(s => (s - 1) as 1 | 2 | 3)}
                className="rounded-lg p-1.5 transition-colors hover:bg-border/30"
              >
                <ChevronLeft size={16} style={{ color: 'var(--muted-foreground)' }} />
              </button>
            )}
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                Bulk Send
              </h2>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Step {step} of 3 — {step === 1 ? 'Select recipients' : step === 2 ? 'Compose message' : 'Preview & send'}
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={sending}
            className="rounded-lg p-1.5 transition-colors hover:bg-border/30">
            <X size={16} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {/* ── Step indicator ────────────────────────────────────────────────── */}
        <div className="shrink-0 flex gap-1 px-6 pt-4">
          {([1, 2, 3] as const).map(n => (
            <div
              key={n}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{
                backgroundColor: n <= step
                  ? 'var(--primary)'
                  : 'var(--border)',
              }}
            />
          ))}
        </div>

        {/* ── Step 1: Select recipients ─────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex flex-1 flex-col overflow-hidden px-6 pb-6 pt-4">
            {/* Filter tabs */}
            <div className="mb-3 flex flex-wrap gap-1">
              {FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: filter === f.value ? 'var(--primary)' : 'var(--border)',
                    color: filter === f.value ? 'white' : 'var(--foreground)',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <input
              type="text"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search users…"
              className="mb-3 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--background)',
                color: 'var(--foreground)',
              }}
            />

            {/* Select all + count */}
            <div className="mb-2 flex items-center justify-between">
              <button
                onClick={toggleAll}
                disabled={loadingUsers || filteredUsers.length === 0}
                className="text-xs font-medium transition-colors hover:underline"
                style={{ color: 'var(--primary)' }}
              >
                {filteredUsers.every(u => selected.has(u.id)) && filteredUsers.length > 0
                  ? 'Deselect all'
                  : `Select all (${filteredUsers.length})`}
              </button>
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {selected.size} selected
              </span>
            </div>

            {/* User list */}
            <div className="flex-1 overflow-y-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
              {loadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={18} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
                </div>
              ) : filteredUsers.length === 0 ? (
                <p className="py-8 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  No users found.
                </p>
              ) : (
                filteredUsers.map(u => (
                  <label
                    key={u.id}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-border/20"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(u.id)}
                      onChange={() => toggleUser(u.id)}
                      className="accent-primary h-4 w-4 rounded"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: 'var(--foreground)' }}>{u.name}</p>
                      <p className="truncate text-xs" style={{ color: 'var(--muted-foreground)' }}>{u.email}</p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs"
                      style={{ backgroundColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                    >
                      {u.subscriptionStatus}
                    </span>
                  </label>
                ))
              )}
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={selected.size === 0}
              className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-40"
              style={{ backgroundColor: 'var(--primary)', color: 'white' }}
            >
              Continue with {selected.size} recipient{selected.size !== 1 ? 's' : ''}
            </button>
          </div>
        )}

        {/* ── Step 2: Compose ────────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="flex flex-1 flex-col overflow-hidden px-6 pb-6 pt-4">
            {/* Template picker */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                Template
              </label>
              <select
                value={template}
                onChange={e => applyTemplate(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)',
                }}
              >
                {TEMPLATES.map(t => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Email subject…"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col">
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                  Message
                </label>
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Use <code className="rounded px-1 py-0.5 text-xs font-mono"
                    style={{ backgroundColor: 'var(--border)' }}>{'{{name}}'}</code> for first name
                </span>
              </div>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Write your message…"
                className="flex-1 min-h-[180px] resize-none rounded-xl border px-3 py-2.5 text-sm outline-none font-mono leading-relaxed"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            <button
              onClick={() => setStep(3)}
              disabled={!subject.trim() || !body.trim()}
              className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-40"
              style={{ backgroundColor: 'var(--primary)', color: 'white' }}
            >
              Preview &amp; send
            </button>
          </div>
        )}

        {/* ── Step 3: Preview & send ─────────────────────────────────────────── */}
        {step === 3 && (
          <div className="flex flex-1 flex-col overflow-hidden px-6 pb-6 pt-4">
            {sending ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4">
                <div className="w-full rounded-full overflow-hidden h-2" style={{ backgroundColor: 'var(--border)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progress}%`, backgroundColor: 'var(--primary)' }}
                  />
                </div>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {progressLabel || 'Sending…'}
                </p>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div
                  className="mb-4 rounded-2xl p-4"
                  style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <Send size={14} style={{ color: 'var(--primary)' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                      Campaign summary
                    </span>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--muted-foreground)' }}>Recipients</span>
                      <span className="font-medium" style={{ color: 'var(--foreground)' }}>{selected.size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--muted-foreground)' }}>Subject</span>
                      <span className="font-medium truncate max-w-[240px] text-right" style={{ color: 'var(--foreground)' }}>{subject}</span>
                    </div>
                  </div>
                </div>

                {/* Message preview */}
                <div className="mb-4 flex-1 overflow-y-auto">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--muted-foreground)' }}>
                    Message preview
                  </p>
                  <pre
                    className="whitespace-pre-wrap rounded-xl border px-4 py-3 text-sm font-sans leading-relaxed"
                    style={{
                      borderColor: 'var(--border)',
                      backgroundColor: 'var(--background)',
                      color: 'var(--foreground)',
                    }}
                  >
                    {body.replace(/\{\{name\}\}/g, selectedUsers[0]?.name.split(' ')[0] || 'there')}
                  </pre>
                  {selected.size > 1 && (
                    <p className="mt-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      Shown as it will appear for your first recipient. Each recipient gets their own name.
                    </p>
                  )}
                </div>

                {/* Confirm button */}
                <button
                  onClick={handleSend}
                  className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-85"
                  style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                >
                  <Check size={15} />
                  Send to {selected.size} recipient{selected.size !== 1 ? 's' : ''}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
