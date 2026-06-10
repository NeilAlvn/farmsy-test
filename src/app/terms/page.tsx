import type { Metadata } from 'next'
import ContentLayout from '@/app/_components/ContentLayout'

export const metadata: Metadata = {
  title: 'Terms of Service – Farmsy',
  description: 'Terms and conditions for using Farmsy.',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border p-8 space-y-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
      <h2 className="font-display text-xl font-medium tracking-tight" style={{ color: 'var(--foreground)' }}>{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{children}</div>
    </section>
  )
}

export default function TermsPage() {
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
            Terms of <span className="serif-italic" style={{ color: 'var(--primary)' }}>Service</span>
          </h1>
          <p className="mt-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>Last updated: {updated}</p>
        </div>
      </section>

      {/* Body */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl space-y-5">

          {/* Intro callout */}
          <div className="rounded-2xl border px-8 py-6" style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.06)', borderColor: 'var(--primary)' }}>
            <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--foreground)' }}>
              By using Farmsy you agree to these terms. The platform is free to use for visitors. Farm owners who claim a listing agree to keep their information accurate.
            </p>
          </div>

          <Section title="About the platform">
            <p>
              Farmsy is a directory that helps consumers find local farms and direct-to-consumer food producers in the Netherlands and Belgium. The platform is operated by Farmsy and is available at <strong style={{ color: 'var(--foreground)' }}>farmsy.nl</strong>.
            </p>
          </Section>

          <Section title="Use of the platform">
            <p>You may use Farmsy to:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Browse and search farm listings</li>
              <li>Get directions to farms</li>
              <li>Save favourite farms (account required)</li>
              <li>Plan farm trips (account required)</li>
              <li>Claim and manage your own farm listing (account required)</li>
            </ul>
            <p className="pt-2">
              You may not use the platform to scrape listings in bulk, republish data without attribution, or misrepresent a farm you do not own or operate.
            </p>
          </Section>

          <Section title="Farm listings">
            <p>
              Farm data is sourced from OpenStreetMap, Foursquare, Overture Maps, Traces, and voluntary farmer submissions. We aim for accuracy but cannot guarantee that all listing information is up to date. Always confirm opening hours and availability directly with the farm before visiting.
            </p>
            <p>
              Farm owners may claim their listing to update information. By claiming a listing you confirm that you are authorised to represent that business and that the information you provide is accurate.
            </p>
          </Section>

          <Section title="Accounts">
            <p>
              Accounts are available to farm owners who wish to manage their listing. You are responsible for keeping your login credentials secure. We may suspend accounts that violate these terms.
            </p>
          </Section>

          <Section title="Intellectual property">
            <p>
              Map data is &copy; OpenStreetMap contributors, licensed under the Open Database Licence (ODbL). Other content on the platform is &copy; Farmsy unless otherwise stated.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              Farmsy is provided &ldquo;as is&rdquo;. We are not liable for any loss or damage arising from use of the platform, inaccurate listing information, or unavailability of the service.
            </p>
          </Section>

          <Section title="Changes to these terms">
            <p>
              We may update these terms as the platform evolves. The &ldquo;Last updated&rdquo; date above reflects the most recent revision. Continued use of the platform after a change constitutes acceptance of the updated terms.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these terms? Email us at{' '}
              <a href="mailto:privacy@farmsy.nl" className="font-medium underline underline-offset-4" style={{ color: 'var(--primary)' }}>
                privacy@farmsy.nl
              </a>.
            </p>
          </Section>

        </div>
      </section>

    </ContentLayout>
  )
}
