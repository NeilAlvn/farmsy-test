'use client'

import { Map, ShieldCheck, Users, Smartphone } from 'lucide-react'
import EmailForm from './EmailForm'
import { motion } from 'framer-motion'

interface Props { source: string }

const FEATURES = [
  {
    Icon: Map,
    title: 'Find farms near you',
    desc: 'Interactive map with thousands of farms, farm shops, and markets across the Netherlands and Belgium.',
    color: 'bg-emerald-100 text-emerald-700',
  },
  {
    Icon: ShieldCheck,
    title: 'Verified organic farms',
    desc: "SKAL-certified and bio-certified farms clearly marked. Know exactly what you're getting.",
    color: 'bg-teal-100 text-teal-700',
  },
  {
    Icon: Users,
    title: 'Connect with farmers',
    desc: 'Opening hours, phone numbers, websites — everything you need to visit or order directly.',
    color: 'bg-lime-100 text-lime-700',
  },
  {
    Icon: Smartphone,
    title: 'Mobile-first directory',
    desc: 'Built for your phone. Find a farm, get directions, and go — all in a few taps.',
    color: 'bg-green-100 text-green-700',
  },
] as const

export default function Features({ source }: Props) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  }

  const item = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, damping: 20, stiffness: 100 } }
  }

  return (
    <>
      {/* ── What's coming ───────────────────────────────────────── */}
      <section className="bg-[#F4F1ED] py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <span className="inline-block bg-emerald-500/10 text-emerald-700 text-xs font-black uppercase tracking-widest px-5 py-2 rounded-full mb-6 border border-emerald-500/10">
              Future of Local Food
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-[#1A1A1A] tracking-tight">
              A smarter way to shop{' '}
              <span className="text-emerald-600 block sm:inline">directly from source</span>
            </h2>
          </motion.div>

          <motion.div 
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-8"
          >
            {FEATURES.map(({ Icon, title, desc, color }) => (
              <motion.div
                key={title}
                variants={item}
                whileHover={{ y: -5, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
                className="bg-white rounded-3xl p-10 border border-black/5 transition-all duration-300 group"
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transform group-hover:rotate-6 transition-transform duration-300 ${color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-[#1A1A1A] mb-4">{title}</h3>
                <p className="text-base text-[#6B6B6B] leading-relaxed font-medium">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Second email CTA ────────────────────────────────────── */}
      <section className="bg-[#1E3A0A] py-32 px-6 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500 rounded-full blur-[120px] -mr-64 -mt-32 pointer-events-none" 
        />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative z-10 max-w-2xl mx-auto text-center"
        >
          <p className="text-emerald-400 text-sm font-black uppercase tracking-widest mb-6">
            Join the movement
          </p>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 tracking-tight">
            Ready to discover your <br /> local boer?
          </h2>
          <p className="text-white/60 text-lg leading-relaxed mb-12 font-medium max-w-md mx-auto">
            Get early access to the full map and launch updates directly in your inbox.
          </p>
          <div className="max-w-md mx-auto">
            <EmailForm source={source} variant="hero" />
          </div>
        </motion.div>
      </section>
    </>
  )
}
