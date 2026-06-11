'use client'

import Link from 'next/link'
import Image from 'next/image'
import MapGateLink from './MapGateLink'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  animate,
  AnimatePresence,
} from 'framer-motion'
import {
  MapPin, ShieldCheck, Sprout, Smartphone,
  ArrowRight, Apple, Play, Check, Loader2,
} from 'lucide-react'
import FarmCard from '@/app/FarmCard'
import type { FarmPreview } from '@/app/page'
import PhoneWrapper from './PhoneWrapper'

// ─── Animation variants ───────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const },
  },
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SubStatus = 'idle' | 'loading' | 'success' | 'duplicate' | 'error'

interface Props {
  source: string
  farms: FarmPreview[]
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function LandingClient({ source, farms }: Props) {
  return (
    <div
      className="relative min-h-screen"
      style={{
        backgroundColor: 'var(--background)',
        color: 'var(--foreground)',
        backgroundImage: `
          radial-gradient(ellipse 70% 50% at 50% 0%, oklch(0.36 0.07 145 / 0.05), transparent 70%),
          radial-gradient(ellipse 50% 40% at 100% 100%, oklch(0.7 0.08 80 / 0.08), transparent 70%)
        `,
      }}
    >
      <LandingNav />
      <Hero source={source} />
      <Stats />
      <FeaturedFarms farms={farms} />
      <Features />
      <SecondaryCTA source={source} />
      <LandingFooter />
    </div>
  )
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

function LandingNav() {
  return (
    <header
      className="sticky top-0 z-30 backdrop-blur-md"
      style={{
        backgroundColor: 'oklch(0.985 0.005 85 / 0.85)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <span
          className="serif-italic text-xl"
          style={{ color: 'var(--foreground)' }}
        >
          Farmsy
        </span>

        <div className="flex items-center gap-6">
          <MapGateLink
            href="/map"
            className="group inline-flex items-center gap-1.5 text-sm font-medium transition"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Explore map
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </MapGateLink>
        </div>
      </div>
    </header>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ source: _source }: { source: string }) {
  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-20 sm:pt-28 sm:pb-32">
      {/* Background Image */}
      <div className="absolute inset-0 -z-10">
        <Image
          src="/images/hero-farm.webp"
          alt="Sunlit Dutch farm field"
          fill
          priority
          className="object-cover opacity-15"
        />
        <div 
          className="absolute inset-0" 
          style={{ 
            background: 'linear-gradient(to bottom, transparent, var(--background) 95%)' 
          }} 
        />
      </div>
      {/* Subtle radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 0%, oklch(0.36 0.07 145 / 0.07), transparent 65%)',
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-8 xl:gap-16">

          {/* Left: text */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.12 } } }}
            className="text-center lg:text-left"
          >
            {/* Badge */}
            <motion.div variants={fadeUp}>
              <span
                className="mb-7 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em]"
                style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.1)', color: 'var(--primary)' }}
              >
                <span>🌱</span>
                Farm Directory · NL &amp; BE
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeUp}
              className="mb-6 text-[2.8rem] font-medium leading-[1.02] tracking-[-0.03em] sm:text-5xl md:text-6xl"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--foreground)' }}
            >
              Discover what&apos;s{' '}
              <span className="serif-italic" style={{ color: 'var(--primary)' }}>
                local
              </span>{' '}
              in your food.
            </motion.h1>

            {/* Subheading */}
            <motion.p
              variants={fadeUp}
              className="mb-10 max-w-xl text-lg leading-relaxed mx-auto lg:mx-0"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Find 12,000+ verified farms, farm shops, and local producers across
              the Netherlands and Belgium — all in one place.
            </motion.p>

            {/* Store buttons */}
            <motion.div
              variants={fadeUp}
              className="flex flex-wrap justify-center gap-3 lg:justify-start"
            >
              <StoreButtons />
            </motion.div>

            <motion.p
              variants={fadeUp}
              className="mt-4 text-xs"
              style={{ color: 'oklch(0.5 0.01 60 / 0.6)' }}
            >
              Free to download · iOS &amp; Android · Coming soon
            </motion.p>
          </motion.div>

          {/* Right: phone mockup — lg+ only */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.0, delay: 0.3, ease: [0.22, 1, 0.36, 1] as const }}
            className="hidden justify-center lg:flex lg:justify-end"
          >
            <PhoneWrapper />
          </motion.div>

        </div>
      </div>
    </section>
  )
}

