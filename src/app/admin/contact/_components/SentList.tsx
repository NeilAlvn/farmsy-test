'use client'

import { CheckCircle2, Loader2, Megaphone, Users } from 'lucide-react'
import type { BulkSendRow, ConversationRow } from '../actions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  const d   = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1)  return 'just now'
  if (diffMins < 60) return `${diffMins}m`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 7)  return `${diffDays}d`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function Avatar({ name }: { name: string }) {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
      style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.12)', color: 'var(--primary)' }}
    >
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

// ─── Individual sent thread row ───────────────────────────────────────────────

function SentThreadRow({
  thread,
  selected,
  onClick,
}: {
  thread: ConversationRow
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-3 flex items-start gap-2.5 transition-colors rounded-xl"
      style={{
        backgroundColor: selected ? 'oklch(0.36 0.07 145 / 0.08)' : 'transparent',
      }}
    >
      <Avatar name={thread.userName} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span className="truncate text-xs" style={{ color: 'var(--muted-foreground)' }}>
            To: {thread.userName}
          </span>
          <span className="shrink-0 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {fmtTime(thread.lastMessageAt)}
          </span>
        </div>
        <p className="truncate text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          {thread.subject}
        </p>
        <div className="mt-1 flex items-center gap-1">
          <CheckCircle2 size={11} style={{ color: 'var(--primary)' }} />
          <span className="text-xs" style={{ color: 'var(--primary)' }}>Delivered</span>
        </div>
      </div>
    </button>
  )
}

// ─── Bulk campaign row ────────────────────────────────────────────────────────

function BulkSendCampaignRow({
  bulkSend,
  selected,
  onClick,
}: {
  bulkSend: BulkSendRow
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-3 flex items-start gap-2.5 transition-colors rounded-xl"
      style={{
        backgroundColor: selected ? 'oklch(0.36 0.07 145 / 0.08)' : 'transparent',
      }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: 'oklch(0.6 0.1 230 / 0.12)', color: 'oklch(0.6 0.1 230)' }}
      >
        <Megaphone size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span className="truncate text-xs" style={{ color: 'var(--muted-foreground)' }}>
            <Users size={10} className="inline mr-0.5 mb-px" />
            {bulkSend.recipientCount} recipient{bulkSend.recipientCount !== 1 ? 's' : ''}
          </span>
          <span className="shrink-0 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {fmtTime(bulkSend.sentAt)}
          </span>
        </div>
        <p className="truncate text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          {bulkSend.subject}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--primary)' }}>
            {bulkSend.successCount} delivered
          </span>
          {bulkSend.failedCount > 0 && (
            <span className="text-xs text-red-500">
              {bulkSend.failedCount} failed
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── SentList ─────────────────────────────────────────────────────────────────

interface SentListProps {
  threads: ConversationRow[]
  bulkSends: BulkSendRow[]
  loading: boolean
  selectedThread: ConversationRow | null
  selectedBulkSend: BulkSendRow | null
  onSelectThread: (c: ConversationRow) => void
  onSelectBulkSend: (b: BulkSendRow) => void
}

export default function SentList({
  threads,
  bulkSends,
  loading,
  selectedThread,
  selectedBulkSend,
  onSelectThread,
  onSelectBulkSend,
}: SentListProps) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 size={18} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">

      {/* ── Individual messages ──────────────────────────────────────────────── */}
      <div className="px-2 pt-2 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--muted-foreground)' }}>
          Messages
        </p>
      </div>

      {threads.length === 0 ? (
        <p className="px-2 py-3 text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
          No sent messages yet. Use Compose to message a user.
        </p>
      ) : (
        threads.map(t => (
          <SentThreadRow
            key={t.id}
            thread={t}
            selected={selectedThread?.id === t.id}
            onClick={() => onSelectThread(t)}
          />
        ))
      )}

      {/* ── Campaigns ────────────────────────────────────────────────────────── */}
      <div
        className="px-2 pt-4 pb-1 mt-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--muted-foreground)' }}>
          Campaigns
        </p>
      </div>

      {bulkSends.length === 0 ? (
        <p className="px-2 py-3 text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
          No campaigns yet. Use Bulk Send to message multiple users at once.
        </p>
      ) : (
        bulkSends.map(b => (
          <BulkSendCampaignRow
            key={b.id}
            bulkSend={b}
            selected={selectedBulkSend?.id === b.id}
            onClick={() => onSelectBulkSend(b)}
          />
        ))
      )}
    </div>
  )
}
