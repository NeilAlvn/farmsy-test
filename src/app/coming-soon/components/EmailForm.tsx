'use client'

import { useId, useState } from 'react'
import { ArrowRight, CheckCircle, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type Status = 'idle' | 'loading' | 'success' | 'duplicate' | 'error'

interface Props {
  source: string
  variant?: 'hero' | 'cta'
}

export default function EmailForm({ source, variant = 'hero' }: Props) {
  const checkboxId = useId()
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const isHero = variant === 'hero'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'loading') return

    setStatus('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), source, consent }),
      })

      const data: { success?: boolean; error?: string } = await res.json()

      if (res.status === 201) {
        setStatus('success')
      } else if (res.status === 409) {
        setStatus('duplicate')
      } else {
        setStatus('error')
        setErrorMsg(data.error ?? 'Something went wrong. Please try again.')
      }
    } catch {
      setStatus('error')
      setErrorMsg('Network error. Please check your connection and try again.')
    }
  }

  const containerVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95 }
  }

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {status === 'success' ? (
          <motion.div
            key="success"
            variants={containerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={`flex items-start gap-4 rounded-2xl p-6 ${
              isHero
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-white'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
            }`}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.2 }}
            >
              <CheckCircle className={`w-6 h-6 mt-0.5 shrink-0 ${isHero ? 'text-emerald-400' : 'text-emerald-600'}`} />
            </motion.div>
            <div>
              <p className="font-bold text-base">You're on the list!</p>
              <p className={`text-sm mt-1 leading-relaxed ${isHero ? 'text-white/80' : 'text-emerald-700'}`}>
                We've reserved your spot. We'll notify you the moment Farmsy launches.
              </p>
            </div>
          </motion.div>
        ) : status === 'duplicate' ? (
          <motion.div
            key="duplicate"
            variants={containerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={`flex items-start gap-4 rounded-2xl p-6 ${
              isHero
                ? 'bg-amber-500/20 border border-amber-500/40 text-white'
                : 'bg-amber-50 border border-amber-200 text-amber-900'
            }`}
          >
            <CheckCircle className={`w-6 h-6 mt-0.5 shrink-0 ${isHero ? 'text-amber-400' : 'text-amber-600'}`} />
            <div>
              <p className="font-bold text-base">Already registered!</p>
              <p className={`text-sm mt-1 leading-relaxed ${isHero ? 'text-white/80' : 'text-amber-700'}`}>
                This email is already on our list. Keep an eye on your inbox for updates.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={handleSubmit}
            noValidate
            variants={containerVariants}
            initial="initial"
            animate="animate"
            className="w-full"
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative group">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  disabled={status === 'loading'}
                  className={`w-full px-5 py-4 rounded-xl text-base font-medium transition-all duration-300 disabled:opacity-60 ${
                    isHero
                      ? 'bg-white/10 border border-white/20 text-white placeholder-white/40 focus:bg-white/20 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 focus:outline-none'
                      : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none focus:border-emerald-500'
                  }`}
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={status === 'loading' || !consent}
                className={`inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-base whitespace-nowrap transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isHero
                    ? 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-lg'
                }`}
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Joining…
                  </>
                ) : (
                  <>
                    Get Early Access
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </motion.button>
            </div>

            {/* GDPR consent */}
            <motion.label 
              htmlFor={checkboxId} 
              className={`mt-4 flex items-start gap-3 cursor-pointer select-none group ${isHero ? 'text-white/60' : 'text-gray-500'}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <div className="relative mt-1">
                <input
                  id={checkboxId}
                  type="checkbox"
                  checked={consent}
                  onChange={e => setConsent(e.target.checked)}
                  disabled={status === 'loading'}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded border transition-colors duration-200 flex items-center justify-center ${
                  consent 
                    ? 'bg-emerald-500 border-emerald-500' 
                    : isHero ? 'border-white/20 bg-white/5 group-hover:border-white/40' : 'border-gray-300 bg-white group-hover:border-gray-400'
                }`}>
                  {consent && <CheckCircle className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                </div>
              </div>
              <span className="text-xs leading-relaxed group-hover:text-white/80 transition-colors">
                I agree to receive launch updates from Farmsy. You can unsubscribe at any time.{' '}
                <a href="/privacy" className={`${isHero ? 'text-emerald-400 underline hover:text-white' : 'text-emerald-600 underline hover:text-emerald-800'} transition-colors font-medium`}>
                  Privacy policy
                </a>
                .
              </span>
            </motion.label>

            <AnimatePresence>
              {status === 'error' && (
                <motion.p 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`mt-3 text-sm font-medium ${isHero ? 'text-red-400' : 'text-red-600'}`}
                >
                  {errorMsg}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}
