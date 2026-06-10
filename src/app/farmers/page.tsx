import type { Metadata } from 'next'
import Link from 'next/link'
import ContentLayout from '@/app/_components/ContentLayout'
import { ArrowRight, MapPin, Pencil, Users } from 'lucide-react'

export const metadata: Metadata = {
  title: 'For Farmers – Farmsy',
  description: 'List your farm on Farmsy and connect with local food consumers across the Netherlands and Belgium.',
}

const BENEFITS = [
  {
    Icon: MapPin,
    title: 'Appear on the map',
    desc: 'Your farm is shown to consumers searching nearby for fresh, local produce.',
  },
  {
    Icon: Pencil,
    title: 'Control your listing',
    desc: 'Update your name, address, opening hours, and contact details at any time.',
  },
  {
    Icon: Users,
    title: 'Reach more customers',
    desc: 'Connect directly with people who want to buy local — no middlemen.',
  },
]

const STEPS = [
  'Search for your farm on the map — it may already be listed from public data sources.',
  'Create a free account using your email address.',
  'Claim your listing and verify you are the owner or operator.',
  'Update your details: hours, products, photos, and contact info.',
]

export default function FarmersPage() {
  return (
    <ContentLayout>

      {/* Page header */}
      <section className="px-6 pt-20 pb-16" style={{ borderBottom: '1px solid oklch(0.9 0.008 80 / 0.6)' }}>
        <div className="mx-auto max-w-3xl">
          <span
            className="mb-5 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em]"
            style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.1)', color: 'var(--primary)' }}
          >
            For Farmers
          </span>
          <h1 className="font-display text-5xl font-medium leading-[1.05] tracking-[-0.025em]" style={{ color: 'var(--foreground)' }}>
            Get found by{' '}
            <span className="serif-italic" style={{ color: 'var(--primary)' }}>local food lovers</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            Farmsy helps consumers across the Netherlands and Belgium discover farms near them. Claim your listing to keep your information accurate and attract more visitors.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/auth/signin"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition hover:opacity-90"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              Claim your listing <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-xl border px-6 py-3 text-sm font-semibold transition hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Contact us
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="px-6 py-20" style={{ borderBottom: '1px solid oklch(0.9 0.008 80 / 0.6)' }}>
        <div className="mx-auto max-w-3xl">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {BENEFITS.map(({ Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border p-6"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
              >
                <div
                  className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.1)' }}
                >
                  <Icon className="h-5 w-5" style={{ color: 'var(--primary)' }} strokeWidth={1.5} />
                </div>
                <p className="mb-2 font-semibold" style={{ color: 'var(--foreground)' }}>{title}</p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20" style={{ borderBottom: '1px solid oklch(0.9 0.008 80 / 0.6)' }}>
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border p-8" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>
              Getting started
            </p>
            <h2 className="font-display text-2xl font-medium tracking-tight mb-8" style={{ color: 'var(--foreground)' }}>
              How it works
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
              <p className="font-semibold" style={{ color: 'var(--foreground)' }}>Ready to get started?</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>It&apos;s free. No subscription required.</p>
            </div>
            <Link
              href="/auth/signin"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              Claim your listing <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

    </ContentLayout>
  )
}