// ─── Store buttons ────────────────────────────────────────────────────────────

function StoreButtons() {
  return (
    <>
      {/* App Store */}
      <div className="relative">
        <span
          className="absolute -top-2.5 left-3 z-10 rounded-full px-2 py-px text-[9px] font-bold uppercase tracking-wide text-white"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          Coming soon
        </span>
        <button
          className="flex items-center gap-3 rounded-[14px] px-5 py-3.5 transition hover:opacity-90 active:scale-[0.98]"
          style={{
            backgroundColor: 'var(--foreground)',
            color: 'var(--background)',
            minWidth: 160,
            boxShadow: '0 2px 12px oklch(0.18 0.01 60 / 0.18)',
          }}
          aria-label="App Store — coming soon"
        >
          <Apple className="h-5 w-5 shrink-0" />
          <div className="flex flex-col items-start leading-[1.15]">
            <span
              className="text-[9px] font-medium uppercase tracking-[0.14em]"
              style={{ opacity: 0.6 }}
            >
              Download on the
            </span>
            <span className="text-[15px] font-semibold tracking-tight">App Store</span>
          </div>
        </button>
      </div>

      {/* Google Play */}
      <div className="relative">
        <span
          className="absolute -top-2.5 left-3 z-10 rounded-full px-2 py-px text-[9px] font-bold uppercase tracking-wide text-white"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          Coming soon
        </span>
        <button
          className="flex items-center gap-3 rounded-[14px] px-5 py-3.5 transition hover:opacity-90 active:scale-[0.98]"
          style={{
            backgroundColor: 'var(--card)',
            color: 'var(--foreground)',
            border: '1.5px solid var(--border)',
            minWidth: 160,
            boxShadow: '0 2px 8px oklch(0.18 0.01 60 / 0.05)',
          }}
          aria-label="Google Play — coming soon"
        >
          <GooglePlayIcon className="h-5 w-5 shrink-0" />
          <div className="flex flex-col items-start leading-[1.15]">
            <span
              className="text-[9px] font-medium uppercase tracking-[0.14em]"
              style={{ color: 'var(--muted-foreground)', opacity: 0.8 }}
            >
              Get it on
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Google Play</span>
          </div>
        </button>
      </div>
    </>
  )
}

// ─── Google Play icon ─────────────────────────────────────────────────────────

function GooglePlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="gp-a" x1="3" y1="1.5" x2="14" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#32C060" />
          <stop offset="1" stopColor="#00A651" />
        </linearGradient>
        <linearGradient id="gp-b" x1="3" y1="1.5" x2="22" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFD900" />
          <stop offset="1" stopColor="#FF8C00" />
        </linearGradient>
        <linearGradient id="gp-c" x1="3" y1="22.5" x2="14" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF4B26" />
          <stop offset="1" stopColor="#C8173D" />
        </linearGradient>
        <linearGradient id="gp-d" x1="14" y1="12" x2="22" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00B0FF" />
          <stop offset="1" stopColor="#0082C8" />
        </linearGradient>
      </defs>
      <path d="M3 1.5 L3 12 L14 12 Z" fill="url(#gp-a)" />
      <path d="M3 1.5 L14 12 L22 12 Z" fill="url(#gp-b)" />
      <path d="M3 12 L3 22.5 L14 12 Z" fill="url(#gp-c)" />
      <path d="M14 12 L3 22.5 L22 12 Z" fill="url(#gp-d)" />
    </svg>
  )
}

// ─── Stats ────────────────────────────────────────────────────────────────────

const STATS = [
  { value: 12000, suffix: '+', label: 'Verified farms', prefix: '' },
  { value: 2,     suffix: '',  label: 'Countries',      prefix: '' },
  { value: 100,   suffix: '%', label: 'Direct to consumer', prefix: '' },
] as const

