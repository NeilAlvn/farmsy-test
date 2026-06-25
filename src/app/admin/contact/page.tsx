'use client'

import { useCallback, useEffect, useState } from 'react'
import { Pencil, Send } from 'lucide-react'
import {
  getInboxThreads,
  getSentThreads,
  getBulkSends,
  type BulkSendRow,
  type ConversationRow,
} from './actions'

import ThreadList          from './_components/ThreadList'
import ThreadView          from './_components/ThreadView'
import ComposeModal        from './_components/ComposeModal'
import SentList            from './_components/SentList'
import BulkSendDetailView  from './_components/BulkSendDetailView'
import BulkSendModal       from './_components/BulkSendModal'

const POLL_INTERVAL = 30_000

type View = 'inbox' | 'sent'

export default function ContactPage() {
  // ── Core state ──────────────────────────────────────────────────────────────
  const [view, setView]             = useState<View>('inbox')
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [loading, setLoading]             = useState(true)
  const [selected, setSelected]           = useState<ConversationRow | null>(null)
  const [showCompose, setShowCompose]     = useState(false)
  const [showBulkSend, setShowBulkSend]   = useState(false)

  // ── Sent-view state ─────────────────────────────────────────────────────────
  const [sentThreads, setSentThreads]       = useState<ConversationRow[]>([])
  const [bulkSends, setBulkSends]           = useState<BulkSendRow[]>([])
  const [loadingSent, setLoadingSent]       = useState(false)
  const [selectedBulkSend, setSelectedBulkSend] = useState<BulkSendRow | null>(null)

  // ── Filter / search state ───────────────────────────────────────────────────
  const [search, setSearch]           = useState('')
  const [topicFilter, setTopicFilter] = useState('All')

  // ── Data fetching ────────────────────────────────────────────────────────────
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

  const loadSent = useCallback(async (silent = false) => {
    if (!silent) setLoadingSent(true)
    try {
      const [threads, campaigns] = await Promise.all([getSentThreads(), getBulkSends()])
      setSentThreads(threads)
      setBulkSends(campaigns)
    } finally {
      if (!silent) setLoadingSent(false)
    }
  }, [])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => {
      if (view === 'inbox') load(true)
      else loadSent(true)
    }, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [load, loadSent, view])

  // ── View switching ────────────────────────────────────────────────────────────
  function switchView(v: View) {
    setView(v)
    setSelected(null)
    setSelectedBulkSend(null)
    if (v === 'sent') loadSent()
  }

  // ── Callbacks ─────────────────────────────────────────────────────────────────
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

  function onBulkSent(bulkSend: BulkSendRow) {
    setBulkSends(prev => [bulkSend, ...prev])
    setSelectedBulkSend(bulkSend)
    setShowBulkSend(false)
    setView('sent')
  }

  // ── Derived counts ────────────────────────────────────────────────────────────
  const totalCount     = conversations.length
  const unrepliedCount = conversations.filter(c => !c.isReplied).length

  // ── Render ────────────────────────────────────────────────────────────────────
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

        {/* ── LEFT: list + Inbox/Sent tabs ────────────────────────────────── */}
        <div
          className="w-72 lg:w-80 flex-shrink-0 flex flex-col"
          style={{ borderRight: '1px solid var(--border)' }}
        >
          {/* Tab bar */}
          <div
            className="flex shrink-0"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            {(['inbox', 'sent'] as const).map(v => (
              <button
                key={v}
                onClick={() => switchView(v)}
                className="flex-1 py-2.5 text-sm font-medium capitalize transition-colors relative"
                style={{
                  color: view === v ? 'var(--foreground)' : 'var(--muted-foreground)',
                  backgroundColor: 'transparent',
                }}
              >
                {v === 'inbox' ? 'Inbox' : 'Sent'}
                {view === v && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ backgroundColor: 'var(--primary)' }}
                  />
                )}
              </button>
            ))}
          </div>

          {view === 'inbox' ? (
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
          ) : (
            <SentList
              threads={sentThreads}
              bulkSends={bulkSends}
              loading={loadingSent}
              selectedThread={selected}
              selectedBulkSend={selectedBulkSend}
              onSelectThread={c => { setSelected(c); setSelectedBulkSend(null) }}
              onSelectBulkSend={b => { setSelectedBulkSend(b); setSelected(null) }}
            />
          )}
        </div>

        {/* ── RIGHT: thread view or bulk send detail ───────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {view === 'sent' && selectedBulkSend ? (
            <BulkSendDetailView bulkSend={selectedBulkSend} />
          ) : selected ? (
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
                {view === 'inbox' ? 'Select a conversation to get started' : 'Select a message or campaign'}
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
