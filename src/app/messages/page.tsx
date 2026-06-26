'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Mail, MessageSquare, Plus, Send, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import SiteNav from '@/app/_components/SiteNav'
import {
  createUserThread,
  getUserThreadMessages,
  getUserThreads,
  markThreadReadByUser,
  sendUserReply,
  type UserMessageRow,
  type UserThread,
} from './actions'

const POLL_INTERVAL = 30_000

// ─── Message bubble (user perspective) ───────────────────────────────────────

function Bubble({ msg }: { msg: UserMessageRow }) {
  const isUser = msg.senderType === 'user'
  const time   = new Date(msg.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div style={{ maxWidth: '78%' }}>
        <div
          className="px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
          style={{
            backgroundColor: isUser ? 'var(--primary)' : 'var(--cream)',
            color:           isUser ? 'white' : 'var(--foreground)',
            border:          isUser ? 'none' : '1px solid var(--border)',
            borderRadius:    isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          }}
        >
          {msg.body}
        </div>
        <div className={`flex items-center gap-1.5 mt-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
            {isUser ? 'You' : 'Farmsy Support'}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--border)' }}>·</span>
          <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{time}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Date label ───────────────────────────────────────────────────────────────

function getDateLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const todayMs  = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterMs = todayMs - 86_400_000
  const msgMs    = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  if (msgMs === todayMs)  return 'Today'
  if (msgMs === yesterMs) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function fmtTime(iso: string): string {
  const d   = new Date(iso)
  const now = new Date()
  const diffMs   = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1)  return 'just now'
  if (diffMins < 60) return `${diffMins}m`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 7)  return `${diffDays}d`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ContactSupportPage() {
  const router = useRouter()

  const [userId, setUserId]       = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [userName, setUserName]   = useState<string>('')
  const [threads, setThreads]   = useState<UserThread[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<UserThread | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list')

  const [messages, setMessages]       = useState<UserMessageRow[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [reply, setReply]             = useState('')
  const [sending, setSending]         = useState(false)

  // Compose new thread
  const [composing, setComposing]         = useState(false)
  const [newSubject, setNewSubject]       = useState('')
  const [newBody, setNewBody]             = useState('')
  const [sendingNew, setSendingNew]       = useState(false)
  const [composeError, setComposeError]   = useState('')

  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { router.replace('/'); return }
      setUserId(session.user.id)
      setUserEmail(session.user.email ?? '')
      setUserName((session.user.user_metadata?.full_name as string | undefined) ?? session.user.email ?? '')
    })
  }, [router])

  // ── Load threads ────────────────────────────────────────────────────────────
  const loadThreads = useCallback(async (id: string, silent = false) => {
    if (!silent) setLoading(true)
    const data = await getUserThreads(id)
    setThreads(data)
    if (!silent) setLoading(false)
  }, [])

  useEffect(() => {
    if (!userId) return
    loadThreads(userId)
  }, [userId, loadThreads])

  useEffect(() => {
    if (!userId) return
    const id = setInterval(() => loadThreads(userId, true), POLL_INTERVAL)
    return () => clearInterval(id)
  }, [userId, loadThreads])

  // ── Load messages for selected thread ───────────────────────────────────────
  useEffect(() => {
    if (!selected || !userId) { setMessages([]); return }
    setLoadingMsgs(true)
    getUserThreadMessages(selected.id, userId).then(data => {
      setMessages(data)
      setLoadingMsgs(false)
    })
    markThreadReadByUser(selected.id, userId)
    setThreads(prev => prev.map(t => t.id === selected.id ? { ...t, unreadUser: 0 } : t))
  }, [selected?.id, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Select thread ───────────────────────────────────────────────────────────
  function selectThread(t: UserThread) {
    setSelected(t)
    setComposing(false)
    setMobileView('thread')
  }

  // ── Send reply ──────────────────────────────────────────────────────────────
  async function handleSend() {
    const body = reply.trim()
    if (!body || !selected || !userId || sending) return

    const optimistic: UserMessageRow = {
      id: `opt-${Date.now()}`,
      threadId: selected.id,
      senderType: 'user',
      body,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    setReply('')
    setSending(true)

    const result = await sendUserReply(selected.id, userId, body)
    if (!result.ok) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setReply(body)
    } else {
      const data = await getUserThreadMessages(selected.id, userId)
      setMessages(data)
      loadThreads(userId, true)
    }
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Send new thread ─────────────────────────────────────────────────────────
  async function handleSendNew() {
    if (!userId || !newSubject.trim() || !newBody.trim()) {
      setComposeError('Please fill in both subject and message.')
      return
    }
    setSendingNew(true)
    setComposeError('')
    const result = await createUserThread(userId, userEmail, userName, newSubject.trim(), newBody.trim())
    if (!result.ok || !result.thread) {
      setComposeError(result.error ?? 'Failed to send. Please try again.')
      setSendingNew(false)
      return
    }
    setThreads(prev => [result.thread!, ...prev])
    setSelected(result.thread!)
    setComposing(false)
    setNewSubject('')
    setNewBody('')
    setSendingNew(false)
    loadThreads(userId, true)
  }

  // ── Group messages by date ──────────────────────────────────────────────────
  function groupedMessages(): { label: string; msgs: UserMessageRow[] }[] {
    const groups: { label: string; msgs: UserMessageRow[] }[] = []
    let lastLabel = ''
    for (const m of messages) {
      const label = getDateLabel(m.createdAt)
      if (label !== lastLabel) {
        groups.push({ label, msgs: [] })
        lastLabel = label
      }
      groups[groups.length - 1].msgs.push(m)
    }
    return groups
  }

  const totalUnread = threads.reduce((acc, t) => acc + t.unreadUser, 0)

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
      <SiteNav />

      <main className="flex flex-1 flex-col overflow-hidden" style={{ height: 'calc(100vh - 4rem)' }}>
        <div
          className="mx-auto flex w-full max-w-5xl flex-1 overflow-hidden rounded-2xl my-6 mx-6 sm:mx-auto"
          style={{ border: '1px solid var(--border)', backgroundColor: 'var(--card)', maxHeight: 'calc(100vh - 8rem)' }}
        >

          {/* LEFT: thread list */}
          <div
            className={`flex flex-col border-r w-80 shrink-0 ${mobileView === 'thread' ? 'hidden md:flex' : 'flex'}`}
            style={{ borderColor: 'var(--border)' }}
          >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-4 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                Support
                {totalUnread > 0 && (
                  <span
                    className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    {totalUnread}
                  </span>
                )}
              </h1>
              <button
                onClick={() => { setComposing(true); setSelected(null); setMobileView('thread') }}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-border/30"
                style={{ color: 'var(--primary)' }}
                title="New message"
              >
                <Plus size={13} />
                New
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={18} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
                </div>
              ) : threads.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center px-4">
                  <MessageSquare size={28} style={{ color: 'var(--border)' }} />
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    No messages yet
                  </p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Send us a message and we'll get back to you.
                  </p>
                </div>
              ) : (
                threads.map(t => (
                  <button
                    key={t.id}
                    onClick={() => selectThread(t)}
                    className="w-full text-left px-3 py-3 rounded-xl transition-colors flex items-start gap-2.5"
                    style={{
                      backgroundColor: selected?.id === t.id && !composing ? 'oklch(0.36 0.07 145 / 0.08)' : 'transparent',
                    }}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.12)', color: 'var(--primary)' }}
                    >
                      FS
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span
                          className="truncate text-sm"
                          style={{ color: 'var(--foreground)', fontWeight: t.unreadUser > 0 ? 700 : 500 }}
                        >
                          {t.subject}
                        </span>
                        <span className="shrink-0 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {fmtTime(t.lastMessageAt)}
                        </span>
                      </div>
                      <p className="truncate text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {t.preview}
                      </p>
                    </div>
                    {t.unreadUser > 0 && (
                      <div
                        className="mt-1 h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: 'var(--primary)' }}
                      />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* RIGHT: compose or thread view */}
          <div className={`flex flex-1 flex-col min-w-0 ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>

            {/* ── Compose new thread ────────────────────────────────────── */}
            {composing ? (
              <>
                <div className="shrink-0 flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-3">
                    <button
                      className="md:hidden rounded-lg p-1.5 transition-colors hover:bg-border/30"
                      onClick={() => { setComposing(false); setMobileView('list') }}
                    >
                      <ArrowLeft size={16} style={{ color: 'var(--muted-foreground)' }} />
                    </button>
                    <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>New Message</p>
                  </div>
                  <button
                    className="hidden md:flex rounded-lg p-1.5 transition-colors hover:bg-border/30"
                    onClick={() => setComposing(false)}
                  >
                    <X size={15} style={{ color: 'var(--muted-foreground)' }} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
                  <div
                    className="rounded-xl p-4 text-sm"
                    style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.06)', color: 'var(--muted-foreground)' }}
                  >
                    Send a message to the Farmsy Support team. We'll reply as soon as possible.
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Subject</label>
                    <input
                      type="text"
                      value={newSubject}
                      onChange={e => setNewSubject(e.target.value)}
                      placeholder="What's this about?"
                      className="rounded-xl border px-4 py-2.5 text-sm outline-none"
                      style={{
                        borderColor: 'var(--border)',
                        backgroundColor: 'var(--background)',
                        color: 'var(--foreground)',
                      }}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Message</label>
                    <textarea
                      value={newBody}
                      onChange={e => setNewBody(e.target.value)}
                      placeholder="Describe your question or issue…"
                      rows={6}
                      className="flex-1 resize-none rounded-xl border px-4 py-3 text-sm outline-none leading-relaxed"
                      style={{
                        borderColor: 'var(--border)',
                        backgroundColor: 'var(--background)',
                        color: 'var(--foreground)',
                        minHeight: '140px',
                      }}
                    />
                  </div>

                  {composeError && (
                    <p className="text-xs" style={{ color: 'var(--destructive)' }}>{composeError}</p>
                  )}
                </div>

                <div className="shrink-0 px-5 py-4" style={{ borderTop: '1px solid var(--border)' }}>
                  <button
                    onClick={handleSendNew}
                    disabled={sendingNew || !newSubject.trim() || !newBody.trim()}
                    className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    {sendingNew ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Send Message
                  </button>
                </div>
              </>
            ) : selected ? (
              /* ── Thread view ──────────────────────────────────────────── */
              <>
                <div className="shrink-0 flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <button
                    className="md:hidden rounded-lg p-1.5 transition-colors hover:bg-border/30"
                    onClick={() => setMobileView('list')}
                  >
                    <ArrowLeft size={16} style={{ color: 'var(--muted-foreground)' }} />
                  </button>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{selected.subject}</p>
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Farmsy Support</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                  {loadingMsgs ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 size={18} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
                    </div>
                  ) : (
                    groupedMessages().map(group => (
                      <div key={group.label}>
                        <div className="flex items-center gap-2 my-3">
                          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
                          <span className="text-[10px] font-medium px-2" style={{ color: 'var(--muted-foreground)' }}>
                            {group.label}
                          </span>
                          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
                        </div>
                        <div className="space-y-3">
                          {group.msgs.map(m => <Bubble key={m.id} msg={m} />)}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={bottomRef} />
                </div>

                <div className="shrink-0 px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={textareaRef}
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={1}
                      placeholder="Type a reply… (Enter to send)"
                      className="flex-1 resize-none rounded-2xl border px-4 py-2.5 text-sm outline-none leading-relaxed"
                      style={{
                        borderColor: 'var(--border)',
                        backgroundColor: 'var(--background)',
                        color: 'var(--foreground)',
                        minHeight: '42px',
                        maxHeight: '120px',
                      }}
                      onInput={e => {
                        const el = e.currentTarget
                        el.style.height = 'auto'
                        el.style.height = `${Math.min(el.scrollHeight, 120)}px`
                      }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!reply.trim() || sending}
                      className="shrink-0 flex items-center justify-center h-10 w-10 rounded-full transition-opacity hover:opacity-85 disabled:opacity-40"
                      style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                    >
                      {sending
                        ? <Loader2 size={16} className="animate-spin" />
                        : <Send size={16} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* ── Empty state ──────────────────────────────────────────── */
              <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-3 px-8">
                <MessageSquare size={36} style={{ color: 'var(--border)' }} strokeWidth={1.5} />
                <div className="text-center">
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                    Contact Farmsy Support
                  </p>
                  <p className="text-xs max-w-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Send us a message and we'll reply right here — we typically get back to you within one business day.
                  </p>
                </div>
                <button
                  onClick={() => setComposing(true)}
                  className="mt-1 flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  <Plus size={14} />
                  New Message
                </button>

                {/* Direct email options (merged from the old Contact page) */}
                <div className="mt-8 w-full max-w-sm">
                  <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--muted-foreground)' }}>
                    Prefer email?
                  </p>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: 'General support', email: 'info@farmsy.nl',     subject: 'Support request' },
                      { label: 'Farm owners',     email: 'farms@farmsy.nl',    subject: 'Farm owner inquiry' },
                      { label: 'Feedback',        email: 'feedback@farmsy.nl', subject: 'Feedback' },
                    ].map(({ label, email, subject }) => (
                      <a
                        key={email}
                        href={`mailto:${email}?subject=${encodeURIComponent(subject)}`}
                        className="flex items-center gap-3 rounded-xl border px-4 py-2.5 transition-colors hover:bg-border/20"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <Mail size={15} style={{ color: 'var(--primary)' }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{label}</span>
                        <span className="ml-auto text-xs" style={{ color: 'var(--muted-foreground)' }}>{email}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
