'use client'

import { useState } from 'react'
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
    desc: 'Questions about claiming your listing, updating your information, or removing your farm.',
    email: 'farms@farmsy.nl',
    subject: 'Farm owner inquiry',
  },
  {
    Icon: MessageSquare,
    title: 'Support',
    desc: "Can't find a farm, spotted an error, or need help? We'll get back to you quickly.",
    email: 'info@farmsy.nl',
    subject: 'Support request',
  },
  {
    Icon: Lightbulb,
    title: 'Feedback',
    desc: "Ideas for new features, farms we should add, or anything you'd like to see improve.",
    email: 'feedback@farmsy.nl',
    subject: 'Feedback',
  },
]

const inputStyle = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  color: 'var(--foreground)',
  borderRadius: '0.75rem',
  padding: '0.75rem 1rem',
  width: '100%',
  fontSize: '0.875rem',
  outline: 'none',
}

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
    window.location.href = `mailto:info@farmsy.nl?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`
    setSent(true)
  }

  return (
    <ContentLayout>

      {/* Page header */}
      <section className="px-6 pt-20 pb-16" style={{ borderBottom: '1px solid oklch(0.9 0.008 80 / 0.6)' }}>
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--primary)' }}>
            Get in touch
          </p>
          <h1 className="font-display text-5xl font-medium leading-[1.05] tracking-[-0.025em]" style={{ color: 'var(--foreground)' }}>
            We&apos;d love to{' '}
            <span className="serif-italic" style={{ color: 'var(--primary)' }}>hear from you</span>
          </h1>
          <p className="mt-5 text-lg leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            Questions, farm data requests, or just want to say hello — we typically respond within one business day.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-5">

            {/* Form */}
            <div className="lg:col-span-3">
              <h2 className="font-display text-2xl font-medium tracking-tight mb-8" style={{ color: 'var(--foreground)' }}>
                Send us a message
              </h2>

              {sent ? (
                <div className="rounded-3xl border p-8 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
                  <div
                    className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    <Mail className="h-7 w-7" style={{ color: 'var(--primary-foreground)' }} />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                    Message opened in your email app
                  </h3>
                  <p className="mb-5 text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                    Your email client should have opened with the message pre-filled. Send it from there and we'll get back to you soon.
                  </p>
                  <button
                    onClick={() => setSent(false)}
                    className="text-sm font-medium underline underline-offset-4"
                    style={{ color: 'var(--primary)' }}
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }} htmlFor="name">Name</label>
                      <input id="name" type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inputStyle} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }} htmlFor="email">Email</label>
                      <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" style={inputStyle} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }} htmlFor="topic">Topic</label>
                    <select id="topic" required value={topic} onChange={e => setTopic(e.target.value)} style={{ ...inputStyle, backgroundColor: 'var(--card)' }}>
                      <option value="" disabled>Select a topic…</option>
                      {TOPICS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }} htmlFor="message">Message</label>
                    <textarea id="message" required rows={5} value={message} onChange={e => setMessage(e.target.value)} placeholder="How can we help?" style={{ ...inputStyle, resize: 'none' }} />
                  </div>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition hover:opacity-90"
                    style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                  >
                    Send message <ArrowRight className="h-4 w-4" />
                  </button>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    This opens your email app. No data is sent to our servers from this form.
                  </p>
                </form>
              )}
            </div>

            {/* Contact cards */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="font-display text-2xl font-medium tracking-tight mb-8" style={{ color: 'var(--foreground)' }}>
                Direct contact
              </h2>
              {CONTACT_CARDS.map(({ Icon, title, desc, email: addr, subject }) => (
                <a
                  key={title}
                  href={`mailto:${addr}?subject=${encodeURIComponent(subject)}`}
                  className="group block rounded-2xl border p-5 transition-shadow hover:shadow-sm"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors"
                      style={{ backgroundColor: 'oklch(0.36 0.07 145 / 0.1)' }}
                    >
                      <Icon className="h-5 w-5" style={{ color: 'var(--primary)' }} />
                    </div>
                    <div>
                      <p className="mb-1 font-semibold" style={{ color: 'var(--foreground)' }}>{title}</p>
                      <p className="mb-2 text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{desc}</p>
                      <p className="text-xs font-medium" style={{ color: 'var(--primary)' }}>{addr}</p>
                    </div>
                  </div>
                </a>
              ))}
            </div>

          </div>
        </div>
      </section>

    </ContentLayout>
  )
}
