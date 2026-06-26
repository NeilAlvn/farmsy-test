'use client'

import Link from 'next/link'
import MapGateLink from './MapGateLink'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  animate,
} from 'framer-motion'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import {
  MapPin,
  ShieldCheck,
  Sprout,
  Smartphone,
  ArrowRight,
  Apple,
  Play,
  Check,
  Loader2,
  Zap,
  MapIcon,
} from 'lucide-react'
import FarmCard from '@/app/FarmCard'
import type { FarmPreview } from '@/app/page'
import SiteNav from './SiteNav'
import SiteFooter from './SiteFooter'
import SignInModal from './SignInModal'
import TrialCountdownBanner from './TrialCountdownBanner'
import { supabase } from '@/lib/supabase'

const PhoneMap = dynamic(() => import('./PhoneMap'), { ssr: false })

// ─── Animation ────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const },
  },
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function LandingPage({ farms }: { farms: FarmPreview[] }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref && /^[A-Z0-9]{6,12}$/.test(ref.toUpperCase())) {
      document.cookie = `farmsy_ref=${ref.toUpperCase()}; path=/; max-age=604800; SameSite=Lax`
    }
  }, [])

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
      <TrialCountdownBanner />
      <SiteNav />
      <main>
        <Hero />
        <Stats />
        <Categories />
        <FeaturedFarms farms={farms} />
        <Features />
        <Pricing />
        <FAQ />
      </main>
      <SiteFooter />
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  const t = useTranslations('hero')
  const [showSignIn, setShowSignIn] = useState(false)

  async function handleFreeTrial() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      window.location.href = '/pricing'
    } else {
      setShowSignIn(true)
    }
  }

  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-16 sm:pt-24">
      {showSignIn && (
        <SignInModal onClose={() => setShowSignIn(false)} onSuccess={() => setShowSignIn(false)} />
      )}

      {/* Background Image */}
      <div className="absolute inset-0 -z-10">
        <Image
          src="/images/hero-farm.webp"
          alt="Sunlit Dutch farm field"
          fill
          priority
          className="object-cover opacity-20"
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, transparent, var(--background) 95%)'
          }}
        />
      </div>
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        {/* Left — copy */}
        <div className="text-center lg:text-left">
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-primary"
          >
            <Sprout className="h-3.5 w-3.5" strokeWidth={1.75} />
            {t('badge')}
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ delay: 0.05 }}
            className="font-display text-[2.75rem] font-medium leading-[1.02] tracking-[-0.025em] text-foreground sm:text-6xl lg:text-[5rem]"
          >
            {t('headline1')}
            <br />
            {t('headline2')}{' '}
            <span className="serif-italic text-primary">{t('headlineEmphasis')}</span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ delay: 0.15 }}
            className="mx-auto mt-7 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0"
          >
            {t('subheadline')}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ delay: 0.25 }}
            className="mt-10 flex flex-col items-center gap-3 sm:flex-row lg:justify-start"
          >
            <button
              onClick={handleFreeTrial}
              className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold transition hover:opacity-85"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </button>
            <MapGateLink
              href="/map"
              className="inline-flex items-center gap-2 rounded-xl border px-7 py-3.5 text-base font-semibold transition hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              <MapIcon className="h-4 w-4" />
              Explore Farms
            </MapGateLink>
          </motion.div>

          <motion.p
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ delay: 0.32 }}
            className="mt-5 text-sm text-muted-foreground"
          >
            {t('launchingSoon')}
          </motion.p>

          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ delay: 0.35 }}
            className="mt-10 flex justify-center lg:justify-start"
          >
            <StoreButtons />
          </motion.div>
        </div>

        {/* Right — phone mockup with live map */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] as const }}
          className="relative mx-auto w-full max-w-[340px] lg:max-w-none"
        >
          {/* Soft glow */}
          <div
            aria-hidden
            className="absolute -inset-10 -z-10 rounded-full opacity-60 blur-3xl"
            style={{
              background:
                'radial-gradient(60% 60% at 50% 40%, oklch(0.36 0.07 145 / 0.18), transparent 70%)',
            }}
          />
          <PhoneMap />
        </motion.div>
      </div>
    </section>
  )
}

// ─── Subscribe form ───────────────────────────────────────────────────────────