function Stats() {
  return (
    <section
      className="px-6 py-16"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          variants={{ show: { transition: { staggerChildren: 0.1 } } }}
          className="grid grid-cols-1 gap-10 sm:grid-cols-3"
        >
          {STATS.map(({ value, suffix, label }) => (
            <motion.div
              key={label}
              variants={fadeUp}
              className="text-center"
            >
              <p
                className="mb-1 text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)' }}
              >
                <CountUp to={value} suffix={suffix} />
              </p>
              <p
                className="text-sm font-medium uppercase tracking-[0.15em]"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {label}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ─── CountUp ──────────────────────────────────────────────────────────────────

function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionVal = useMotionValue(0)
  const rounded = useTransform(motionVal, v =>
    Math.round(v).toLocaleString('nl-NL') + suffix,
  )
  const inView = useInView(ref, { once: true, margin: '-50px' })

  useEffect(() => {
    if (inView) animate(motionVal, to, { duration: 1.8, ease: 'easeOut' })
  }, [inView, motionVal, to])

  return <motion.span ref={ref}>{rounded}</motion.span>
}

// ─── Featured farms ───────────────────────────────────────────────────────────

function FeaturedFarms({ farms }: { farms: FarmPreview[] }) {
  if (farms.length === 0) return null

  return (
    <section
      className="px-6 py-24 sm:py-32"
      style={{ borderTop: '1px solid oklch(0.9 0.008 80 / 0.6)' }}
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUp}
          className="mb-12 flex flex-col justify-between gap-6 sm:flex-row sm:items-end"
        >
          <div>
            <p
              className="mb-3 text-xs font-medium uppercase tracking-[0.2em]"
              style={{ color: 'var(--primary)' }}
            >
              Fresh from the farm
            </p>
            <h2
              className="text-4xl font-medium leading-[1.05] tracking-[-0.025em] sm:text-5xl"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--foreground)' }}
            >
              Real farms,{' '}
              <span className="serif-italic">real produce.</span>
            </h2>
          </div>
          <MapGateLink
            href="/map"
            className="group inline-flex shrink-0 items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition hover:opacity-90"
            style={{
              backgroundColor: 'var(--foreground)',
              color: 'var(--background)',
            }}
          >
            Explore full map
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </MapGateLink>
        </motion.div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {farms.map((farm, idx) => (
            <motion.div
              key={farm.osm_id}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-50px' }}
              variants={fadeUp}
              transition={{ delay: idx * 0.06 }}
            >
              <FarmCard farm={farm} idx={idx} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    Icon: MapPin,
    title: 'Find farms near you',
    desc: 'Interactive map with thousands of farms, farm shops, and markets across the Netherlands and Belgium.',
  },
  {
    Icon: ShieldCheck,
    title: 'Verified & certified',
    desc: "SKAL-certified and bio-labeled farms clearly marked. Know exactly what you're getting.",
  },
  {
    Icon: Sprout,
    title: 'Connect with farmers',
    desc: 'Opening hours, phone numbers, websites — everything you need to visit or order directly.',
  },
  {
    Icon: Smartphone,
    title: 'Mobile-first directory',
    desc: 'Built for your phone. Find a farm, get directions, and go — all in a few taps.',
  },
] as const

function Features() {
  return (
    <section
      className="px-6 py-24 sm:py-32"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUp}
          className="mb-16 text-center"
        >
          <p
            className="mb-3 text-xs font-medium uppercase tracking-[0.2em]"
            style={{ color: 'var(--primary)' }}
          >
            Why Farmsy
          </p>
          <h2
            className="text-4xl font-medium leading-[1.05] tracking-[-0.025em] sm:text-5xl"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--foreground)' }}
          >
            Everything you need to go{' '}
            <span className="serif-italic">local.</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl p-6"
              style={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                boxShadow: '0 2px 8px oklch(0.18 0.01 60 / 0.04)',
              }}
            >
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.1)' }}
              >
                <Icon
                  className="h-5 w-5"
                  style={{ color: 'var(--primary)' }}
                />
              </div>
              <h3
                className="mb-2 text-sm font-semibold leading-snug"
                style={{ color: 'var(--foreground)' }}
              >
                {title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Secondary CTA ────────────────────────────────────────────────────────────

function SecondaryCTA({ source }: { source: string }) {
  return (
    <section className="px-6 pb-24 sm:pb-32">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] as const }}
          className="relative overflow-hidden rounded-3xl px-8 py-16 text-center sm:px-16"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          {/* Subtle dot grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'radial-gradient(oklch(0.98 0.005 85) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
          {/* Ambient glow */}
          <div
            className="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full blur-[80px]"
            style={{ backgroundColor: 'oklch(0.98 0.005 85 / 0.06)' }}
          />

          <div className="relative z-10 mx-auto max-w-xl">
            <p
              className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: 'oklch(0.98 0.005 85 / 0.6)' }}
            >
              Early access
            </p>
            <h2
              className="mb-4 text-3xl font-medium leading-tight tracking-[-0.025em] sm:text-4xl"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--primary-foreground)',
              }}
            >
              Be the first to know when we launch.
            </h2>
            <p
              className="mb-8 text-base leading-relaxed"
              style={{ color: 'oklch(0.98 0.005 85 / 0.7)' }}
            >
              Get exclusive early access and updates. No spam — unsubscribe any time.
            </p>
            <SubscribeForm source={source} dark />
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ─── Subscribe form ───────────────────────────────────────────────────────────

