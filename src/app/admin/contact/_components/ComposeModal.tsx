'use client'

import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Loader2, Minus, Send, X } from 'lucide-react'
import { composeNewMessage, searchUsers, type ConversationRow, type UserSearchResult } from '../actions'
import { useToast } from '@/app/_components/ToastProvider'

// ─── Template presets ─────────────────────────────────────────────────────────

const TEMPLATE_OPTIONS = [
  { key: 'custom',   label: 'Custom (blank)' },
  { key: 'winback',  label: 'Win-back offer (COMEBACK20)' },
  { key: 'trial',    label: 'Trial reminder' },
  { key: 'general',  label: 'General response' },
  { key: 'welcome',  label: 'Welcome back' },
] as const

type TemplateKey = typeof TEMPLATE_OPTIONS[number]['key']

const TEMPLATE_BODIES: Record<TemplateKey, string> = {
  custom:  '',
  winback:
    `Hi {{name}},\n\nWe noticed you haven't been active on Farmsy for a while. We'd love to have you back!\n\nAs a special offer, use code COMEBACK20 for 20% off your next subscription month.\n\nBest,\nThe Farmsy Team`,
  trial:
    `Hi {{name}},\n\nJust a friendly reminder that your free trial is ending soon. Upgrade now to keep full access to Farmsy without interruption.\n\nIf you have any questions, we're here to help.\n\nBest,\nThe Farmsy Team`,
  general:
    `Hi {{name}},\n\nThank you for contacting Farmsy. \n\nBest,\nThe Farmsy Team`,
  welcome:
    `Hi {{name}},\n\nWelcome back to Farmsy! We're thrilled to have you with us.\n\nIf there's anything we can help you with, don't hesitate to reach out.\n\nBest,\nThe Farmsy Team`,
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Recipient {
  email:   string
  name:    string
  userId?: string
}

interface Props {
  onClose: () => void
  onSent:  (threads: ConversationRow[]) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveBody(body: string, firstName: string): string {
  return body.replace(/\{\{name\}\}/g, firstName || 'there')
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ComposeModal({ onClose, onSent }: Props) {
  const { toast } = useToast()

  // ── Window state ─────────────────────────────────────────────────────────
  const [minimized,    setMinimized]    = useState(false)

  // ── Form state ────────────────────────────────────────────────────────────
  const [recipients,   setRecipients]   = useState<Recipient[]>([])
  const [toInput,      setToInput]      = useState('')
  const [suggestions,  setSuggestions]  = useState<UserSearchResult[]>([])
  const [searching,    setSearching]    = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  const [subject,      setSubject]      = useState('')
  const [templateKey,  setTemplateKey]  = useState<TemplateKey>('custom')
  const [body,         setBody]         = useState('')

  const [showPreview,  setShowPreview]  = useState(false)
  const [sending,      setSending]      = useState(false)

  // ── Refs ──────────────────────────────────────────────────────────────────
  const toInputRef    = useRef<HTMLInputElement>(null)
  const textareaRef   = useRef<HTMLTextAreaElement>(null)
  const dropdownRef   = useRef<HTMLDivElement>(null)
  const toWrapperRef  = useRef<HTMLDivElement>(null)

  // ── Autocomplete search (debounced 300 ms) ────────────────────────────────

  useEffect(() => {
    const q = toInput.trim()
    if (q.length < 2) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      const results = await searchUsers(q)
      // Exclude already-added recipients
      const added = new Set(recipients.map(r => r.email))
      setSuggestions(results.filter(u => !added.has(u.email)))
      setShowDropdown(true)
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [toInput, recipients])

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return
    function handler(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        toWrapperRef.current && !toWrapperRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDropdown])

  // ── Template selection ────────────────────────────────────────────────────

  function handleTemplateChange(key: TemplateKey) {
    setTemplateKey(key)
    setBody(TEMPLATE_BODIES[key])
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 320) + 'px'
      }
    })
  }

  // ── Recipient management ──────────────────────────────────────────────────

  function addRecipientFromSuggestion(u: UserSearchResult) {
    setRecipients(prev => [...prev, { email: u.email, name: u.name, userId: u.id }])
    setToInput('')
    setSuggestions([])
    setShowDropdown(false)
    toInputRef.current?.focus()
  }

  function addRecipientFromInput() {
    const email = toInput.trim().replace(/,\s*$/, '')
    if (!isValidEmail(email)) return
    if (recipients.some(r => r.email === email)) {
      setToInput('')
      return
    }
    setRecipients(prev => [...prev, { email, name: email.split('@')[0] }])
    setToInput('')
    setSuggestions([])
    setShowDropdown(false)
  }

  function removeRecipient(email: string) {
    setRecipients(prev => prev.filter(r => r.email !== email))
  }

  function handleToKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (suggestions.length > 0 && showDropdown) {
        addRecipientFromSuggestion(suggestions[0])
      } else {
        addRecipientFromInput()
      }
    }
    if (e.key === 'Backspace' && toInput === '' && recipients.length > 0) {
      setRecipients(prev => prev.slice(0, -1))
    }
    if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  // ── Body auto-grow ────────────────────────────────────────────────────────

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setBody(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 320) + 'px'
  }

  // ── Send ──────────────────────────────────────────────────────────────────

  async function handleSend() {
    if (!subject.trim() || recipients.length === 0 || sending) return
    setSending(true)

    const newThreads: ConversationRow[] = []
    const failed: string[]              = []

    for (const r of recipients) {
      const firstName    = r.name.split(' ')[0] || r.name
      const resolvedBody = resolveBody(body, firstName)

      const result = await composeNewMessage({
        toEmail:  r.email,
        toName:   r.name,
        toUserId: r.userId,
        subject,
        body:     resolvedBody,
      })

      if (result.ok && result.threadId) {
        newThreads.push({
          id:            result.threadId,
          type:          'thread',
          threadId:      result.threadId,
          userId:        r.userId ?? null,
          userEmail:     r.email,
          userName:      r.name,
          subject,
          topic:         null,
          source:        'in_app',
          lastMessageAt: new Date().toISOString(),
          preview:       resolvedBody.slice(0, 100),
          unreadAdmin:   0,
          isReplied:     true,
          isArchived:    false,
        })
      } else {
        failed.push(r.email)
      }
    }

    setSending(false)

    if (newThreads.length > 0) {
      onSent(newThreads)
      toast({
        type:  'success',
        title: newThreads.length === 1
          ? 'Message sent'
          : `Message sent to ${newThreads.length} recipients`,
      })
      if (failed.length > 0) {
        toast({
          type:    'warning',
          title:   `Failed to send to: ${failed.join(', ')}`,
          message: 'These recipients were not reached.',
        })
      }
    } else {
      toast({ type: 'error', title: 'Failed to send — please try again' })
    }
  }

  // ── Preview helpers ───────────────────────────────────────────────────────

  const previewRecipient = recipients[0]
  const previewFirstName = previewRecipient
    ? previewRecipient.name.split(' ')[0] || previewRecipient.name
    : 'Subscriber'
  const previewBody = resolveBody(body, previewFirstName)

  const canSend = subject.trim().length > 0 && recipients.length > 0 && !sending

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed z-50 flex flex-col rounded-t-2xl overflow-hidden shadow-2xl"
      style={{
        bottom:          0,
        right:           24,
        width:           560,
        border:          '1px solid var(--border)',
        borderBottom:    'none',
        backgroundColor: 'var(--card)',
        boxShadow:       '0 -4px 32px rgba(0,0,0,0.12), 0 0 0 1px var(--border)',
      }}
    >

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none flex-shrink-0"
        style={{ backgroundColor: 'var(--primary)' }}
        onClick={() => setMinimized(v => !v)}
      >
        <span className="text-base font-semibold text-white">New Message</span>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setMinimized(v => !v)}
            className="p-1.5 rounded transition-colors"
            title={minimized ? 'Expand' : 'Minimize'}
            style={{ color: 'rgba(255,255,255,0.8)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Minus size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded transition-colors"
            title="Close"
            style={{ color: 'rgba(255,255,255,0.8)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── BODY (collapsed when minimized) ───────────────────────────────── */}
      {!minimized && (
        <>
          {/* ── TO field ──────────────────────────────────────────────────── */}
          <div
            className="flex-shrink-0 relative"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div
              ref={toWrapperRef}
              className="flex flex-wrap items-center gap-1.5 px-4 py-3 min-h-[52px] cursor-text"
              onClick={() => toInputRef.current?.focus()}
            >
              <span className="text-sm font-medium flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                To
              </span>

              {/* Recipient tags */}
              {recipients.map(r => (
                <span
                  key={r.email}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: 'rgba(63,94,58,0.1)',
                    color:           'var(--primary)',
                    border:          '1px solid rgba(63,94,58,0.2)',
                  }}
                >
                  {r.name !== r.email ? r.name : r.email}
                  <button
                    onClick={e => { e.stopPropagation(); removeRecipient(r.email) }}
                    className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}

              {/* Text input */}
              <input
                ref={toInputRef}
                value={toInput}
                onChange={e => setToInput(e.target.value)}
                onKeyDown={handleToKeyDown}
                onFocus={() => { if (toInput.trim().length >= 2) setShowDropdown(true) }}
                placeholder={recipients.length === 0 ? 'Name or email…' : ''}
                className="flex-1 min-w-[120px] text-sm bg-transparent focus:outline-none"
                style={{ color: 'var(--foreground)' }}
              />

              {searching && (
                <Loader2 size={13} className="animate-spin flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
              )}
            </div>

            {/* Autocomplete dropdown */}
            {showDropdown && suggestions.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute left-0 right-0 top-full z-10 rounded-xl shadow-lg overflow-hidden"
                style={{
                  backgroundColor: 'var(--card)',
                  border:          '1px solid var(--border)',
                  maxHeight:       200,
                  overflowY:       'auto',
                  marginTop:       4,
                }}
              >
                {suggestions.map(u => (
                  <button
                    key={u.id}
                    onMouseDown={e => { e.preventDefault(); addRecipientFromSuggestion(u) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--cream)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {/* Mini avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      {u.name.trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{u.name}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{u.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── SUBJECT ───────────────────────────────────────────────────── */}
          <div
            className="flex-shrink-0 flex items-center gap-3 px-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <span className="text-sm font-medium flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
              Subject
            </span>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Enter subject…"
              className="flex-1 py-3 text-sm bg-transparent focus:outline-none"
              style={{ color: 'var(--foreground)' }}
            />
          </div>

          {/* ── TEMPLATE SELECTOR ─────────────────────────────────────────── */}
          <div
            className="flex-shrink-0 flex items-center gap-3 px-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <span className="text-sm font-medium flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
              Template
            </span>
            <select
              value={templateKey}
              onChange={e => handleTemplateChange(e.target.value as TemplateKey)}
              className="flex-1 py-3 text-sm bg-transparent focus:outline-none cursor-pointer"
              style={{ color: 'var(--foreground)' }}
            >
              {TEMPLATE_OPTIONS.map(t => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* ── BODY / PREVIEW ────────────────────────────────────────────── */}
          <div className="flex-shrink-0">
            {showPreview ? (
              /* Preview pane */
              <div
                className="px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap overflow-y-auto"
                style={{
                  minHeight:       200,
                  maxHeight:       320,
                  color:           'var(--foreground)',
                  backgroundColor: 'var(--cream)',
                  borderBottom:    '1px solid var(--border)',
                }}
              >
                {previewBody
                  ? <>
                      {previewRecipient && (
                        <p className="mb-4 pb-3 text-xs" style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted-foreground)' }}>
                          <span className="font-medium">To:</span> {previewRecipient.name} &lt;{previewRecipient.email}&gt;
                          {recipients.length > 1 && (
                            <span className="ml-1">+{recipients.length - 1} more (each receives a personalised copy)</span>
                          )}
                          <br />
                          <span className="font-medium">Subject:</span> {subject || '—'}
                        </p>
                      )}
                      <p>{previewBody}</p>
                    </>
                  : <p style={{ color: 'var(--muted-foreground)' }}>Nothing to preview yet…</p>
                }
              </div>
            ) : (
              /* Body textarea */
              <textarea
                ref={textareaRef}
                value={body}
                onChange={handleBodyChange}
                placeholder="Write your message… (use {{name}} for the recipient's first name)"
                rows={6}
                className="w-full resize-none px-5 py-4 text-sm bg-transparent focus:outline-none"
                style={{
                  color:        'var(--foreground)',
                  minHeight:    200,
                  maxHeight:    320,
                  borderBottom: '1px solid var(--border)',
                  display:      'block',
                }}
              />
            )}
          </div>

          {/* ── FOOTER: preview toggle + send ─────────────────────────────── */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 gap-3">

            {/* Preview toggle */}
            <button
              onClick={() => setShowPreview(v => !v)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                border:          '1px solid var(--border)',
                color:           showPreview ? 'var(--primary)' : 'var(--muted-foreground)',
                backgroundColor: showPreview ? 'rgba(63,94,58,0.06)' : 'transparent',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--cream)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = showPreview ? 'rgba(63,94,58,0.06)' : 'transparent')}
              title={showPreview ? 'Back to editor' : 'Preview email'}
            >
              {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
              {showPreview ? 'Edit' : 'Preview'}
            </button>

            {/* Recipient count hint */}
            {recipients.length > 0 && (
              <span className="text-xs flex-1 text-center" style={{ color: 'var(--muted-foreground)' }}>
                {sending
                  ? `Sending to ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}…`
                  : `${recipients.length} recipient${recipients.length > 1 ? 's' : ''}`}
              </span>
            )}

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-opacity"
              style={{
                backgroundColor: canSend ? 'var(--primary)' : 'var(--border)',
                color:           canSend ? 'white'           : 'var(--muted-foreground)',
                cursor:          canSend ? 'pointer'         : 'default',
              }}
            >
              {sending
                ? <><Loader2 size={13} className="animate-spin" /> Sending…</>
                : <><Send size={13} /> Send</>}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
