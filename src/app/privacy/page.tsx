import type { Metadata } from 'next'
import ContentLayout from '@/app/_components/ContentLayout'

export const metadata: Metadata = {
  title: 'Privacy Policy – Farmsy',
  description: 'How Farmsy collects, uses, and protects your data.',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm space-y-4">
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      <div className="text-gray-600 leading-relaxed space-y-3 text-[15px]">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  const updated = '15 May 2026'

  return (
    <ContentLayout>

      {/* ── Page header (light) ───────────────────────────────────── */}
      <div className="bg-gray-50 border-b border-gray-100 py-14 px-4">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-5">
            Legal
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 mb-3">
            Privacy Policy
          </h1>
          <p className="text-gray-500 text-lg">Last updated: {updated}</p>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className="py-14 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto space-y-5">

          {/* Plain-language intro */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-3xl px-8 py-6">
            <p className="text-emerald-900 font-semibold text-[15px] leading-relaxed">
              <strong>The short version:</strong> We collect as little data as possible.
              Visitors who just browse the map are anonymous. We only hold your email address if you
              create an account to manage a farm listing. We never sell your data or use it for advertising.
            </p>
          </div>

          <Section title="Who we are">
            <p>
              Farmsy (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) operates the
              website <strong className="text-gray-800">farmsy.nl</strong>. We are a platform
              that helps consumers discover local farms and direct-to-consumer food producers in the
              Netherlands and Belgium.
            </p>
            <p>
              For any questions about this policy or your personal data, email us at{' '}
              <a href="mailto:privacy@farmsy.nl" className="text-emerald-600 hover:underline font-medium">
                privacy@farmsy.nl
              </a>.
            </p>
          </Section>

          <Section title="What data we collect">
            <p className="font-semibold text-gray-800">1. Farm listing data (not personal)</p>
            <p>
              The farm and producer information shown on our map comes from publicly available sources.
              This is not personal data — it is publicly listed business information:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>
                <strong className="text-gray-800">OpenStreetMap</strong> — locations, names, addresses,
                and opening hours (licensed under ODbL). Map data &copy; OpenStreetMap contributors.
              </li>
              <li>
                <strong className="text-gray-800">EU TRACES Database</strong> — government organic
                certification data for verified organic producers.
                Organic certification data from EU TRACES Database.
              </li>
              <li>
                <strong className="text-gray-800">Google Places API</strong> — used to fill in missing
                contact details and photos on existing listings
              </li>
              <li>
                <strong className="text-gray-800">User submissions and farmer claims</strong> — information
                provided directly by farm owners who have claimed their listing
              </li>
            </ul>
            <p className="text-sm text-gray-500 pt-2">
              As of 15 May 2026, our directory contains{' '}
              <strong className="text-gray-700">13,494 farms</strong> — 8,356 in the Netherlands and
              5,138 in Belgium.
            </p>

            <p className="font-semibold text-gray-800 pt-2">2. Account data (farmers only)</p>
            <p>
              If you create an account to claim or manage a farm listing, we collect and store your{' '}
              <strong className="text-gray-800">email address</strong>. That is the only personal data we
              hold. It is stored securely via Supabase Auth (EU region) and used solely to log you in
              and link you to your listing. We never share it with third parties.
            </p>

            <p className="font-semibold text-gray-800 pt-2">3. What we do NOT collect</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>No tracking pixels or advertising cookies</li>
              <li>No third-party analytics (e.g. Google Analytics)</li>
              <li>No IP address logging for ordinary visitors</li>
              <li>No behavioural profiling</li>
            </ul>
          </Section>

          <Section title="Business information">
            <p>
              We collect farm business information from publicly available sources including government
              agricultural directories, open data platforms, and voluntary business listings. This
              information includes business names, addresses, and contact details that farms have made
              publicly available for promotional purposes.
            </p>
            <p className="font-semibold text-gray-800 pt-2">Farms listed in our directory have the right to:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Claim and update their listing</li>
              <li>Request removal of their information</li>
              <li>Correct inaccurate information</li>
            </ul>
            <p className="pt-2">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:privacy@farmsy.nl" className="text-emerald-600 hover:underline font-medium">
                privacy@farmsy.nl
              </a>.
            </p>
          </Section>

          <Section title="How we use your data">
            <p>We use the data we hold only for the following purposes:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Displaying farm listings on the map</li>
              <li>Logging you into your account (if you have one)</li>
              <li>Sending account-related emails (e.g. sign-in link) — no marketing emails without your consent</li>
              <li>Improving the platform based on aggregate, anonymous usage patterns</li>
            </ul>
            <p>We do not use your data for advertising and we do not sell it — ever.</p>
          </Section>

          <Section title="Cookies">
            <p>
              We use <strong className="text-gray-800">one type of cookie</strong>: an authentication
              session cookie that is set only when you sign in to your account. It keeps you logged in
              between visits.
            </p>
            <p>
              If you never sign in, no cookies are set. There are no tracking cookies, advertising
              cookies, or analytics cookies on this site.
            </p>
            <p>
              You can delete or block cookies at any time through your browser settings without affecting
              your ability to browse the map as a visitor.
            </p>
          </Section>

          <Section title="Data retention">
            <p>
              <strong className="text-gray-800">Account data</strong> is kept for as long as your
              account is active. If you ask us to delete your account, your email address is erased
              within 30 days.
            </p>
            <p>
              <strong className="text-gray-800">Farm listing data</strong> is drawn from public datasets
              and reviewed regularly by our team. We remove listings when we become aware they are no
              longer active.
            </p>
          </Section>

          <Section title="Your rights under GDPR">
            <p>
              If you are in the EU or UK, you have the following rights over any personal data we hold
              about you:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {[
                { right: 'Access', desc: 'Request a copy of your data' },
                { right: 'Rectification', desc: 'Ask us to correct inaccurate data' },
                { right: 'Erasure', desc: 'Ask us to delete your data' },
                { right: 'Portability', desc: 'Receive your data in a common format' },
                { right: 'Objection', desc: 'Object to how we use your data' },
                { right: 'Restriction', desc: 'Limit how we process your data' },
              ].map(({ right, desc }) => (
                <div key={right} className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="font-semibold text-gray-800 text-sm">{right}</p>
                  <p className="text-gray-500 text-sm">{desc}</p>
                </div>
              ))}
            </div>
            <p className="pt-2">
              To exercise any right, email{' '}
              <a href="mailto:privacy@farmsy.nl" className="text-emerald-600 hover:underline font-medium">
                privacy@farmsy.nl
              </a>. We will respond within 30 days. You also have the right to lodge a complaint with
              your national supervisory authority — in the Netherlands that is the{' '}
              <strong className="text-gray-800">Autoriteit Persoonsgegevens</strong> (autoriteitpersoonsgegevens.nl).
            </p>
          </Section>

          <Section title="Third-party services we use">
            <p>
              We rely on the following services to run the platform. Each processes data only as needed
              to deliver the service:
            </p>
            <div className="space-y-3 pt-1">
              {[
                {
                  name: 'Supabase',
                  role: 'Database & authentication',
                  note: 'Stores farm listings and account emails. Hosted in the EU.',
                },
                {
                  name: 'Google Maps Platform',
                  role: 'Business data & directions',
                  note: 'Used to enrich farm listings and provide &ldquo;Get directions&rdquo; links. Subject to Google\'s privacy policy.',
                },
                {
                  name: 'CARTO / OpenStreetMap',
                  role: 'Map tiles',
                  note: 'Renders the background map. No personal data is sent.',
                },
              ].map(({ name, role, note }) => (
                <div key={name} className="border border-gray-100 rounded-xl px-4 py-3">
                  <p className="font-semibold text-gray-800 text-sm">{name} <span className="font-normal text-gray-400">— {role}</span></p>
                  <p className="text-gray-500 text-sm mt-0.5" dangerouslySetInnerHTML={{ __html: note }} />
                </div>
              ))}
            </div>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We may update this policy when the platform changes. The &ldquo;Last updated&rdquo; date
              at the top of this page will always reflect the most recent revision. We will not make
              changes that significantly reduce your rights without giving you notice.
            </p>
          </Section>

          {/* Contact callout */}
          <div className="bg-gray-900 rounded-3xl px-8 py-7 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="font-bold text-white mb-1">Questions about your data?</p>
              <p className="text-gray-400 text-sm">We&apos;re happy to help. Data requests are handled within 30 days.</p>
            </div>
            <a
              href="mailto:privacy@farmsy.nl"
              className="shrink-0 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-5 py-2.5 rounded-full transition-colors"
            >
              privacy@farmsy.nl
            </a>
          </div>

        </div>
      </div>

    </ContentLayout>
  )
}
