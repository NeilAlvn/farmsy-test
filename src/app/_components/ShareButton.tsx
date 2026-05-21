'use client'

import { useState, useRef, useEffect } from 'react'
import { Share2, Link, Check, X } from 'lucide-react'

interface Props {
  url: string
  title: string
  text?: string
  className?: string
}

const SOCIALS = [
  {
    label: 'WhatsApp',
    color: '#25D366',
    href: (url: string, text: string) =>
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    Icon: () => (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.853L.054 23.554a.5.5 0 0 0 .609.61l5.805-1.522A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.879 9.879 0 0 1-5.032-1.373l-.36-.214-3.733.979.996-3.648-.235-.374A9.86 9.86 0 0 1 2.1 12c0-5.458 4.442-9.9 9.9-9.9 5.457 0 9.9 4.442 9.9 9.9 0 5.457-4.443 9.9-9.9 9.9z"/>
      </svg>
    ),
  },
  {
    label: 'X / Twitter',
    color: '#000000',
    href: (url: string, text: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    Icon: () => (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  {
    label: 'Facebook',
    color: '#1877F2',
    href: (url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    Icon: () => (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
] as const

export default function ShareButton({ url, title, text, className }: Props) {
  const [open, setOpen]       = useState(false)
  const [copied, setCopied]   = useState(false)
  const popoverRef            = useRef<HTMLDivElement>(null)
  const shareText             = text ?? title

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  async function handleClick() {
    // Try native share sheet (works great on mobile)
    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url })
        return
      } catch {
        // user cancelled or not supported — fall through to popover
      }
    }
    setOpen(o => !o)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`relative ${className ?? ''}`} ref={popoverRef}>
      <button
        onClick={handleClick}
        className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
        aria-label="Share"
      >
        <Share2 size={14} className="text-gray-600" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Share</p>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={13} />
            </button>
          </div>

          {/* Copy link */}
          <button
            onClick={copyLink}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${copied ? 'bg-emerald-100' : 'bg-gray-100'}`}>
              {copied
                ? <Check size={14} className="text-emerald-600" />
                : <Link size={14} className="text-gray-500" />}
            </span>
            <span className="text-sm font-medium text-gray-700">
              {copied ? 'Copied!' : 'Copy link'}
            </span>
          </button>

          {/* Social options */}
          <div className="border-t border-gray-50">
            {SOCIALS.map(({ label, color, href, Icon }) => (
              <a
                key={label}
                href={href(url, shareText)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white"
                  style={{ background: color }}
                >
                  <Icon />
                </span>
                <span className="text-sm font-medium text-gray-700">{label}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
