'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, MessageSquare, Store, Lightbulb, ArrowRight } from 'lucide-react'
import ContentLayout from '@/app/_components/ContentLayout'

const TOPICS = [
  { value: 'general',  label: 'General question' },
  { value: 'farm',     label: 'Farm owner / claim inquiry' },
  { value: 'data',     label: 'Incorrect farm data' },
  { value: 'feedback', label: 'Feedback or suggestion' },
  { value: 'privacy',  label: 'Privacy / data request' },
  { value: 'other',    label: 'Other' },
]

const CONTACT_CARDS = [
  {
    Icon: Store,
    title: 'Farm owners',
    desc: 'Questions about claiming your listing, updating your information, or removing your farm from our database.',
    email: 'farms@delokaaleboer.nl',
    subject: 'Farm owner inquiry',
  },
  {
    Icon: MessageSquare,
    title: 'Support',
    desc: 'Can\'t find a farm, spotted an error, or need help using the platform? We\'ll get back to you quickly.',
    email: 'info@delokaaleboer.nl',
    subject: 'Support request',
  },
  {
    Icon: Lightbulb,
    title: 'Suggestions & feedback',
    desc: 'Ideas for new features, farms we should add, or anything else you\'d like to see improve.',
    email: 'feedback@delokaaleboer.nl',
    subject: 'Feedback',
  },
]

export default function ContactPage() {
  const [topic, setTopic] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const subjectLine = `[${TOPICS.find(t => t.value === topic)?.label ?? 'Contact'}] from ${name}`
    const body = `Name: ${name}\nEmail: ${email}\nTopic: ${topic}\n\n${message}`
    window.location.href = `mailto:info@delokaaleboer.nl?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`
    setSent(true)
  }

  return (
    <ContentLayout>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white py-24 px-4 overflow-hidden relative">
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="max-w-3xl mx-auto relative">
          <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest mb-3">Get in touch</p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6 leading-tight">
            We&apos;d love to hear from you
          </h1>
          <p className="text-emerald-100/80 text-lg leading-relaxed max-w-2xl">
            Questions, farm data requests, or just want to say hello — we typically respond within one business day.
          </p>
        </div>
      </section>

      <div className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">

            {/* ── Contact form ─────────────────────────────────── */}
            <div className="lg:col-span-3">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-6">Send us a message</h2>

              {sent ? (
                <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-8 text-center">
                  <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-600/25">
                    <Mail className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Message opened in your email app</h3>
                  <p className="text-gray-500 text-sm mb-5">
                    Your default email client should have opened with the message pre-filled. Send it from there and
                    we&apos;ll get back to you soon.
                  </p>
                  <button
                    onClick={() => setSent(false)}
                    className="text-sm text-emerald-600 hover:underline font-medium"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700" htmlFor="name">Name</label>
                      <input
                        id="name"
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Your name"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700" htmlFor="email">Email</label>
                      <input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700" htmlFor="topic">Topic</label>
                    <select
                      id="topic"
                      required
                      value={topic}
                      onChange={e => setTopic(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all bg-white"
                    >
                      <option value="" disabled>Select a topic…</option>
                      {TOPICS.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700" htmlFor="message">Message</label>
                    <textarea
                      id="message"
                      required
                      rows={5}
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder="How can we help?"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold px-6 py-3 rounded-full transition-all shadow-md shadow-emerald-600/20"
                  >
                    Send message <ArrowRight className="w-4 h-4" />
                  </button>
                  <p className="text-xs text-gray-400">
                    This opens your email app. No data is sent to our servers from this form.
                  </p>
                </form>
              )}
            </div>

            {/* ── Contact cards ────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-6">Direct contact</h2>
              {CONTACT_CARDS.map(({ Icon, title, desc, email: addr, subject }) => (
                <a
                  key={title}
                  href={`mailto:${addr}?subject=${encodeURIComponent(subject)}`}
                  className="block bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md hover:border-emerald-100 transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 group-hover:bg-emerald-600 flex items-center justify-center shrink-0 transition-colors">
                      <Icon className="w-5 h-5 text-emerald-600 group-hover:text-white transition-colors" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 mb-1">{title}</p>
                      <p className="text-sm text-gray-500 leading-relaxed mb-2">{desc}</p>
                      <p className="text-xs font-medium text-emerald-600">{addr}</p>
                    </div>
                  </div>
                </a>
              ))}
            </div>

          </div>
        </div>
      </div>

    </ContentLayout>
  )
}