function SubscribeForm({ source, dark = false }: { source: string; dark?: boolean }) {
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState<SubStatus>('idle')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!consent || status === 'loading' || status === 'success') return
    setStatus('loading')
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, consent, source }),
      })
      if (res.status === 409) { setStatus('duplicate'); return }
      if (!res.ok) { setStatus('error'); return }
      setStatus('success')
      setEmail('')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div
        className="flex items-center justify-center gap-3 rounded-xl px-6 py-4 text-sm font-semibold"
        style={{
          backgroundColor: dark ? 'oklch(0.98 0.005 85 / 0.12)' : 'oklch(0.36 0.07 145 / 0.1)',
          color: dark ? 'var(--primary-foreground)' : 'var(--primary)',
        }}
      >
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: dark ? 'var(--primary-foreground)' : 'var(--primary)' }}
        >
          <Check
            className="h-3.5 w-3.5"
            style={{ color: dark ? 'var(--primary)' : 'var(--primary-foreground)' }}
          />
        </div>
        You&apos;re on the list — we&apos;ll be in touch!
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-left">
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="min-w-0 flex-1 rounded-xl px-4 py-3.5 text-sm outline-none transition"
          style={{
            backgroundColor: dark ? 'oklch(0.98 0.005 85 / 0.12)' : 'var(--card)',
            border: dark ? '1.5px solid oklch(0.98 0.005 85 / 0.2)' : '1.5px solid var(--border)',
            color: dark ? 'var(--primary-foreground)' : 'var(--foreground)',
          }}
        />
        <button
          type="submit"
          disabled={!consent || status === 'loading'}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold transition disabled:opacity-40"
          style={{
            backgroundColor: dark ? 'var(--primary-foreground)' : 'var(--foreground)',
            color: dark ? 'var(--primary)' : 'var(--background)',
          }}
        >
          {status === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Notify me'
          )}
        </button>
      </div>

      <label
        className="flex cursor-pointer items-start gap-2.5 text-xs"
        style={{ color: dark ? 'oklch(0.98 0.005 85 / 0.6)' : 'var(--muted-foreground)' }}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={e => setConsent(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--primary)]"
        />
        <span>
          I agree to receive email updates from Farmsy. Unsubscribe any time.{' '}
          <Link
            href="/privacy"
            className="underline underline-offset-2 transition hover:opacity-80"
          >
            Privacy policy
          </Link>
          .
        </span>
      </label>

      {status === 'duplicate' && (
        <p className="text-xs" style={{ color: dark ? 'oklch(0.98 0.005 85 / 0.7)' : 'var(--primary)' }}>
          You&apos;re already on the list — we&apos;ll reach out soon!
        </p>
      )}
      {status === 'error' && (
        <p className="text-xs text-red-400">Something went wrong. Please try again.</p>
      )}
    </form>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function LandingFooter() {
  return (
    <footer
      className="px-6 py-10"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 sm:flex-row">
        <span
          className="serif-italic text-lg"
          style={{ color: 'var(--foreground)' }}
        >
          Farmsy
        </span>

        <div className="flex items-center gap-5">
          <a
            href="https://www.tiktok.com/@farmsy.app"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="TikTok"
            className="transition hover:opacity-60"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <TikTokIcon className="h-4 w-4" />
          </a>
          <a
            href="https://www.instagram.com/farmsy.app"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="transition hover:opacity-60"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <InstagramIcon className="h-4 w-4" />
          </a>
        </div>

        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          © {new Date().getFullYear()} Farmsy — NL &amp; BE Farm Directory
        </p>
      </div>
    </footer>
  )
}

// ─── Social icons ─────────────────────────────────────────────────────────────

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.55a8.27 8.27 0 004.84 1.55V6.66a4.84 4.84 0 01-1.07.03z" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}
