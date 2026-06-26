'use client'

import { useCallback, useEffect, useState } from 'react'
import { Pencil, Send } from 'lucide-react'
import {
  getInboxThreads,
  type ConversationRow,
} from './actions'

import ThreadList   from './_components/ThreadList'
import ThreadView   from './_components/ThreadView'
import ComposeModal from './_components/ComposeModal'
import BulkSendModal from './_components/BulkSendModal'

const POLL_INTERVAL = 30_000

export default function ContactPage() {
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [loading, setLoading]             = useState(true)
  const [selected, setSelected]           = useState<ConversationRow | null>(null)
  const [showCompose, setShowCompose]     = useState(false)
  const [showBulkSend, setShowBulkSend]   = useState(false)

  const [search, setSearch]           = useState('')
  const [topicFilter, setTopicFilter] = useState('All')

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await getInboxThreads()
      setConversations(data)
      if (selected) {
        const refreshed = data.find(c => c.id === selected.id)
        if (refreshed) setSelected(refreshed)
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [selected])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => load(true), POLL_INTERVAL)
    return () => clearInterval(id)
  }, [load])

  function onReplySent(updatedConversation: ConversationRow) {
    setConversations(prev =>
      prev.map(c => c.id === updatedConversation.id ? updatedConversation : c)
    )
    setSelected(updatedConversation)
  }

  function onComposeSent(threads: ConversationRow[]) {
    setConversations(prev => [...threads, ...prev])
    if (threads[0]) setSelected(threads[0])
    setShowCompose(false)
  }

  function onRemoved(id: string) {
    setConversations(prev => prev.filter(c => c.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  function onBulkSent() {
    setShowBulkSend(false)
    load(true)
  }

  const totalCount     = conversations.length
  const unrepliedCount = conversations.filter(c => !c.isReplied).length

  return (
    <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 4rem)' }}>

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            Contact
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {loading
              ? '…'
              : `${totalCount} conversations · ${unrepliedCount} unreplied`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkSend(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-border/20"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <Send size={14} />
            Bulk Send
          </button>
          <button
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-85"
            style={{ backgroundColor: 'var(--primary)', color: 'white' }}
          >
            <Pencil size={14} />
            Compose
          </button>
        </div>
      </div>

      {/* ── Two-column panel ─────────────────────────────────────────────────── */}
      <div
        className="flex-1 min-h-0 flex overflow-hidden rounded-2xl"
        style={{ border: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
      >

        {/* LEFT: thread list */}
        <div
          className="w-72 lg:w-80 flex-shrink-0 flex flex-col"
          style={{ borderRight: '1px solid var(--border)' }}
        >
          <ThreadList
            conversations={conversations}
            loading={loading}
            selected={selected}
            search={search}
            topicFilter={topicFilter}
            onSelect={setSelected}
            onSearchChange={setSearch}
            onTopicChange={setTopicFilter}
            onRemoved={onRemoved}
          />
        </div>

        {/* RIGHT: thread view */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {selected ? (
            <ThreadView
              conversation={selected}
              onReplySent={onReplySent}
              onRemoved={onRemoved}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                strokeLinejoin="round" style={{ color: 'var(--border)' }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
                Select a conversation to get started
              </p>
            </div>
          )}
        </div>
      </div>

      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onSent={onComposeSent}
        />
      )}

      {showBulkSend && (
        <BulkSendModal
          onClose={() => setShowBulkSend(false)}
          onSent={onBulkSent}
        />
      )}
    </div>
  )
}
