'use client'

import Link from 'next/link'
import { Leaf, MapPin, Wheat, Sparkles, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import EmailForm from './EmailForm'

interface Props {
  source: string
}

export default function Hero({ source }: Props) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3
      }
    }
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, damping: 20, stiffness: 100 } }
  }

  return (
    <section className="relative min-h-[90vh] bg-[#1E3A0A] overflow-hidden flex flex-col">
      {/* Background texture */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '28px 28px' }}
      />

      {/* Ambient glow blobs */}
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.1, 0.15, 0.1]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500 rounded-full blur-[120px] -mr-64 -mt-32 pointer-events-none" 
      />
      <motion.div 
        animate={{ 
          scale: [1.1, 1, 1.1],
          opacity: [0.1, 0.08, 0.1]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-teal-400 rounded-full blur-[100px] -ml-48 -mb-32 pointer-events-none" 
      />

      {/* Floating Decorative icons */}
      <motion.div 
        animate={{ y: [0, -20, 0], rotate: [12, 15, 12] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-24 left-[8%] opacity-[0.08] pointer-events-none hidden md:block"
      >
        <Leaf className="w-24 h-24 text-emerald-300" />
      </motion.div>
      <motion.div 
        animate={{ y: [0, 20, 0], rotate: [-12, -18, -12] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-48 right-[8%] opacity-[0.08] pointer-events-none hidden md:block"
      >
        <Wheat className="w-28 h-24 text-emerald-300" />
      </motion.div>

      {/* ── Minimal nav ───────────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-6 max-w-6xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-3 group">
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 10 }}
            className="w-10 h-10 bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-center backdrop-blur-sm group-hover:bg-emerald-500/30 transition-colors"
          >
            <Wheat className="w-5 h-5 text-emerald-400" />
          </motion.div>
          <span className="font-black text-white text-xl tracking-tight uppercase">Farmsy</span>
        </Link>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
          <Link
            href="/map"
            className="text-sm text-white/50 hover:text-white font-medium transition-all flex items-center gap-2 group"
          >
            Explore the map 
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </nav>

      {/* ── Main content ──────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="max-w-3xl mx-auto text-center"
        >
          {/* "Coming soon" badge */}
          <motion.div 
            variants={item}
            className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-widest px-5 py-2.5 rounded-full mb-8 backdrop-blur-md shadow-lg shadow-black/20"
          >
            <motion.span 
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-emerald-400" 
            />
            Launching very soon
          </motion.div>

          <motion.h1 
            variants={item}
            className="text-5xl sm:text-6xl md:text-7xl font-black text-white leading-[1] tracking-tighter mb-8"
          >
            The best of the 
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">countryside</span>
          </motion.h1>

          <motion.p 
            variants={item}
            className="text-xl text-white/70 leading-relaxed mb-12 max-w-2xl mx-auto font-medium"
          >
            Discover over 12,000 hidden gems across NL & BE. From fresh dairy and organic crops to authentic farm stays.
          </motion.p>

          {/* Email form */}
          <motion.div 
            variants={item}
            className="max-w-lg mx-auto mb-16 relative"
          >
            <div className="absolute -top-6 -right-6 text-emerald-400 animate-bounce pointer-events-none hidden sm:block">
              <Sparkles className="w-6 h-6 opacity-40" />
            </div>
            <EmailForm source={source} variant="hero" />
          </motion.div>

          {/* Stats strip */}
          <motion.div 
            variants={item}
            className="grid grid-cols-1 sm:grid-cols-3 items-center justify-center gap-8 text-sm"
          >
            <div className="flex flex-col items-center gap-2 group cursor-default">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                <MapPin className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-white/60 group-hover:text-white/90 transition-colors"><strong className="text-white font-black text-lg block">12,000+</strong> farms mapped</span>
            </div>
            <div className="flex flex-col items-center gap-2 group cursor-default">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                <Wheat className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-white/60 group-hover:text-white/90 transition-colors"><strong className="text-white font-black text-lg block">Verified</strong> fresh produce</span>
            </div>
            <div className="flex flex-col items-center gap-2 group cursor-default">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors text-xl">
                🇳🇱 🇧🇪
              </div>
              <span className="text-white/60 group-hover:text-white/90 transition-colors"><strong className="text-white font-black text-lg block">Local</strong> short chain</span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom wave transition */}
      <div className="relative z-10 overflow-hidden leading-none">
        <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="w-full h-12 block" fill="#F4F1ED">
          <path d="M0,30 C360,60 1080,0 1440,30 L1440,60 L0,60 Z" />
        </svg>
      </div>
    </section>
  )
}
