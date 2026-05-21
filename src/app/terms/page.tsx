import type { Metadata } from 'next'
import ContentLayout from '@/app/_components/ContentLayout'

export const metadata: Metadata = {
  title: 'Terms of Service – De Lokale Boer',
  description: 'Terms and conditions for using De Lokale Boer.',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm space-y-4">
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      <div className="text-gray-600 leading-relaxed space-y-3 text-[15px]">{children}</div>
    </section>
  )
}

export default function TermsPage() {
  const updated = '15 May 2026'

  return (
    <ContentLayout>

      <div className="bg-gray-50 border-b border-gray-100 py-14 px-4">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-5">
            Legal
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 mb-3">
            Terms of Service
          </h1>
          <p className="text-gray-500 text-lg">Last updated: {updated}</p>
        </div>
      </div>

      <div className="py-14 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto space-y-5">

          <div className="bg-emerald-50 border border-emerald-100 rounded-3xl px-8 py-6">
            <p className="text-emerald-900 font-semibold text-[15px] leading-relaxed">
              By using De Lokale Boer you agree to these terms. The platform is free to use for
              visitors. Farm owners who claim a listing agree to keep their information accurate.
            </p>
          </div>

          <Section title="About the platform">
            <p>
              De Lokale Boer is a directory that helps consumers find local farms and direct-to-consumer
              food producers in the Netherlands and Belgium. The platform is operated by De Lokale Boer
              and is available at <strong className="text-gray-800">delokaaleboer.nl</strong>.
            </p>
          </Section>

          <Section title="Use of the platform">
            <p>You may use De Lokale Boer to:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Browse and search farm listings</li>
              <li>Get directions to farms</li>
              <li>Save favourite farms (account required)</li>
              <li>Plan farm trips (account required)</li>
              <li>Claim and manage your own farm listing (account required)</li>
            </ul>
            <p className="pt-2">
              You may not use the platform to scrape listings in bulk, republish data without
              attribution, or misrepresent a farm you do not own or operate.
            </p>
          </Section>

          <Section title="Farm listings">
            <p>
              Farm data is sourced from OpenStreetMap, the EU TRACES Database, Google Places, and
              voluntary farmer submissions. We aim for accuracy but cannot guarantee that all listing
              information is up to date. Always confirm opening hours and availability directly with
              the farm before visiting.
            </p>
            <p>
              Farm owners may claim their listing to update information. By claiming a listing you
              confirm that you are authorised to represent that business and that the information
              you provide is accurate.
            </p>
          </Section>

          <Section title="Accounts">
            <p>
              Accounts are available to farm owners who wish to manage their listing. You are
              responsible for keeping your login credentials secure. We may suspend accounts that
              violate these terms.
            </p>
          </Section>

          <Section title="Intellectual property">
            <p>
              Map data is &copy; OpenStreetMap contributors, licensed under the Open Database Licence
              (ODbL). Organic certification data is sourced from the EU TRACES Database. Other content
              on the platform is &copy; De Lokale Boer unless otherwise stated.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              De Lokale Boer is provided &ldquo;as is&rdquo;. We are not liable for any loss or damage
              arising from use of the platform, inaccurate listing information, or unavailability of
              the service.
            </p>
          </Section>

          <Section title="Changes to these terms">
            <p>
              We may update these terms as the platform evolves. The &ldquo;Last updated&rdquo; date
              above reflects the most recent revision. Continued use of the platform after a change
              constitutes acceptance of the updated terms.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these terms? Email us at{' '}
              <a href="mailto:privacy@delokaaleboer.nl" className="text-emerald-600 hover:underline font-medium">
                privacy@delokaaleboer.nl
              </a>.
            </p>
          </Section>

        </div>
      </div>

    </ContentLayout>
  )
}
