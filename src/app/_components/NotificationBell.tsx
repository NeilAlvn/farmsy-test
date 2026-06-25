'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell, CheckCircle2, XCircle, Sparkles, Clock,
  AlertCircle, CreditCard, LogIn, MessageSquare, ShieldAlert, Info,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  created_at: string
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

function NotifIcon({ type }: { type: string }) {
  const cls = 'w-4 h-4 shrink-0'
  switch (type) {
    case 'subscription_activated': return <CheckCircle2 className={cls} style={{ color: 'var(--primary)' }} />
    case 'subscription_cancelled': return <XCircle className={cls} style={{ color: 'var(--destructive)' }} />
    case 'trial_started':          return <Sparkles className={cls} style={{ color: 'var(--primary)' }} />
    case 'trial_ending':           return <Clock className={cls} style={{ color: '#d97706' }} />
    case 'payment_failed':         return <AlertCircle className={cls} style={{ color: 'var(--destructive)' }} />
    case 'payment_succeeded':      return <CreditCard className={cls} style={{ color: 'var(--primary)' }} />
    case 'account_login':          return <LogIn className={cls} style={{ color: 'var(--muted-foreground)' }} />
    case 'session_kicked':         return <ShieldAlert className={cls} style={{ color: '#d97706' }} />
    case 'lifetime_activated':     return <Sparkles className={cls} style={{ color: 'var(--primary)' }} />
    case 'new_message':            return <MessageSquare className={cls} style={{ color: 'var(--primary)' }} />
    default:                       return <Info className={cls} style={{ color: 'var(--muted-foreground)' }} />
  }
}

export default function NotificationBell() {
  const router                        = useRouter()
  const [userId, setUserId]           = useState<string | null>(null)
  const [token, setToken]             = useState<string | null>(null)
  const [notifs, setNotifs]           = useState<Notification[]>([])
  const [open, setOpen]               = useState(false)
  const [loading, setLoading]         = useState(false)
  const panelRef                      = useRef<HTMLDivElement>(null)
  const unread                        = notifs.filter(n => !n.read).length

  // Track auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
      setToken(session?.access_token ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null)
      setToken(session?.access_token ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const fetchNotifs = useCallback(async (t: string) => {
    try {
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!res.ok) return
      setNotifs(await res.json())
    } catch { /* ignore */ }
  }, [])

  // Fetch on mount + poll every 30s
  useEffect(() => {
    if (!token) { setNotifs([]); return }
    fetchNotifs(token)
    const id = setInterval(() => fetchNotifs(token), 30_000)
    return () => clearInterval(id)
  }, [token, fetchNotifs])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Mark all as read when opening
  async function handleOpen() {
    setOpen(o => !o)
    if (!open && unread > 0 && token) {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    }
  }

  async function markAllRead() {
    if (!token) return
    setLoading(true)
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    setLoading(false)
  }

  // Don't render if not logged in
  if (!userId) return null

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-border/30"
        aria-label="Notifications"
      >
        <Bell size={16} style={{ color: 'var(--muted-foreground)' }} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-0.5 text-[9px] font-bold text-white"
            style={{ backgroundColor: 'var(--destructive)' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-dropdown absolute right-0 top-full z-[200] mt-2 w-80 overflow-hidden rounded-2xl border border-border/60 bg-background shadow-[0_8px_24px_-8px_rgba(0,0,0,0.15)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Notifications</p>
            {notifs.some(n => !n.read) && (
              <button
                onClick={markAllRead}
                disabled={loading}
                className="text-xs transition-opacity hover:opacity-70 disabled:opacity-40"
                style={{ color: 'var(--primary)' }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Bell size={24} style={{ color: 'var(--border)' }} />
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No notifications yet</p>
              </div>
            ) : (
              notifs.map(n => {
                const isMessage = n.type === 'new_message'
                return (
                  <div
                    key={n.id}
                    role={isMessage ? 'button' : undefined}
                    onClick={isMessage ? () => { setOpen(false); router.push('/messages') } : undefined}
                    className={`flex gap-3 px-4 py-3 border-b border-border/40 last:border-0 transition-colors ${isMessage ? 'cursor-pointer hover:bg-border/20' : ''}`}
                    style={{ backgroundColor: n.read ? 'transparent' : 'oklch(0.36 0.07 145 / 0.04)' }}
                  >
                    <div className="mt-0.5">
                      <NotifIcon type={n.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--foreground)' }}>{n.title}</p>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{n.message}</p>
                      <p className="text-[10px] mt-1" style={{ color: 'var(--border)' }}>{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read && (
                      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
