'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import ContentLayout from '@/app/_components/ContentLayout'
import SignInModal from '@/app/_components/SignInModal'
import { ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import FarmersBenefits from './FarmersBenefits'

export default function FarmersPage() {
  const t = useTranslations('farmers')
  const router = useRouter()
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)

  const BENEFITS = [
    { title: t('b1Title'), desc: t('b1Desc') },
    { title: t('b2Title'), desc: t('b2Desc') },
    { title: t('b3Title'), desc: t('b3Desc') },
    { title: t('b4Title'), desc: t('b4Desc') },
  ]

  const STEPS = [t('step1'), t('step2'), t('step3'), t('step4')]

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsSignedIn(!!session?.user)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsSignedIn(!!session?.user)
    })

    return () => subscription.unsubscribe()
  }, [])

  function handleClaim() {
    if (isSignedIn) {
      router.push('/map')
    } else {
      setShowSignIn(true)
    }
  }

  return (
    <>
      {showSignIn && (
        <SignInModal
          onClose={() => setShowSignIn(false)}
          onSuccess={() => { setShowSignIn(false); router.push('/map') }}
        />
      )}

      <ContentLayout>

        {/* Page header */}
        <section className="px-6 pt-20 pb-16" style={{ borderBottom: '1px solid oklch(0.9 0.008 80 / 0.6)' }}>
          <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_0.7fr] gap-12 items-start">
            <div>
              <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>
                {t('eyebrow')}
              </p>
              <h1 className="font-display text-5xl font-medium leading-[1.05] tracking-[-0.025em]" style={{ color: 'var(--foreground)' }}>
                {t('headline')}{' '}
                <span className="serif-italic" style={{ color: 'var(--primary)' }}>{t('headlineEmphasis')}</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                {t('subheading')}
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <button
                  onClick={handleClaim}
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition hover:opacity-90"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  {t('claimBtn')} <ArrowRight className="h-4 w-4" />
                </button>
                <Link
                  href="/messages"
                  className="inline-flex items-center gap-2 rounded-xl border px-6 py-3 text-sm font-semibold transition hover:opacity-80"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  {t('contactBtn')}
                </Link>
              </div>
            </div>
            <div className="relative aspect-square hidden lg:block overflow-hidden rounded-2xl border border-border shadow-sm">
              <Image 
                src="/images/farmer-portrait.webp" 
                alt="Friendly farmer" 
                fill 
                className="object-cover"
              />
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="px-6 py-12" style={{ borderBottom: '1px solid oklch(0.9 0.008 80 / 0.6)', backgroundColor: 'oklch(0.36 0.07 145 / 0.03)' }}>
          <div className="mx-auto max-w-5xl">
            <FarmersBenefits benefits={BENEFITS} />
          </div>
        </section>

        {/* How it works */}
        <section className="px-6 py-20" style={{ borderBottom: '1px solid oklch(0.9 0.008 80 / 0.6)' }}>
          <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_0.8fr] gap-12 items-stretch">
            <div className="rounded-2xl border p-8" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>
                {t('stepsEyebrow')}
              </p>
              <h2 className="font-display text-2xl font-medium tracking-tight mb-8" style={{ color: 'var(--foreground)' }}>
                {t('stepsTitle')}
              </h2>
              <ol className="space-y-5">
                {STEPS.map((step, i) => (
                  <li key={i} className="flex gap-4">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.1)', color: 'var(--primary)' }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed pt-0.5" style={{ color: 'var(--muted-foreground)' }}>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="relative rounded-2xl overflow-hidden border border-border hidden lg:block shadow-sm">
               <Image 
                src="/images/farm-stand.webp" 
                alt="Farm stand" 
                fill 
                className="object-cover"
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <div
              className="flex flex-col items-start gap-6 rounded-2xl border p-8 sm:flex-row sm:items-center"
              style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.06)', borderColor: 'var(--primary)' }}
            >
              <div className="flex-1">
                <p className="font-semibold" style={{ color: 'var(--foreground)' }}>{t('ctaTitle')}</p>
                <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('ctaSubtext')}</p>
              </div>
              <button
                onClick={handleClaim}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                {t('ctaBtn')} <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </section>

      </ContentLayout>
    </>
  )
}