function SubscribeForm({ id, dark = false }: { id: string; dark?: boolean }) {
  const t = useTranslations('subscribe')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(true)
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (!valid) {
      setState('error')
      setError(t('errorEmail'))
      return
    }
    if (!consent) {
      setState('error')
      setError(t('errorConsent'))
      return
    }
    setState('loading')
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, consent, source: 'landing' }),
      })
      if (res.status === 201 || res.status === 409) {
        setState('success')
      } else {
        const data: { error?: string } = await res.json().catch(() => ({}))
        setState('error')
        setError(data.error ?? t('errorGeneric'))
      }
    } catch {
      setState('error')
      setError(t('errorGeneric'))
    }
  }

  if (state === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto flex max-w-md items-center justify-center gap-3 rounded-xl px-5 py-4"
        style={{
          backgroundColor: dark ? 'oklch(0.98 0.005 85 / 0.12)' : 'oklch(0.36 0.07 145 / 0.08)',
          border: dark ? '1px solid oklch(0.98 0.005 85 / 0.2)' : '1px solid oklch(0.36 0.07 145 / 0.2)',
        }}
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: dark ? 'var(--primary-foreground)' : 'var(--primary)' }}
        >
          <Check
            className="h-3.5 w-3.5"
            strokeWidth={3}
            style={{ color: dark ? 'var(--primary)' : 'var(--primary-foreground)' }}
          />
        </span>
        <span
          className="text-sm font-medium"
          style={{ color: dark ? 'var(--primary-foreground)' : 'var(--foreground)' }}
        >
          {t('success')}
        </span>
      </motion.div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-3 text-left">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <input
          type="email"
          required
          aria-label="Email address"
          placeholder={t('placeholder')}
          value={email}
          onChange={e => {
            setEmail(e.target.value)
            if (state === 'error') setState('idle')
          }}
          className="w-full flex-1 rounded-lg px-4 py-3.5 text-base transition focus:outline-none focus:ring-2"
          style={{
            backgroundColor: dark ? 'oklch(0.98 0.005 85 / 0.12)' : 'var(--card)',
            border: dark ? '1.5px solid oklch(0.98 0.005 85 / 0.25)' : '1px solid var(--border)',
            color: dark ? 'var(--primary-foreground)' : 'var(--foreground)',
          }}
        />
        <button
          type="submit"
          disabled={state === 'loading'}
          className="inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-sm font-semibold transition hover:opacity-85 disabled:opacity-70"
          style={{
            backgroundColor: dark ? 'var(--primary-foreground)' : 'var(--primary)',
            color: dark ? 'var(--primary)' : 'var(--primary-foreground)',
          }}
        >
          {state === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {t('cta')}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </div>

      <label
        className="flex cursor-pointer items-start justify-center gap-2 text-xs leading-relaxed"
        style={{ color: dark ? 'oklch(0.98 0.005 85 / 0.65)' : 'var(--muted-foreground)' }}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={e => setConsent(e.target.checked)}
          id={`consent-${id}`}
          className="mt-0.5 h-3.5 w-3.5 rounded border-border"
          style={{ accentColor: dark ? 'oklch(0.98 0.005 85)' : 'oklch(0.36 0.07 145)' }}
        />
        <span>
          {t('consent')}{' '}
          <a href="#privacy" className="underline underline-offset-2 hover:opacity-70 transition-opacity" style={{ color: 'inherit' }}>
            {t('privacyPolicy')}
          </a>
        </span>
      </label>

      {state === 'error' && error && (
        <p
          className="mt-3 text-center text-xs"
          style={{ color: dark ? 'oklch(0.98 0.005 85 / 0.8)' : 'var(--destructive)' }}
        >
          {error}
        </p>
      )}
    </form>
  )
}

// ─── Categories ──────────────────────────────────────────────────────────────

