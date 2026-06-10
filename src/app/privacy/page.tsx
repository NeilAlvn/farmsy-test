import type { Metadata } from 'next'
import ContentLayout from '@/app/_components/ContentLayout'

export const metadata: Metadata = {
  title: 'Privacy Policy – Farmsy',
  description: 'How Farmsy collects, uses, and protects your data.',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border p-8 space-y-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
      <h2 className="font-display text-xl font-medium tracking-tight" style={{ color: 'var(--foreground)' }}>{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  const updated = '15 May 2026'

  return (
    <ContentLayout>

      {/* Page header */}
      <section className="px-6 pt-20 pb-16" style={{ borderBottom: '1px solid oklch(0.9 0.008 80 / 0.6)' }}>
        <div className="mx-auto max-w-3xl">
          <span
            className="mb-5 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em]"
            style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.1)', color: 'var(--primary)' }}
          >
            Legal
          </span>
          <h1 className="font-display text-5xl font-medium leading-[1.05] tracking-[-0.025em]" style={{ color: 'var(--foreground)' }}>
            Privacy <span className="serif-italic" style={{ color: 'var(--primary)' }}>Policy</span>
          </h1>
          <p className="mt-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>Last updated: {updated}</p>
        </div>
      </section>

      {/* Body */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl space-y-5">

          {/* Plain-language intro */}
          <div className="rounded-2xl border px-8 py-6" style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.06)', borderColor: 'var(--primary)' }}>
            <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--foreground)' }}>
              <strong>The short version:</strong> We collect as little data as possible. Visitors who just browse the map are anonymous. We only hold your email address if you create an account to manage a farm listing. We never sell your data or use it for advertising.
            </p>
          </div>

          <Section title="Who we are">
            <p>
              Farmsy (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) operates the website <strong style={{ color: 'var(--foreground)' }}>farmsy.nl</strong>. We are a platform that helps consumers discover local farms and direct-to-consumer food producers in the Netherlands and Belgium.
            </p>
            <p>
              For any questions about this policy or your personal data, email us at{' '}
              <a href="mailto:privacy@farmsy.nl" className="font-medium underline underline-offset-4" style={{ color: 'var(--primary)' }}>
                privacy@farmsy.nl
              </a>.
            </p>
          </Section>

          <Section title="What data we collect">
            <p className="font-semibold" style={{ color: 'var(--foreground)' }}>1. Farm listing data (not personal)</p>
            <p>
              The farm information shown on our map comes from publicly available sources. This is not personal data — it is publicly listed business information:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li><strong style={{ color: 'var(--foreground)' }}>OpenStreetMap</strong> — locations, names, addresses, and opening hours (licensed under ODbL)</li>
              <li><strong style={{ color: 'var(--foreground)' }}>Foursquare</strong> — contact details and photos to enrich listings</li>
              <li><strong style={{ color: 'var(--foreground)' }}>Overture Maps</strong> — verified location and business data</li>
              <li><strong style={{ color: 'var(--foreground)' }}>Traces</strong> — supplementary contact information for farm listings</li>
              <li><strong style={{ color: 'var(--foreground)' }}>Farmer submissions</strong> — information provided directly by farm owners who have claimed their listing</li>
            </ul>

            <p className="font-semibold pt-2" style={{ color: 'var(--foreground)' }}>2. Account data (farmers only)</p>
            <p>
              If you create an account to claim or manage a farm listing, we collect and store your <strong style={{ color: 'var(--foreground)' }}>email address</strong>. That is the only personal data we hold. It is stored securely via Supabase Auth (EU region) and used solely to log you in and link you to your listing. We never share it with third parties.
            </p>

            <p className="font-semibold pt-2" style={{ color: 'var(--foreground)' }}>3. What we do NOT collect</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>No tracking pixels or advertising cookies</li>
              <li>No third-party analytics (e.g. Google Analytics)</li>
              <li>No IP address logging for ordinary visitors</li>
              <li>No behavioural profiling</li>
            </ul>
          </Section>

          <Section title="Business information">
            <p>
              We collect farm business information from publicly available sources including government agricultural directories, open data platforms, and voluntary business listings. This information includes business names, addresses, and contact details that farms have made publicly available for promotional purposes.
            </p>
            <p className="font-semibold pt-2" style={{ color: 'var(--foreground)' }}>Farms listed in our directory have the right to:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Claim and update their listing</li>
              <li>Request removal of their information</li>
              <li>Correct inaccurate information</li>
            </ul>
            <p className="pt-2">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:privacy@farmsy.nl" className="font-medium underline underline-offset-4" style={{ color: 'var(--primary)' }}>
                privacy@farmsy.nl
              </a>.
            </p>
          </Section>

          <Section title="How we use your data">
            <p>We use the data we hold only for the following purposes:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Displaying farm listings on the map</li>
              <li>Logging you into your account (if you have one)</li>
              <li>Sending account-related emails — no marketing emails without your consent</li>
              <li>Improving the platform based on aggregate, anonymous usage patterns</li>
            </ul>
            <p>We do not use your data for advertising and we do not sell it — ever.</p>
          </Section>

          <Section title="Cookies">
            <p>
              We use <strong style={{ color: 'var(--foreground)' }}>one type of cookie</strong>: an authentication session cookie set only when you sign in to your account. It keeps you logged in between visits.
            </p>
            <p>
              If you never sign in, no cookies are set. There are no tracking, advertising, or analytics cookies on this site.
            </p>
          </Section>

          <Section title="Data retention">
            <p>
              <strong style={{ color: 'var(--foreground)' }}>Account data</strong> is kept for as long as your account is active. If you ask us to delete your account, your email address is erased within 30 days.
            </p>
            <p>
              <strong style={{ color: 'var(--foreground)' }}>Farm listing data</strong> is drawn from public datasets and reviewed regularly. We remove listings when we become aware they are no longer active.
            </p>
          </Section>

          <Section title="Your rights under GDPR">
            <p>If you are in the EU or UK, you have the following rights over any personal data we hold about you:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {[
                { right: 'Access', desc: 'Request a copy of your data' },
                { right: 'Rectification', desc: 'Ask us to correct inaccurate data' },
                { right: 'Erasure', desc: 'Ask us to delete your data' },
                { right: 'Portability', desc: 'Receive your data in a common format' },
                { right: 'Objection', desc: 'Object to how we use your data' },
                { right: 'Restriction', desc: 'Limit how we process your data' },
              ].map(({ right, desc }) => (
                <div key={right} className="rounded-xl border px-4 py-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
                  <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{right}</p>
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{desc}</p>
                </div>
              ))}
            </div>
            <p className="pt-2">
              To exercise any right, email{' '}
              <a href="mailto:privacy@farmsy.nl" className="font-medium underline underline-offset-4" style={{ color: 'var(--primary)' }}>
                privacy@farmsy.nl
              </a>. We will respond within 30 days. You also have the right to lodge a complaint with the{' '}
              <strong style={{ color: 'var(--foreground)' }}>Autoriteit Persoonsgegevens</strong> (autoriteitpersoonsgegevens.nl).
            </p>
          </Section>

          <Section title="Third-party services we use">
            <p>We rely on the following services to run the platform:</p>
            <div className="space-y-3 pt-1">
              {[
                { name: 'Supabase', role: 'Database & authentication', note: 'Stores farm listings and account emails. Hosted in the EU.' },
                { name: 'Stripe', role: 'Payment processing', note: 'Handles subscription payments. Subject to Stripe\'s privacy policy.' },
                { name: 'OpenStreetMap / CARTO', role: 'Map tiles', note: 'Renders the background map. No personal data is sent.' },
              ].map(({ name, role, note }) => (
                <div key={name} className="rounded-xl border px-4 py-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
                  <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    {name} <span className="font-normal" style={{ color: 'var(--muted-foreground)' }}>— {role}</span>
                  </p>
                  <p className="mt-0.5 text-sm" style={{ color: 'var(--muted-foreground)' }}>{note}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We may update this policy when the platform changes. The &ldquo;Last updated&rdquo; date at the top of this page will always reflect the most recent revision. We will not make changes that significantly reduce your rights without giving you notice.
            </p>
          </Section>

          {/* Contact CTA */}
          <div
            className="flex flex-col items-start gap-6 rounded-2xl border p-8 sm:flex-row sm:items-center"
            style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.06)', borderColor: 'var(--primary)' }}
          >
            <div className="flex-1">
              <p className="font-semibold" style={{ color: 'var(--foreground)' }}>Questions about your data?</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>We&apos;re happy to help. Data requests are handled within 30 days.</p>
            </div>
            <a
              href="mailto:privacy@farmsy.nl"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              privacy@farmsy.nl
            </a>
          </div>

        </div>
      </section>

    </ContentLayout>
  )
}
