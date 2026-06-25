'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Copy,
  Check,
  Gift,
  Users,
  Star,
  Share2,
  Mail,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import SiteNav from '@/app/_components/SiteNav'
import SiteFooter from '@/app/_components/SiteFooter'
import { getReferralData, type ReferralStats } from './actions'

// ─── Icons ───────────────────────────────────────────────────────────────────

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

// ─── Fade-up animation ────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvitePage() {
  const router = useRouter()
  const [stats,   setStats]   = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied,  setCopied]  = useState(false)
  const [igCopied, setIgCopied] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        router.replace('/')
        return
      }
      const data = await getReferralData(session.user.id)
      setStats(data)
      setLoading(false)
    })
  }, [router])

  const referralLink = stats ? `https://farmsy.app/?ref=${stats.code}` : ''

  function copyLink() {
    if (!referralLink) return
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function shareWhatsApp() {
    const text = encodeURIComponent(
      `I've been using Farmsy to discover local farms in the Netherlands and Belgium — it's great! 🌱 Try it free: ${referralLink}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener')
  }

  function shareEmail() {
    const subject = encodeURIComponent('Discover local farms with Farmsy 🌱')
    const body = encodeURIComponent(
      `Hey!\n\nI've been using Farmsy to find local farms in the Netherlands and Belgium — farm shops, organic producers, pick-your-own fields and more.\n\nYou can try it free for 3 days. Here's my link:\n${referralLink}\n\nHope you enjoy it!`
    )
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  function copyForInstagram() {
    if (!referralLink) return
    navigator.clipboard.writeText(referralLink)
    setIgCopied(true)
    setTimeout(() => setIgCopied(false), 3000)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
      <SiteNav />
      <main className="px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl">

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <motion.div
            initial="hidden" animate="show" variants={fadeUp}
            className="text-center mb-14"
          >
            <div
              className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.1)' }}
            >
              <Gift className="h-8 w-8" style={{ color: 'var(--primary)' }} strokeWidth={1.5} />
            </div>
            <h1 className="font-display text-4xl font-medium tracking-tight" style={{ color: 'var(--foreground)' }}>
              Invite friends,{' '}
              <span className="serif-italic" style={{ color: 'var(--primary)' }}>earn free time</span>
            </h1>
            <p className="mt-4 text-base leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              Share Farmsy with friends. When a friend starts a paid subscription, you get 1 free month added to yours — automatically.
            </p>
          </motion.div>

          {/* ── How it works ───────────────────────────────────────────────── */}
          <motion.div
            initial="hidden" animate="show" variants={fadeUp}
            transition={{ delay: 0.08 }}
            className="mb-10 grid grid-cols-3 gap-4"
          >
            {[
              { icon: Share2, step: '1', text: 'Share your unique link with friends' },
              { icon: Users,  step: '2', text: 'Friend signs up and starts a free trial' },
              { icon: Star,   step: '3', text: 'Friend converts to paid → you get 1 month free' },
            ].map(({ icon: Icon, step, text }) => (
              <div
                key={step}
                className="rounded-2xl border border-border bg-card p-5 text-center"
              >
                <div
                  className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  {step}
                </div>
                <Icon className="mx-auto mb-2 h-5 w-5" style={{ color: 'var(--primary)' }} strokeWidth={1.5} />
                <p className="text-xs leading-snug" style={{ color: 'var(--muted-foreground)' }}>{text}</p>
              </div>
            ))}
          </motion.div>

          {/* ── Referral link card ─────────────────────────────────────────── */}
          <motion.div
            initial="hidden" animate="show" variants={fadeUp}
            transition={{ delay: 0.14 }}
            className="mb-6 rounded-2xl border border-border bg-card p-6"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--muted-foreground)' }}>
              Your referral link
            </p>

            {loading ? (
              <div className="h-12 animate-pulse rounded-xl" style={{ backgroundColor: 'var(--border)' }} />
            ) : (
              <>
                <div
                  className="flex items-center gap-3 rounded-xl border p-3"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
                >
                  <span className="flex-1 truncate text-sm font-mono" style={{ color: 'var(--foreground)' }}>
                    {referralLink}
                  </span>
                  <button
                    onClick={copyLink}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:opacity-85"
                    style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                {/* Share buttons */}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={shareWhatsApp}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition hover:opacity-85"
                    style={{ backgroundColor: '#25D366', color: '#fff' }}
                  >
                    <WhatsAppIcon className="h-4 w-4" />
                    Share on WhatsApp
                  </button>
                  <button
                    onClick={copyForInstagram}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition hover:opacity-80"
                    style={{
                      borderColor: 'var(--border)',
                      background: igCopied ? 'oklch(0.36 0.07 145 / 0.08)' : 'var(--card)',
                      color: igCopied ? 'var(--primary)' : 'var(--foreground)',
                    }}
                  >
                    {igCopied ? <Check className="h-4 w-4" /> : <InstagramIcon className="h-4 w-4" />}
                    {igCopied ? 'Link copied — paste in Instagram!' : 'Share on Instagram'}
                  </button>
                  <button
                    onClick={shareEmail}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition hover:opacity-80"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)', backgroundColor: 'var(--card)' }}
                  >
                    <Mail className="h-4 w-4" />
                    Share via Email
                  </button>
                </div>
              </>
            )}
          </motion.div>

          {/* ── Stats ──────────────────────────────────────────────────────── */}
          <motion.div
            initial="hidden" animate="show" variants={fadeUp}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-3 gap-4"
          >
            {[
              {
                value: stats?.invited ?? 0,
                label: 'Friends invited',
                suffix: '',
              },
              {
                value: stats?.converted ?? 0,
                label: 'Converted to paid',
                suffix: '',
              },
              {
                value: stats?.monthsEarned ?? 0,
                label: 'Free months earned',
                suffix: '',
              },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="rounded-2xl border border-border bg-card p-5 text-center"
              >
                <div
                  className="font-display text-4xl font-medium tracking-tight"
                  style={{ color: 'var(--primary)' }}
                >
                  {loading ? '—' : value}
                </div>
                <p className="mt-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
              </div>
            ))}
          </motion.div>

          {/* Pending months note */}
          {!loading && (stats?.pendingMonths ?? 0) > 0 && (
            <motion.div
              initial="hidden" animate="show" variants={fadeUp}
              className="mt-4 rounded-xl border px-4 py-3 text-sm"
              style={{
                backgroundColor: 'oklch(0.36 0.07 145 / 0.08)',
                borderColor:     'oklch(0.36 0.07 145 / 0.25)',
                color:           'var(--primary)',
              }}
            >
              🎁 You have <strong>{stats!.pendingMonths} free month{stats!.pendingMonths > 1 ? 's' : ''}</strong> waiting — they&apos;ll be applied automatically when you next subscribe or renew.
            </motion.div>
          )}

        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
