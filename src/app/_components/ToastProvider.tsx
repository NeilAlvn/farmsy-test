'use client'

import {
  createContext, useContext, useState, useCallback,
  useEffect, useRef, type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { X, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ToastOptions {
  type?:     'success' | 'warning' | 'error' | 'info'
  title:     string
  message?:  string
  action?:   { label: string; onClick: () => void }
  duration?: number   // ms — 0 = sticky until dismissed
}

interface ToastItem extends ToastOptions {
  id:      string
  visible: boolean
}

interface ToastCtx {
  toast: (opts: ToastOptions) => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const Ctx = createContext<ToastCtx | null>(null)

export function useToast() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}

// ─── Individual toast ─────────────────────────────────────────────────────────

const ICONS = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error:   XCircle,
  info:    Info,
}

const COLORS = {
  success: { icon: '#16a34a', border: 'oklch(0.36 0.07 145 / 0.25)', bg: 'oklch(0.36 0.07 145 / 0.06)' },
  warning: { icon: '#d97706', border: 'oklch(0.72 0.15 80 / 0.35)',  bg: 'oklch(0.72 0.15 80 / 0.06)'  },
  error:   { icon: '#dc2626', border: 'oklch(0.62 0.2 25 / 0.3)',    bg: 'oklch(0.62 0.2 25 / 0.06)'   },
  info:    { icon: '#2563eb', border: 'oklch(0.55 0.2 260 / 0.3)',   bg: 'oklch(0.55 0.2 260 / 0.06)'  },
}

function Toast({
  item,
  onDismiss,
}: {
  item: ToastItem
  onDismiss: (id: string) => void
}) {
  const type   = item.type ?? 'info'
  const Icon   = ICONS[type]
  const colors = COLORS[type]

  return (
    <div
      role="alert"
      className="flex items-start gap-3 w-full max-w-sm rounded-2xl border px-4 py-3.5 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18)]"
      style={{
        backgroundColor: 'var(--background)',
        borderColor:     colors.border,
        transition:      'opacity 280ms ease, transform 280ms cubic-bezier(0.16,1,0.3,1)',
        opacity:         item.visible ? 1 : 0,
        transform:       item.visible ? 'translateX(0)' : 'translateX(calc(100% + 24px))',
      }}
    >
      {/* Colored left bar */}
      <div
        className="absolute left-0 top-3 bottom-3 w-1 rounded-full"
        style={{ backgroundColor: colors.icon }}
      />

      <Icon size={18} className="shrink-0 mt-0.5" style={{ color: colors.icon }} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          {item.title}
        </p>
        {item.message && (
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            {item.message}
          </p>
        )}
        {item.action && (
          <button
            onClick={item.action.onClick}
            className="mt-2 text-xs font-semibold underline underline-offset-2 hover:opacity-70 transition-opacity"
            style={{ color: colors.icon }}
          >
            {item.action.label}
          </button>
        )}
      </div>

      <button
        onClick={() => onDismiss(item.id)}
        className="shrink-0 rounded-full p-0.5 hover:bg-border/40 transition-colors"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Provider ─────────────────────────────────────────────────────────────────

function Toasts({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: string) => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  return createPortal(
    <div
      className="fixed bottom-6 right-6 z-[100000] flex flex-col gap-3 items-end pointer-events-none"
      aria-live="polite"
    >
      {items.map(item => (
        <div key={item.id} className="relative pointer-events-auto">
          <Toast item={item} onDismiss={onDismiss} />
        </div>
      ))}
    </div>,
    document.body,
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    // Fade out first, then remove
    setItems(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t))
    const t = setTimeout(() => {
      setItems(prev => prev.filter(t => t.id !== id))
      timers.current.delete(id)
    }, 300)
    timers.current.set(id, t)
  }, [])

  const toast = useCallback((opts: ToastOptions) => {
    const id: string = Math.random().toString(36).slice(2)
    const duration = opts.duration ?? (opts.type === 'error' || opts.type === 'warning' ? 8000 : 5000)

    // Add with visible: false so enter animation fires
    setItems(prev => [...prev, { ...opts, id, visible: false }])

    // Trigger enter on next frame
    requestAnimationFrame(() => {
      setItems(prev => prev.map(t => t.id === id ? { ...t, visible: true } : t))
    })

    // Auto-dismiss (duration=0 means sticky)
    if (duration > 0) {
      const t = setTimeout(() => dismiss(id), duration)
      timers.current.set(id, t)
    }
  }, [dismiss])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => { timers.current.forEach(clearTimeout) }
  }, [])

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <Toasts items={items} onDismiss={dismiss} />
    </Ctx.Provider>
  )
}
