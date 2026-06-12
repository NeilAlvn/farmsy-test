import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { MapPin, Database, Users, Leaf, ArrowRight, Globe } from 'lucide-react'
import ContentLayout from '@/app/_components/ContentLayout'

export const metadata: Metadata = {
  title: 'About – Farmsy',
  description: 'Learn about Farmsy — connecting consumers with local farms across the Netherlands and Belgium.',
}

export default async function AboutPage() {
  const t = await getTranslations('about')

  const VALUES = [
    { Icon: Leaf,     title: t('v1Title'), desc: t('v1Desc') },
    { Icon: Globe,    title: t('v2Title'), desc: t('v2Desc') },
    { Icon: Users,    title: t('v3Title'), desc: t('v3Desc') },
    { Icon: Database, title: t('v4Title'), desc: t('v4Desc') },
  ]

  const DATA_SOURCES = [
    { name: 'OpenStreetMap',  region: t('osmRegion'),        description: t('osmDesc'),        license: 'Open Database License (ODbL)' },
    { name: 'Foursquare',     region: t('foursquareRegion'), description: t('foursquareDesc'), license: 'Foursquare Developer Terms' },
    { name: 'Overture Maps',  region: t('overtureRegion'),   description: t('overtureDesc'),   license: 'CDLA Permissive 2.0' },
    { name: 'Traces',         region: t('tracesRegion'),     description: t('tracesDesc'),     license: 'Commercial license' },
  ]

  const b = (chunks: React.ReactNode) => <strong style={{ color: 'var(--foreground)' }}>{chunks}</strong>

  return (
    <ContentLayout>

      {/* Page header */}
      <section className="px-6 pt-20 pb-16" style={{ borderBottom: '1px solid oklch(0.9 0.008 80 / 0.6)' }}>
        <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_0.8fr] gap-12 items-start">
          <div>
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>
              {t('eyebrow')}
            </p>
            <h1 className="font-display text-5xl font-medium leading-[1.05] tracking-[-0.025em]" style={{ color: 'var(--foreground)' }}>
              {t('headline')}{' '}
              <span className="serif-italic" style={{ color: 'var(--primary)' }}>{t('headlineEmphasis')}</span>
            </h1>
            <p className="mt-5 text-lg leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              {t('subheading')}
            </p>
            <Link
              href="/map"
              className="mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition hover:opacity-90"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              {t('exploreMap')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="relative aspect-[4/3] hidden lg:block overflow-hidden rounded-2xl border border-border shadow-sm">
            <Image 
              src="/images/local-food.webp" 
              alt="Local food produce" 
              fill 
              priority
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="px-6 py-20" style={{ borderBottom: '1px solid oklch(0.9 0.008 80 / 0.6)' }}>
        <div className="mx-auto max-w-5xl space-y-6 text-base leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
          <p className="text-xs font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>{t('missionEyebrow')}</p>
          <h2 className="font-display text-4xl font-medium tracking-[-0.02em] leading-[1.1]" style={{ color: 'var(--foreground)' }}>
            {t('missionTitle')} <span className="serif-italic">{t('missionTitleEmphasis')}</span>
          </h2>
          <div className="space-y-5">
            <p>{t.rich('mission1', { b })}</p>
            <p>{t.rich('mission2', { b })}</p>
            <p>{t.rich('mission3', { b })}</p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="px-6 py-20" style={{ borderBottom: '1px solid oklch(0.9 0.008 80 / 0.6)' }}>
        <div className="mx-auto max-w-5xl">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>{t('valuesEyebrow')}</p>
          <h2 className="font-display mb-12 text-3xl font-medium tracking-[-0.02em]" style={{ color: 'var(--foreground)' }}>
            {t('valuesTitle')} <span className="serif-italic">{t('valuesTitleEmphasis')}</span>
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {VALUES.map(({ Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.1)' }}>
                  <Icon className="h-5 w-5" style={{ color: 'var(--primary)' }} strokeWidth={1.5} />
                </div>
                <h3 className="mb-2 font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data sources */}
      <section className="px-6 py-20" style={{ borderBottom: '1px solid oklch(0.9 0.008 80 / 0.6)' }}>
        <div className="mx-auto max-w-5xl">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>{t('sourcesEyebrow')}</p>
          <h2 className="font-display mb-3 text-3xl font-medium tracking-[-0.02em]" style={{ color: 'var(--foreground)' }}>
            {t('sourcesTitle')} <span className="serif-italic">{t('sourcesTitleEmphasis')}</span>
          </h2>
          <p className="mb-12 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            {t('sourcesSubheading')}
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {DATA_SOURCES.map(({ name, region, description, license }) => (
              <div key={name} className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>{region}</span>
                </div>
                <h3 className="mb-2 font-semibold" style={{ color: 'var(--foreground)' }}>{name}</h3>
                <p className="mb-4 text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{description}</p>
                <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)', opacity: 0.7 }}>{license}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 flex items-start gap-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t.rich('osmNotice', {
              link: (chunks) => (
                <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80">
                  {chunks}
                </a>
              ),
            })}
          </p>
        </div>
      </section>

      {/* Coverage */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>{t('coverageEyebrow')}</p>
          <h2 className="font-display mb-10 text-3xl font-medium tracking-[-0.02em]" style={{ color: 'var(--foreground)' }}>
            <span className="serif-italic">{t('coverageTitle')}</span>
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--primary)' }}>{t('nlLabel')}</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{t('nlDesc')}</p>
            </div>
            <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--primary)' }}>{t('beLabel')}</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{t('beDesc')}</p>
            </div>
          </div>
        </div>
      </section>

    </ContentLayout>
  )
}