function Categories() {
  const t = useTranslations('categories')
  const cats = [
    { id: 'dairy',   image: '/images/dairy-farm.webp' },
    { id: 'produce', image: '/images/produce-closeup.webp' },
    { id: 'cheese',  image: '/images/cheese-display.webp' },
  ]
  
  return (
    <section className="px-6 py-24 sm:py-32 border-t border-border/60">
       <div className="mx-auto max-w-6xl">
         <motion.h2 
           initial="hidden"
           whileInView="show"
           viewport={{ once: true, margin: '-100px' }}
           variants={fadeUp}
           className="font-display text-3xl font-medium tracking-tight mb-12"
         >
           {t('title')}
         </motion.h2>
         <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
           {cats.map((cat, i) => (
             <motion.div
               key={cat.id}
               initial="hidden"
               whileInView="show"
               viewport={{ once: true, margin: '-50px' }}
               variants={fadeUp}
               transition={{ delay: i * 0.1 }}
             >
               <MapGateLink
                 href={`/map?category=${cat.id}`}
                 className="group relative block h-64 overflow-hidden rounded-2xl border border-border"
               >
                 <Image
                   src={cat.image}
                   alt={cat.id}
                   fill
                   className="object-cover transition-transform duration-700 group-hover:scale-110"
                 />
                 <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
                 <div className="absolute inset-0 flex items-center justify-center">
                   <h3 className="text-white text-3xl font-display font-medium tracking-tight">{t(cat.id as any)}</h3>
                 </div>
               </MapGateLink>
             </motion.div>
           ))}
         </div>
       </div>
    </section>
  )
}

// ─── Featured farms ───────────────────────────────────────────────────────────

function FeaturedFarms({ farms }: { farms: FarmPreview[] }) {
  const t = useTranslations('farms')
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
              {t('eyebrow')}
            </p>
            <h2
              className="font-display text-4xl font-medium leading-[1.05] tracking-[-0.025em] sm:text-5xl"
              style={{ color: 'var(--foreground)' }}
            >
              {t('headline1')}{' '}
              <span className="serif-italic">{t('headlineEmphasis')}</span>
            </h2>
          </div>
          <MapGateLink
            href="/map"
            className="group inline-flex shrink-0 items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition hover:opacity-90"
            style={{ backgroundColor: 'var(--foreground)', color: 'var(--background)' }}
          >
            {t('exploreMap')}
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
              className="h-[380px]"
            >
              <FarmCard farm={farm} idx={idx} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function Stats() {
  const t = useTranslations('stats')
  const stats = [
    { value: 12000, suffix: '+',   label: t('verifiedFarms') },
    { value: null,  text: 'NL & BE', label: t('coverage') },
    { value: null,  text: '3-day',   label: t('launching') },
  ]

  return (
    <section className="relative overflow-hidden border-t border-border/60 px-6 py-24 sm:py-32">
      <Image
        src="/images/bg.avif"
        alt=""
        fill
        className="object-cover object-center"
        aria-hidden
      />
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative mx-auto max-w-6xl">
        <motion.p
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUp}
          className="mb-12 text-center text-xs font-medium uppercase tracking-[0.2em] text-white/60 sm:mb-16"
        >
          {t('eyebrow')}
        </motion.p>
        <div className="grid gap-12 sm:grid-cols-3 sm:gap-8">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-50px' }}
              variants={fadeUp}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="font-display text-5xl font-medium tracking-[-0.03em] text-white sm:text-6xl md:text-7xl">
                {s.value !== null ? (
                  <>
                    <CountUp to={s.value} />
                    <span className="serif-italic" style={{ color: 'oklch(0.75 0.12 145)' }}>{s.suffix}</span>
                  </>
                ) : (
                  s.text
                )}
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-white/50">
                {s.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CountUp ──────────────────────────────────────────────────────────────────

function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })
  const mv = useMotionValue(0)
  const rounded = useTransform(mv, v => Math.floor(v).toLocaleString('en-US'))
  const [display, setDisplay] = useState('0')

  useEffect(() => {
    if (!inView) return
    const controls = animate(mv, to, { duration: 2.2, ease: [0.22, 1, 0.36, 1] })
    const unsub = rounded.on('change', v => setDisplay(v))
    return () => { controls.stop(); unsub() }
  }, [inView, mv, rounded, to])

  return <span ref={ref}>{display}</span>
}

// ─── Features ─────────────────────────────────────────────────────────────────

const FEATURE_ICONS = [MapPin, ShieldCheck, Sprout, Smartphone] as const
const FEATURE_KEYS = ['findFarms', 'verified', 'connect', 'available'] as const

