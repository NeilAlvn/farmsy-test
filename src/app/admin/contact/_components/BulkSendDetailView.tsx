'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Megaphone, Users, XCircle } from 'lucide-react'
import { getBulkSendRecipients, type BulkSendRecipientRow, type BulkSendRow } from '../actions'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: BulkSendRecipientRow['status'] }) {
  if (status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.12)', color: 'var(--primary)' }}>
        <CheckCircle2 size={10} />
        Delivered
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-red-50 text-red-600">
        <XCircle size={10} />
        Failed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
      Pending
    </span>
  )
}

interface BulkSendDetailViewProps {
  bulkSend: BulkSendRow
}

export default function BulkSendDetailView({ bulkSend }: BulkSendDetailViewProps) {
  const [recipients, setRecipients] = useState<BulkSendRecipientRow[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    setLoading(true)
    getBulkSendRecipients(bulkSend.id).then(data => {
      setRecipients(data)
      setLoading(false)
    })
  }, [bulkSend.id])

  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'oklch(0.6 0.1 230 / 0.12)', color: 'oklch(0.6 0.1 230)' }}
          >
            <Megaphone size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold truncate" style={{ color: 'var(--foreground)' }}>
              {bulkSend.subject}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              Sent {fmtDate(bulkSend.sentAt)}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-3 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Users size={13} style={{ color: 'var(--muted-foreground)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              {bulkSend.recipientCount}
            </span>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>recipients</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={13} style={{ color: 'var(--primary)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--primary)' }}>
              {bulkSend.successCount}
            </span>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>delivered</span>
          </div>
          {bulkSend.failedCount > 0 && (
            <div className="flex items-center gap-1.5">
              <XCircle size={13} className="text-red-500" />
              <span className="text-sm font-medium text-red-500">{bulkSend.failedCount}</span>
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>failed</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Message body ───────────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--muted-foreground)' }}>
          Message
        </p>
        <pre
          className="whitespace-pre-wrap text-sm leading-relaxed font-sans"
          style={{ color: 'var(--foreground)' }}
        >
          {bulkSend.body}
        </pre>
      </div>

      {/* ── Recipients list ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--muted-foreground)' }}>
          Recipients
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={18} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
          </div>
        ) : recipients.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--muted-foreground)' }}>
            No recipient data available.
          </p>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {recipients.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2.5 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                    {r.userName}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                    {r.userEmail}
                  </p>
                  {r.error && (
                    <p className="text-xs text-red-500 mt-0.5 truncate">{r.error}</p>
                  )}
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
