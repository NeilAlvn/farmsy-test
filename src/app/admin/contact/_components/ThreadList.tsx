'use client'

import { useState } from 'react'
import { Archive, Loader2, Search, Trash2 } from 'lucide-react'
import { archiveThread, deleteSubmission, type ConversationRow } from '../actions'

// ─── Constants ────────────────────────────────────────────────────────────────

const TOPICS = ['All', 'Support', 'Billing', 'Partnership', 'Other', 'Feedback'] as const

const TOPIC_STYLE: Record<string, { bg: string; color: string }> = {
  support:     { bg: 'rgba(59,130,246,0.12)',  color: '#3B82F6' },
  billing:     { bg: 'rgba(217,119,6,0.12)',   color: '#D97706' },
  partnership: { bg: 'rgba(139,92,246,0.12)',  color: '#8B5CF6' },
  feedback:    { bg: 'rgba(63,94,58,0.12)',    color: 'var(--primary)' },
  other:       { bg: 'rgba(0,0,0,0.08)',       color: 'var(--muted-foreground)' },
}
function topicStyle(topic: string) {
  return TOPIC_STYLE[topic.toLowerCase()] ?? TOPIC_STYLE.other
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  const date  = new Date(iso)
  const now   = new Date()
  const diffMs    = now.getTime() - date.getTime()
  const diffMins  = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays  = Math.floor(diffHours / 24)

  if (diffMins < 1)  return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'

  if (diffDays < 7) return date.toLocaleDateString('en-GB', { weekday: 'short' })

  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  conversations: ConversationRow[]
  loading: boolean
  selected: ConversationRow | null
  search: string
  topicFilter: string
  onSelect: (conv: ConversationRow) => void
  onSearchChange: (val: string) => void
  onTopicChange: (val: string) => void
  onRemoved: (id: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ThreadList({
  conversations, loading, selected,
  search, topicFilter,
  onSelect, onSearchChange, onTopicChange, onRemoved,
}: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [actingId,  setActingId]  = useState<string | null>(null)

  // Filter: topic first, then search query
  const filtered = conversations.filter(conv => {
    if (topicFilter !== 'All' && conv.topic?.toLowerCase() !== topicFilter.toLowerCase()) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      conv.userName.toLowerCase().includes(q)  ||
      conv.userEmail.toLowerCase().includes(q) ||
      conv.subject.toLowerCase().includes(q)   ||
      conv.preview.toLowerCase().includes(q)
    )
  })

  // Topic tab counts always reflect ALL conversations, not current search
  function countFor(t: string) {
    if (t === 'All') return conversations.length
    return conversations.filter(c => c.topic?.toLowerCase() === t.toLowerCase()).length
  }

  // ── Row actions ──────────────────────────────────────────────────────────────

  async function handleArchive(e: React.MouseEvent, conv: ConversationRow) {
    e.stopPropagation()
    if (actingId) return
    setActingId(conv.id)
    try {
      if (conv.type === 'thread' && conv.threadId) {
        await archiveThread(conv.threadId)
      } else if (conv.type === 'submission') {
        // Submissions have no is_archived — treat archive as delete
        await deleteSubmission(conv.id)
      }
      onRemoved(conv.id)
    } finally {
      setActingId(null)
    }
  }

  async function handleDelete(e: React.MouseEvent, conv: ConversationRow) {
    e.stopPropagation()
    if (actingId) return
    setActingId(conv.id)
    try {
      if (conv.type === 'submission') {
        await deleteSubmission(conv.id)
      } else if (conv.type === 'thread' && conv.threadId) {
        // Soft-delete threads (archive) — preserves history
        await archiveThread(conv.threadId)
      }
      onRemoved(conv.id)
    } finally {
      setActingId(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Search bar ─────────────────────────────────────────────────────── */}
      <div className="p-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="relative">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--muted-foreground)' }}
          />
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search conversations…"
            className="w-full pl-8 pr-3 py-2 rounded-xl text-xs focus:outline-none"
            style={{
              backgroundColor: 'var(--cream)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}
          />
        </div>
      </div>

      {/* ── Topic filter tabs ────────────────────────────────────────────────── */}
      <div className="px-3 pt-2 pb-2.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex flex-wrap gap-1">
          {TOPICS.map(t => {
            const count = countFor(t)
            return (
              <button
                key={t}
                onClick={() => onTopicChange(t)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                style={
                  topicFilter === t
                    ? { backgroundColor: 'var(--primary)', color: 'white' }
                    : { backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--foreground)' }
                }
              >
                {t}
                {count > 0 && (
                  <span className="ml-1 opacity-50">{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Conversation rows ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 size={18} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-14 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {search.trim() ? 'No results found' : 'No conversations'}
          </p>
        ) : (
          filtered.map(conv => {
            const isSelected = selected?.id === conv.id
            const isUnread   = conv.unreadAdmin > 0
            const isHovered  = hoveredId === conv.id
            const isActing   = actingId === conv.id
            const ts         = topicStyle(conv.topic ?? 'other')

            return (
              <div
                key={conv.id}
                onClick={() => !isActing && onSelect(conv)}
                onMouseEnter={() => setHoveredId(conv.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  padding: '10px 12px 10px 10px',
                  borderBottom: '1px solid var(--border)',
                  borderLeft: `3px solid ${isSelected ? 'var(--primary)' : 'transparent'}`,
                  backgroundColor: isSelected
                    ? 'rgba(63,94,58,0.07)'
                    : isHovered
                    ? 'var(--cream)'
                    : 'transparent',
                  cursor: isActing ? 'default' : 'pointer',
                  opacity: isActing ? 0.45 : 1,
                  transition: 'background-color 0.1s, opacity 0.15s',
                }}
              >
                <div className="flex items-start gap-2.5">

                  {/* ── Unread dot ──────────────────────────────────────────── */}
                  <div className="flex-shrink-0 pt-1.5" style={{ width: 8 }}>
                    {isUnread && (
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: 'var(--primary)' }}
                      />
                    )}
                  </div>

                  {/* ── Avatar ──────────────────────────────────────────────── */}
                  <div
                    className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    {conv.userName.trim().charAt(0).toUpperCase()}
                  </div>

                  {/* ── Text content ────────────────────────────────────────── */}
                  <div className="flex-1 min-w-0">

                    {/* Row 1: name + time (or action buttons on hover) */}
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span
                        className="text-sm truncate leading-tight"
                        style={{
                          fontWeight: isUnread ? 700 : 400,
                          color: 'var(--foreground)',
                        }}
                      >
                        {conv.userName}
                      </span>

                      {isHovered ? (
                        /* Action buttons slide in on hover, replacing the timestamp */
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button
                            onClick={e => handleArchive(e, conv)}
                            title="Archive"
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--muted-foreground)' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.06)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <Archive size={12} />
                          </button>
                          <button
                            onClick={e => handleDelete(e, conv)}
                            title="Delete"
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: '#DC2626' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(220,38,38,0.06)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ) : (
                        <span
                          className="text-[10px] flex-shrink-0"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          {fmtTime(conv.lastMessageAt)}
                        </span>
                      )}
                    </div>

                    {/* Row 2: subject (bold if unread) */}
                    <p
                      className="text-xs truncate mb-1 leading-tight"
                      style={{
                        fontWeight: isUnread ? 600 : 400,
                        color: isUnread ? 'var(--foreground)' : 'var(--muted-foreground)',
                      }}
                    >
                      {conv.subject}
                    </p>

                    {/* Row 3: topic badge + replied badge */}
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {conv.topic && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0"
                          style={{ backgroundColor: ts.bg, color: ts.color }}
                        >
                          {conv.topic}
                        </span>
                      )}
                      {conv.isReplied && (
                        <span
                          className="text-[10px] font-semibold flex-shrink-0"
                          style={{ color: 'var(--primary)' }}
                        >
                          ✓ Replied
                        </span>
                      )}
                    </div>

                    {/* Row 4: message preview */}
                    <p
                      className="text-[11px] truncate leading-relaxed"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      {conv.preview.slice(0, 60)}
                    </p>

                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