function Features() {
  const t = useTranslations('features')
  return (
    <section className="border-t border-border/60 px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUp}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-primary">
            {t('eyebrow')}
          </p>
          <h2 className="font-display text-4xl font-medium leading-[1.05] tracking-[-0.025em] text-foreground sm:text-5xl">
            {t('headline1')}{' '}
            <span className="serif-italic">{t('headlineEmphasis')}</span>
          </h2>
        </motion.div>

        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURE_KEYS.map((key, i) => {
            const Icon = FEATURE_ICONS[i]
            return (
              <motion.div
                key={key}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-50px' }}
                variants={fadeUp}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-border bg-card p-6 transition-shadow duration-300 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)]"
              >
                <div
                  className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.1)' }}
                >
                  <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="font-display text-lg font-medium tracking-tight text-foreground">
                  {t(`${key}.title`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(`${key}.desc`)}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function Pricing() {
  const t = useTranslations('pricing')
  const features = [t('feature1'), t('feature2'), t('feature3'), t('feature4')]
  const [loading, setLoading] = useState<'yearly' | 'lifetime' | null>(null)
  const [showSignIn, setShowSignIn] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [subStatus, setSubStatus] = useState<string | null>(null)

  useEffect(() => {
    // Persist coupon code from URL into sessionStorage so it survives sign-in redirects
    const params = new URLSearchParams(window.location.search)
    const coupon = params.get('coupon')
    if (coupon) sessionStorage.setItem('pending_coupon', coupon)

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setIsLoggedIn(!!session?.user)
      if (session?.access_token) {
        const res = await fetch('/api/profile/subscription', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setSubStatus(data.subscription_status ?? null)
        }
      }
    })
  }, [])

  async function handleCheckout(plan: 'yearly' | 'lifetime') {
    const key = plan
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setShowSignIn(true); return }
    setLoading(key)
    try {
      const couponCode = sessionStorage.getItem('pending_coupon') ?? undefined
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, userId: session.user.id, couponCode }),
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      sessionStorage.setItem('stripe_redirect', '1')
      sessionStorage.removeItem('pending_coupon')
      window.location.href = url
    } catch {
      alert('Something went wrong. Please try again.')
      setLoading(null)
    }
  }

  return (
    <>
      {showSignIn && (
        <SignInModal onClose={() => setShowSignIn(false)} onSuccess={() => setShowSignIn(false)} />
      )}
      <section className="border-t border-border/60 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            className="mx-auto max-w-2xl text-center"
          >
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-primary">
              {t('eyebrow')}
            </p>
            <h2 className="font-display text-4xl font-medium leading-[1.05] tracking-[-0.025em] text-foreground sm:text-5xl">
              {t('headline1')}{' '}
              <span className="serif-italic">{t('headlineEmphasis')}</span>
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              {t('subheading')}
            </p>
          </motion.div>

          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 items-stretch max-w-2xl mx-auto w-full">

            {/* Yearly — hidden when already subscribed */}
            {(subStatus === 'active' || subStatus === 'trialing') ? (
              <motion.div
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-50px' }}
                variants={fadeUp}
                transition={{ delay: 0.12 }}
                className="rounded-2xl border border-border bg-card p-8 flex flex-col gap-6 items-center justify-center text-center"
              >
                <Check className="h-10 w-10 text-primary" strokeWidth={2} />
                <div>
                  <p className="font-semibold text-foreground text-lg">You&apos;re already subscribed</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {subStatus === 'trialing' ? 'Your free trial is active.' : 'Your yearly plan is active.'}
                  </p>
                </div>
                <a
                  href="/account/subscription"
                  className="block w-full rounded-xl border border-border py-3 text-center text-sm font-semibold text-foreground transition hover:opacity-80"
                >
                  Manage subscription
                </a>
              </motion.div>
            ) : (
              <motion.div
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-50px' }}
                variants={fadeUp}
                transition={{ delay: 0.12 }}
                className="rounded-2xl border border-border bg-card p-8 flex flex-col gap-6"
              >
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground mb-2">{t('yearly')}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-5xl font-medium tracking-tight text-foreground">€29.99</span>
                    <span className="text-sm text-muted-foreground">{t('perYear')}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{t('yearlyTagline')}</p>
                </div>
                <ul className="space-y-3 flex-1">
                  {features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-foreground">
                      <Check className="h-4 w-4 shrink-0 mt-0.5 text-primary" strokeWidth={2.5} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleCheckout('yearly')}
                  disabled={loading !== null}
                  className="block w-full rounded-xl border border-border py-3 text-center text-sm font-semibold text-foreground transition hover:opacity-80 disabled:opacity-60"
                >
                  {loading === 'yearly' ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : isLoggedIn ? 'Get Yearly Plan' : 'Try Free for 3 Days'}
                </button>
              </motion.div>
            )}

            {/* Lifetime — highlighted */}
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-50px' }}
              variants={fadeUp}
              transition={{ delay: 0.19 }}
              className="relative rounded-2xl p-8 flex flex-col gap-6 overflow-hidden"
              style={{ background: 'oklch(0.36 0.07 145 / 0.08)', border: '2px solid var(--primary)' }}
            >
              <div className="absolute top-5 right-5 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                <Zap className="h-3 w-3" />
                {t('lifetimeBadge')}
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground mb-2">{t('lifetimeLabel')}</p>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-5xl font-medium tracking-tight text-foreground">€49.99</span>
                  <span className="text-lg line-through text-muted-foreground">€59.99</span>
                </div>
                <p className="mt-2 text-sm font-medium" style={{ color: 'var(--primary)' }}>{t('lifetimeTagline')}</p>
              </div>
              <ul className="space-y-3 flex-1">
                {features.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-foreground">
                    <Check className="h-4 w-4 shrink-0 mt-0.5 text-primary" strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout('lifetime')}
                disabled={loading !== null}
                className="block w-full rounded-xl py-3 text-center text-sm font-bold transition hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                {loading === 'lifetime' ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t('lifetimeCta')}
              </button>
            </motion.div>

          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            {t('finePrint')}
          </p>
        </div>
      </section>
    </>
  )
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-border/60 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-6 py-5 text-left transition-colors hover:text-primary"
      >
        <span className="font-medium text-foreground leading-snug">{q}</span>
        <span
          className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground transition-transform duration-200"
          style={{ transform: open ? 'rotate(45deg)' : 'none' }}
          aria-hidden
        >
          +
        </span>
      </button>
      {open && (
        <p className="pb-5 text-sm leading-relaxed text-muted-foreground pr-10">{a}</p>
      )}
    </div>
  )
}

