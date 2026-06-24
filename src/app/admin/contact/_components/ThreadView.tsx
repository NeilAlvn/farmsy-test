'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Archive, Loader2, Send, Zap } from 'lucide-react'
import {
  archiveThread,
  deleteSubmission,
  getContactSubmission,
  getThreadMessages,
  markThreadRead,
  replyToSubmission,
  replyToThread,
  type ConversationRow,
  type MessageRow,
} from '../actions'
import { useToast } from '@/app/_components/ToastProvider'
import MessageBubble from './MessageBubble'

// ─── Template presets ─────────────────────────────────────────────────────────

const TEMPLATES = [
  { key: 'general',  label: 'General response' },
  { key: 'winback',  label: 'Win-back offer (COMEBACK20)' },
  { key: 'trial',    label: 'Trial reminder' },
  { key: 'thanks',   label: 'Thank you note' },
] as const

function templateBody(key: string, firstName: string): string {
  switch (key) {
    case 'winback':
      return `Hi ${firstName},\n\nWe noticed you haven't been active on Farmsy for a while. We'd love to have you back!\n\nAs a special offer, use code COMEBACK20 for 20% off your next subscription month.\n\nBest,\nThe Farmsy Team`
    case 'trial':
      return `Hi ${firstName},\n\nJust a friendly reminder that your free trial ends soon. Upgrade now to keep access to all Farmsy features without interruption.\n\nIf you have any questions, we're here to help.\n\nBest,\nThe Farmsy Team`
    case 'thanks':
      return `Hi ${firstName},\n\nThank you for reaching out! We appreciate your feedback and will get back to you as soon as possible.\n\nBest,\nThe Farmsy Team`
    default: // 'general'
      return `Hi ${firstName},\n\nThank you for contacting Farmsy. \n\nBest,\nThe Farmsy Team`
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtStarted(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function getDateLabel(iso: string): string {
  const d        = new Date(iso)
  const now      = new Date()
  const todayMs  = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterMs = todayMs - 86_400_000
  const msgMs    = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

  if (msgMs === todayMs)  return 'Today'
  if (msgMs === yesterMs) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

type ListItem =
  | { kind: 'separator'; label: string; key: string }
  | { kind: 'message';   data: MessageRow }

function buildList(messages: MessageRow[]): ListItem[] {
  const result: ListItem[] = []
  let lastLabel = ''
  for (const m of messages) {
    const label = getDateLabel(m.createdAt)
    if (label !== lastLabel) {
      result.push({ kind: 'separator', label, key: `sep-${m.id}` })
      lastLabel = label
    }
    result.push({ kind: 'message', data: m })
  }
  return result
}

function sourceBadgeLabel(source: string): string | null {
  switch (source) {
    case 'contact_form': return 'Contact Form'
    case 'in_app':       return 'In-app'
    default:             return null
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  conversation: ConversationRow
  onReplySent: (updated: ConversationRow) => void
  onRemoved:   (id: string) => void
}

export default function ThreadView({ conversation, onReplySent, onRemoved }: Props) {
  const { toast } = useToast()

  const [messages,      setMessages]      = useState<MessageRow[]>([])
  const [loadingMsgs,   setLoadingMsgs]   = useState(true)
  const [replyBody,     setReplyBody]     = useState('')
  const [sending,       setSending]       = useState(false)
  const [archiving,     setArchiving]     = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  const scrollEndRef      = useRef<HTMLDivElement>(null)
  const textareaRef       = useRef<HTMLTextAreaElement>(null)
  const templateButtonRef = useRef<HTMLButtonElement>(null)
  const templatePopRef    = useRef<HTMLDivElement>(null)

  // ── Load messages when conversation changes ───────────────────────────────

  const loadMessages = useCallback(async () => {
    setLoadingMsgs(true)
    try {
      if (conversation.type === 'thread' && conversation.threadId) {
        const rows = await getThreadMessages(conversation.threadId)
        setMessages(rows)
      } else if (conversation.type === 'submission') {
        const sub = await getContactSubmission(conversation.id)
        if (sub) {
          setMessages([{
            id:          sub.id,
            threadId:    sub.id,
            senderType:  'user',
            body:        sub.message ?? '',
            source:      'contact_form',
            emailStatus: 'skipped',
            createdAt:   sub.created_at,
          }])
        }
      }
    } finally {
      setLoadingMsgs(false)
    }
  }, [conversation.id, conversation.type, conversation.threadId])

  useEffect(() => {
    setMessages([])
    setReplyBody('')
    loadMessages()
  }, [conversation.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mark thread read when opened (fire-and-forget)
  useEffect(() => {
    if (conversation.type === 'thread' && conversation.threadId && conversation.unreadAdmin > 0) {
      markThreadRead(conversation.threadId).catch(() => {})
      onReplySent({ ...conversation, unreadAdmin: 0 })
    }
  }, [conversation.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll to bottom when messages update ────────────────────────────────

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [messages])

  // ── Close template popover on outside click ───────────────────────────────

  useEffect(() => {
    if (!showTemplates) return
    function handler(e: MouseEvent) {
      if (
        templatePopRef.current && !templatePopRef.current.contains(e.target as Node) &&
        templateButtonRef.current && !templateButtonRef.current.contains(e.target as Node)
      ) {
        setShowTemplates(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showTemplates])

  // ── Reply ─────────────────────────────────────────────────────────────────

  async function handleSend() {
    const body = replyBody.trim()
    if (!body || sending) return
    setSending(true)

    try {
      let updatedConv: ConversationRow

      if (conversation.type === 'submission') {
        const result = await replyToSubmission(conversation.id, body)
        if (!result.ok || !result.threadId) {
          toast({ type: 'error', title: 'Failed to send — please try again' })
          return
        }
        // After first reply, the submission becomes a full thread
        updatedConv = {
          ...conversation,
          type:          'thread',
          threadId:      result.threadId,
          isReplied:     true,
          lastMessageAt: new Date().toISOString(),
          preview:       body.slice(0, 100),
          unreadAdmin:   0,
        }
        // Optimistically append: the imported original + the admin reply
        setMessages(prev => [
          ...prev,
          {
            id:          `opt-reply-${Date.now()}`,
            threadId:    result.threadId!,
            senderType:  'admin',
            body,
            source:      'in_app',
            emailStatus: 'sent',
            createdAt:   new Date().toISOString(),
          },
        ])
      } else {
        const result = await replyToThread(conversation.threadId!, body)
        if (!result.ok) {
          toast({ type: 'error', title: 'Failed to send — please try again' })
          return
        }
        updatedConv = {
          ...conversation,
          isReplied:     true,
          lastMessageAt: new Date().toISOString(),
          preview:       body.slice(0, 100),
        }
        setMessages(prev => [
          ...prev,
          {
            id:          `opt-reply-${Date.now()}`,
            threadId:    conversation.threadId!,
            senderType:  'admin',
            body,
            source:      'in_app',
            emailStatus: 'sent',
            createdAt:   new Date().toISOString(),
          },
        ])
      }

      setReplyBody('')
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
      onReplySent(updatedConv)
      toast({ type: 'success', title: 'Reply sent' })
    } finally {
      setSending(false)
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setReplyBody(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 96) + 'px' // max ~4 lines
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  function applyTemplate(key: string) {
    const firstName = conversation.userName.split(' ')[0] || conversation.userName
    const body      = templateBody(key, firstName)
    setReplyBody(body)
    setShowTemplates(false)
    // Set textarea height after content is applied
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 96) + 'px'
        textareaRef.current.focus()
      }
    })
  }

  // ── Archive ───────────────────────────────────────────────────────────────

  async function handleArchive() {
    if (archiving) return
    setArchiving(true)
    try {
      if (conversation.type === 'thread' && conversation.threadId) {
        await archiveThread(conversation.threadId)
      } else if (conversation.type === 'submission') {
        await deleteSubmission(conversation.id)
      }
      onRemoved(conversation.id)
    } finally {
      setArchiving(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const list         = buildList(messages)
  const srcLabel     = sourceBadgeLabel(conversation.source)
  const firstName    = conversation.userName.split(' ')[0]
  const canSend      = replyBody.trim().length > 0 && !sending

  const TOPIC_COLOR: Record<string, string> = {
    support:     '#3B82F6',
    billing:     '#D97706',
    partnership: '#8B5CF6',
    feedback:    'var(--primary)',
    other:       'var(--muted-foreground)',
  }
  const topicColor = TOPIC_COLOR[(conversation.topic ?? 'other').toLowerCase()] ?? 'var(--muted-foreground)'
  const topicBg    = topicColor.startsWith('var') ? 'rgba(0,0,0,0.06)' : `${topicColor}1e`

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100%' }}>

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-5 py-3.5"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-start justify-between gap-4">

          {/* Left: avatar + details */}
          <div className="flex items-start gap-3 min-w-0">
            {/* 40px avatar */}
            <div
              className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-base font-bold text-white"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {conversation.userName.trim().charAt(0).toUpperCase()}
            </div>

            {/* Name / email / badges */}
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-2">
                <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                  {conversation.userName}
                </span>
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {conversation.userEmail}
                </span>
              </div>

              {/* Topic + source badges */}
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {conversation.topic && (
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-semibold"
                    style={{ backgroundColor: topicBg, color: topicColor }}
                  >
                    {conversation.topic}
                  </span>
                )}
                {srcLabel && (
                  <span
                    className="px-2 py-0.5 rounded text-[10px]"
                    style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--muted-foreground)' }}
                  >
                    {srcLabel}
                  </span>
                )}
                <span
                  className="text-[10px]"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Started {fmtStarted(conversation.lastMessageAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Right: archive button */}
          <button
            onClick={handleArchive}
            disabled={archiving}
            title="Archive conversation"
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              border:           '1px solid var(--border)',
              color:            'var(--muted-foreground)',
              backgroundColor:  'transparent',
              opacity:          archiving ? 0.5 : 1,
              cursor:           archiving ? 'default' : 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--cream)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {archiving
              ? <Loader2 size={12} className="animate-spin" />
              : <Archive size={12} />}
            Archive
          </button>
        </div>
      </div>

      {/* ── MESSAGES AREA ────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto px-5 py-4 space-y-1"
        style={{ minHeight: 0 }}
      >
        {loadingMsgs ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={18} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
          </div>
        ) : list.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              No messages yet
            </p>
          </div>
        ) : (
          list.map(item => {
            if (item.kind === 'separator') {
              return (
                <div key={item.key} className="flex justify-center py-3">
                  <span
                    className="px-3 py-1 rounded-full text-[10px] font-medium"
                    style={{
                      backgroundColor: 'var(--cream)',
                      color:            'var(--muted-foreground)',
                      border:           '1px solid var(--border)',
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              )
            }
            return (
              <div key={item.data.id} className="py-0.5">
                <MessageBubble
                  message={item.data}
                  userName={conversation.userName}
                />
              </div>
            )
          })
        )}
        {/* Scroll anchor */}
        <div ref={scrollEndRef} />
      </div>

      {/* ── REPLY BAR ────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-3 pb-3 pt-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
        >
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={replyBody}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={`Reply to ${firstName}…`}
            rows={1}
            disabled={sending}
            className="w-full resize-none px-4 pt-3 pb-1 text-sm focus:outline-none bg-transparent"
            style={{
              color:    'var(--foreground)',
              minHeight: 42,
              maxHeight: 96,
            }}
          />

          {/* Bottom bar: template picker + send button */}
          <div className="flex items-center justify-between px-3 pb-2.5 pt-1 gap-2">

            {/* Template picker */}
            <div className="relative">
              <button
                ref={templateButtonRef}
                onClick={() => setShowTemplates(v => !v)}
                title="Quick templates"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  backgroundColor: showTemplates ? 'var(--cream)' : 'transparent',
                  border:          '1px solid var(--border)',
                  color:           'var(--muted-foreground)',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--cream)')}
                onMouseLeave={e => !showTemplates && (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Zap size={11} />
                Templates
              </button>

              {showTemplates && (
                <div
                  ref={templatePopRef}
                  className="absolute bottom-full left-0 mb-2 rounded-xl shadow-lg overflow-hidden z-20"
                  style={{
                    backgroundColor: 'var(--card)',
                    border:          '1px solid var(--border)',
                    minWidth:        200,
                  }}
                >
                  {TEMPLATES.map(t => (
                    <button
                      key={t.key}
                      onClick={() => applyTemplate(t.key)}
                      className="w-full text-left px-4 py-2.5 text-xs transition-colors"
                      style={{ color: 'var(--foreground)' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--cream)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Hint + Send */}
            <div className="flex items-center gap-3">
              <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                ⌘↵ to send
              </span>
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-opacity"
                style={{
                  backgroundColor: canSend ? 'var(--primary)' : 'var(--border)',
                  color:           canSend ? 'white'           : 'var(--muted-foreground)',
                  cursor:          canSend ? 'pointer'         : 'default',
                }}
              >
                {sending
                  ? <><Loader2 size={11} className="animate-spin" /> Sending…</>
                  : <><Send size={11} /> Send</>}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
