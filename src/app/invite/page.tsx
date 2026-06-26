'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Copy, Check, Gift, Users, Link as LinkIcon, Ticket, ArrowRight, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import SiteNav from '@/app/_components/SiteNav'
import SiteFooter from '@/app/_components/SiteFooter'
import { getReferralData, redeemReferralCode, type ReferralStats } from './actions'

function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
}

export default function InvitePage() {
  const router = useRouter()
  const [userId, setUserId]   = useState<string | null>(null)
  const [stats,   setStats]   = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied,  setCopied]  = useState(false)

  // Enter-a-code state
  const [codeInput,   setCodeInput]   = useState('')
  const [codeLoading, setCodeLoading] = useState(false)
  const [codeError,   setCodeError]   = useState('')
  const [codeSuccess, setCodeSuccess] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.replace('/'); return }
      setUserId(session.user.id)
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

  async function handleRedeemCode(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !codeInput.trim()) return
    setCodeLoading(true)
    setCodeError('')
    const result = await redeemReferralCode(userId, codeInput.trim())
    if (result.ok) {
      setCodeSuccess(true)
      setStats(prev => prev ? { ...prev, hasRedeemedCode: true } : prev)
    } else {
      setCodeError(result.error ?? 'Something went wrong.')
    }
    setCodeLoading(false)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
      <SiteNav />
      <main className="px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-xl">

          {/* ── Header ────────────────────────────────────────────────────────── */}
          <motion.div initial="hidden" animate="show" variants={fadeUp} className="mb-12">
            <div
              className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.1)' }}
            >
              <Gift className="h-7 w-7" style={{ color: 'var(--primary)' }} strokeWidth={1.5} />
            </div>
            <h1 className="font-display text-3xl font-medium tracking-tight mb-3" style={{ color: 'var(--foreground)' }}>
              Invite friends,{' '}
              <span className="serif-italic" style={{ color: 'var(--primary)' }}>earn free access</span>
            </h1>
            <p className="text-base leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              Share your link. When a friend signs up and starts their free trial, you get{' '}
              <strong style={{ color: 'var(--foreground)' }}>1 free month</strong> added to your
              Farmsy account — automatically.
            </p>
          </motion.div>

          {/* ── How it works ──────────────────────────────────────────────────── */}
          <motion.div
            initial="hidden" animate="show" variants={fadeUp}
            transition={{ delay: 0.06 }}
            className="mb-8 rounded-2xl border border-border bg-card p-6"
          >
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--muted-foreground)' }}>
              How it works
            </p>
            <div className="flex flex-col gap-5">
              {[
                {
                  step: '1',
                  icon: LinkIcon,
                  title: 'Share your unique link',
                  desc:  'Copy your personal link below and send it to anyone — via message, email, or however you like.',
                },
                {
                  step: '2',
                  icon: Users,
                  title: 'Friend starts their free trial',
                  desc:  'When someone signs up with your link and starts their 3-day free trial, that counts as a successful referral. No need to wait for them to pay.',
                },
                {
                  step: '3',
                  icon: Gift,
                  title: 'You get 1 free month',
                  desc:  'Your account is credited with 1 free month automatically. Free months stack — invite more, earn more.',
                },
              ].map(({ step, icon: Icon, title, desc }) => (
                <div key={step} className="flex gap-4 items-start">
                  <div
                    className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                    style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                  >
                    {step}
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--foreground)' }}>{title}</p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Free months note */}
            <div
              className="mt-5 rounded-xl px-4 py-3 text-sm leading-relaxed"
              style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.07)', color: 'var(--primary)' }}
            >
              🎁 Free months are added to your account and applied automatically when your current plan renews or when you subscribe.
            </div>
          </motion.div>

          {/* ── Your referral link ─────────────────────────────────────────────── */}
          <motion.div
            initial="hidden" animate="show" variants={fadeUp}
            transition={{ delay: 0.1 }}
            className="mb-6 rounded-2xl border border-border bg-card p-6"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--muted-foreground)' }}>
              Your referral link
            </p>

            {loading ? (
              <div className="h-11 animate-pulse rounded-xl" style={{ backgroundColor: 'var(--border)' }} />
            ) : (
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
            )}
          </motion.div>

          {/* ── Enter a friend's code ──────────────────────────────────────────── */}
          <motion.div
            initial="hidden" animate="show" variants={fadeUp}
            transition={{ delay: 0.14 }}
            className="mb-6 rounded-2xl border border-border bg-card p-6"
          >
            <div className="flex items-center gap-2 mb-1">
              <Ticket className="h-4 w-4" style={{ color: 'var(--primary)' }} strokeWidth={1.75} />
              <p className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--muted-foreground)' }}>
                Have a friend's code?
              </p>
            </div>
            <p className="mb-4 text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              If a friend gave you their referral code, enter it here. You can only do this once.
            </p>

            {loading ? (
              <div className="h-11 animate-pulse rounded-xl" style={{ backgroundColor: 'var(--border)' }} />
            ) : stats?.hasRedeemedCode || codeSuccess ? (
              <div
                className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
                style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.07)', color: 'var(--primary)' }}
              >
                <Check className="h-4 w-4 shrink-0" />
                {codeSuccess ? "Code applied — your friend earns a free month once you start your trial!" : "You've already used a referral code."}
              </div>
            ) : (
              <form onSubmit={handleRedeemCode} className="flex gap-2">
                <input
                  type="text"
                  value={codeInput}
                  onChange={e => { setCodeInput(e.target.value.toUpperCase()); setCodeError('') }}
                  placeholder="Enter code (e.g. ABC12345)"
                  maxLength={12}
                  className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-mono outline-none uppercase"
                  style={{
                    borderColor: codeError ? 'var(--destructive)' : 'var(--border)',
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)',
                  }}
                />
                <button
                  type="submit"
                  disabled={codeLoading || !codeInput.trim()}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-85 disabled:opacity-40"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  {codeLoading ? '…' : (
                    <>Apply <ArrowRight className="h-3.5 w-3.5" /></>
                  )}
                </button>
              </form>
            )}
            {codeError && (
              <p className="mt-2 text-xs" style={{ color: 'var(--destructive)' }}>{codeError}</p>
            )}
          </motion.div>

          {/* ── Stats ─────────────────────────────────────────────────────────── */}
          <motion.div
            initial="hidden" animate="show" variants={fadeUp}
            transition={{ delay: 0.18 }}
            className="grid grid-cols-3 gap-4"
          >
            {[
              { value: stats?.invited      ?? 0, label: 'Friends invited' },
              { value: stats?.joined       ?? 0, label: 'Friends signed up' },
              { value: stats?.monthsEarned ?? 0, label: 'Free months earned' },
            ].map(({ value, label }) => (
              <div key={label} className="rounded-2xl border border-border bg-card p-5 text-center">
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

          {/* ── Referral activity ─────────────────────────────────────────────── */}
          {!loading && (stats?.entries.length ?? 0) > 0 && (
            <motion.div
              initial="hidden" animate="show" variants={fadeUp}
              transition={{ delay: 0.22 }}
              className="mt-6 rounded-2xl border border-border bg-card p-6"
            >
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--muted-foreground)' }}>
                Referral activity
              </p>
              <div className="flex flex-col gap-3">
                {stats!.entries.map((e, i) => {
                  const rewarded = e.status === 'rewarded'
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div
                        className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: rewarded ? 'oklch(0.36 0.07 145 / 0.12)' : 'oklch(0.75 0.13 75 / 0.15)',
                          color:           rewarded ? 'var(--primary)' : '#B45309',
                        }}
                      >
                        {rewarded ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                          {e.label}
                        </p>
                        <p className="text-xs" style={{ color: rewarded ? 'var(--primary)' : 'var(--muted-foreground)' }}>
                          {rewarded
                            ? 'Started their trial · you earned 1 free month'
                            : 'Waiting for them to start their free trial'}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {fmtShortDate(e.date)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* Pending months note */}
          {!loading && (stats?.pendingMonths ?? 0) > 0 && (
            <motion.div
              initial="hidden" animate="show" variants={fadeUp}
              className="mt-4 rounded-xl border px-4 py-3 text-sm leading-relaxed"
              style={{
                backgroundColor: 'oklch(0.36 0.07 145 / 0.07)',
                borderColor:     'oklch(0.36 0.07 145 / 0.2)',
                color:           'var(--primary)',
              }}
            >
              🎁 You have <strong>{stats!.pendingMonths} free month{stats!.pendingMonths > 1 ? 's' : ''}</strong> ({stats!.pendingMonths * 30} extra free days) waiting — added automatically on top of your trial when you start your plan, so your first charge is pushed back {stats!.pendingMonths} month{stats!.pendingMonths > 1 ? 's' : ''}.
            </motion.div>
          )}

        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
