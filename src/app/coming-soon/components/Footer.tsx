'use client'

import Link from 'next/link'
import { Wheat } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-[#0A0A0A] text-gray-500 py-16 px-6 border-t border-white/5">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
        <div className="flex flex-col items-center md:items-start gap-4">
          <Link href="/" className="flex items-center gap-3 text-white font-black text-xl group uppercase tracking-tighter">
            <motion.div 
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
              className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20"
            >
              <Wheat className="w-5 h-5 text-emerald-500" />
            </motion.div>
            Farmsy
          </Link>
          <p className="text-sm font-medium text-gray-600 max-w-xs text-center md:text-left">
            Connecting people with the source of their food. NL & BE coverage coming Summer 2026.
          </p>
        </div>

        <div className="flex flex-col items-center md:items-end gap-6">
          <nav className="flex items-center gap-8 text-sm font-bold text-gray-400">
            <Link href="/privacy" className="hover:text-emerald-400 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-emerald-400 transition-colors">Terms</Link>
            <Link href="/contact" className="hover:text-emerald-400 transition-colors">Contact</Link>
          </nav>
          <p className="text-xs tracking-widest uppercase font-black opacity-30">
            &copy; {year} Farmsy. Built for the countryside.
          </p>
        </div>
      </div>
    </footer>
  )
}