function FAQ() {
  const t = useTranslations('homeFaq')
  const items = [1, 2, 3, 4, 5, 6].map(i => ({
    q: t(`q${i}` as 'q1'),
    a: t(`a${i}` as 'a1'),
  }))

  return (
    <section className="border-t border-border/60 px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-[1fr_1.4fr]">
          {/* Left: heading */}
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
          >
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-primary">
              {t('eyebrow')}
            </p>
            <h2 className="font-display text-4xl font-medium leading-[1.05] tracking-[-0.025em] text-foreground sm:text-5xl">
              {t('headline')}{' '}
              <span className="serif-italic">{t('headlineEmphasis')}</span>
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground max-w-xs">
              {t('subtext')}
            </p>
            <Link
              href="/faq"
              className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4"
            >
              {t('viewAll')} <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>

          {/* Right: accordion */}
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            className="rounded-2xl border border-border bg-card px-8"
          >
            {items.map((item, i) => (
              <FAQItem key={i} {...item} />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ─── Store buttons ────────────────────────────────────────────────────────────

function StoreButtons() {
  const t = useTranslations('store')
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <StoreBadge
          variant="dark"
          icon={<Apple className="h-7 w-7" strokeWidth={1.5} fill="currentColor" />}
          eyebrow={t('downloadOn')}
          name="App Store"
          comingSoon={t('comingSoon')}
        />
        <StoreBadge
          variant="light"
          icon={<Play className="h-6 w-6" strokeWidth={0} fill="currentColor" />}
          eyebrow={t('getItOn')}
          name="Google Play"
          comingSoon={t('comingSoon')}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {t('free')}
      </p>
    </div>
  )
}

function StoreBadge({
  variant,
  icon,
  eyebrow,
  name,
  comingSoon,
}: {
  variant: 'dark' | 'light'
  icon: ReactNode
  eyebrow: string
  name: string
  comingSoon: string
}) {
  const isDark = variant === 'dark'
  return (
    <div
      className={`group relative inline-flex min-w-[200px] items-center gap-3 rounded-2xl px-5 py-3 transition ${
        isDark ? 'bg-foreground text-background' : 'border border-border bg-card text-foreground'
      }`}
    >
      <span className="absolute -top-2.5 right-3 inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground shadow-sm">
        {comingSoon}
      </span>
      <span className="shrink-0">{icon}</span>
      <span className="flex flex-col text-left leading-tight">
        <span
          className={`text-[10px] font-medium uppercase tracking-[0.14em] ${
            isDark ? 'text-background/70' : 'text-muted-foreground'
          }`}
        >
          {eyebrow}
        </span>
        <span className="font-display text-lg font-medium tracking-tight">{name}</span>
      </span>
    </div>
  )
}

