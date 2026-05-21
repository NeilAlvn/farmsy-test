import type { Metadata } from 'next'
import Link from 'next/link'
import ContentLayout from '@/app/_components/ContentLayout'
import { ArrowRight, MapPin, Pencil, Users } from 'lucide-react'

export const metadata: Metadata = {
  title: 'For Farmers – De Lokale Boer',
  description: 'List your farm on De Lokale Boer and connect with local food consumers.',
}

export default function FarmersPage() {
  return (
    <ContentLayout>

      <div className="bg-gray-50 border-b border-gray-100 py-14 px-4">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-5">
            For Farmers
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 mb-4">
            Get found by local food lovers
          </h1>
          <p className="text-gray-500 text-lg max-w-xl">
            De Lokale Boer helps consumers across the Netherlands and Belgium discover farms near
            them. Claim your listing to keep your information accurate and attract more visitors.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/auth/signin"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-full transition-colors shadow-sm"
            >
              Claim your listing
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold px-6 py-3 rounded-full transition-colors"
            >
              Contact us
            </Link>
          </div>
        </div>
      </div>

      <div className="py-14 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto space-y-5">

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: <MapPin className="w-5 h-5 text-emerald-600" />,
                title: 'Appear on the map',
                desc: 'Your farm is shown to consumers searching nearby for fresh, local produce.',
              },
              {
                icon: <Pencil className="w-5 h-5 text-emerald-600" />,
                title: 'Control your listing',
                desc: 'Update your name, address, opening hours, and contact details at any time.',
              },
              {
                icon: <Users className="w-5 h-5 text-emerald-600" />,
                title: 'Reach more customers',
                desc: 'Connect directly with people who want to buy local — no middlemen.',
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                  {icon}
                </div>
                <p className="font-bold text-gray-900">{title}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm space-y-4">
            <h2 className="text-xl font-bold text-gray-900">How it works</h2>
            <ol className="space-y-4 text-[15px] text-gray-600">
              {[
                'Search for your farm on the map — it may already be listed from public data sources.',
                'Create a free account using your email address.',
                'Claim your listing and verify you are the owner or operator.',
                'Update your details: hours, products, photos, and contact info.',
              ].map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span className="shrink-0 w-7 h-7 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-sm font-black">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="bg-gray-900 rounded-3xl px-8 py-7 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="font-bold text-white mb-1">Ready to get started?</p>
              <p className="text-gray-400 text-sm">It&apos;s free. No subscription required.</p>
            </div>
            <Link
              href="/auth/signin"
              className="shrink-0 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-5 py-2.5 rounded-full transition-colors"
            >
              Claim your listing
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

        </div>
      </div>

    </ContentLayout>
  )
}
