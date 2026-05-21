import Link from 'next/link'
import { Wheat, ArrowRight } from 'lucide-react'
import HeaderAuth from './HeaderAuth'
import MobileMenu from './MobileMenu'

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  const year = new Date().getFullYear()

  return (
    <div className="flex flex-col min-h-screen">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-emerald-700 transition-colors">
              <Wheat className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-gray-900 text-base tracking-tight">Farmsy</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            <Link href="/map" className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-full transition-all">
              Explore
            </Link>
            <Link href="/about" className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-full transition-all">
              About
            </Link>
            <Link href="/farmers" className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-full transition-all">
              For Farmers
            </Link>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <HeaderAuth />
            <Link
              href="/map"
              className="hidden sm:inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-sm hover:shadow-md transition-all"
            >
              <span>Find Farms</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <MobileMenu />
          </div>
        </div>
      </header>

      {/* ── Page content ────────────────────────────────────────────────── */}
      <main className="flex-1">{children}</main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="bg-gray-950 text-gray-400 pt-24 pb-12 px-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-800 to-transparent" />

        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-2">
              <Link href="/" className="flex items-center gap-2 text-white font-black text-xl mb-6">
                <Wheat className="w-7 h-7 text-emerald-500" />
                Farmsy
              </Link>
              <p className="max-w-sm text-gray-500 leading-relaxed mb-8">
                The leading platform for finding fresh, local food directly from producers in the Netherlands and Belgium.
                Supporting local farmers and sustainable consumption.
              </p>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6 uppercase tracking-widest text-xs">Explore</h4>
              <nav className="flex flex-col gap-4 text-sm font-medium">
                <Link href="/map" className="hover:text-emerald-500 transition-colors">Interactive Map</Link>
                <Link href="/map?category=produce" className="hover:text-emerald-500 transition-colors">Fresh Produce</Link>
                <Link href="/map?category=dairy" className="hover:text-emerald-500 transition-colors">Dairy &amp; Milk</Link>
              </nav>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6 uppercase tracking-widest text-xs">Platform</h4>
              <nav className="flex flex-col gap-4 text-sm font-medium">
                <Link href="/about" className="hover:text-emerald-500 transition-colors">About Us</Link>
                <Link href="/faq" className="hover:text-emerald-500 transition-colors">Help &amp; FAQ</Link>
                <Link href="/privacy" className="hover:text-emerald-500 transition-colors">Privacy Policy</Link>
                <Link href="/contact" className="hover:text-emerald-500 transition-colors">Contact</Link>
              </nav>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-900 flex flex-col md:flex-row items-center justify-between gap-6 text-xs font-bold tracking-tight uppercase">
            <p>&copy; {year} Farmsy. Made with 💚 for local food.</p>
            <div className="flex items-center gap-8">
              <span className="text-gray-600">v0.1.0-beta</span>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-gray-500">Service Operational</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
