'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { Loader2, ExternalLink } from 'lucide-react'
import { getAdminContact, type ContactSubmissionRow } from '../actions'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TOPICS = ['All', 'Support', 'Billing', 'Partnership', 'Other'] as const
type TopicFilter = typeof TOPICS[number]

export default function ContactPage() {
  const [rows, setRows] = useState<ContactSubmissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [topic, setTopic] = useState<TopicFilter>('All')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    getAdminContact().then(data => { setRows(data); setLoading(false) })
  }, [])

  const filtered = useMemo(() =>
    topic === 'All' ? rows : rows.filter(r => r.topic.toLowerCase() === topic.toLowerCase()),
    [rows, topic]
  )

  return (
    <div className="space-y-6 max-w-6xl">

      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Contact Submissions</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          {loading ? '…' : `${rows.length} total submissions`}
        </p>
      </div>

      {/* Topic filter */}
      <div className="flex flex-wrap gap-2">
        {TOPICS.map(t => (
          <button
            key={t}
            onClick={() => setTopic(t)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
            style={topic === t
              ? { backgroundColor: 'var(--primary)', color: 'white' }
              : { backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }
            }
          >
            {t}
            {t !== 'All' && (
              <span className="ml-1.5 opacity-60">
                {rows.filter(r => r.topic.toLowerCase() === t.toLowerCase()).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-16 text-sm" style={{ color: 'var(--muted-foreground)' }}>No submissions</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--cream)' }}>
                  {['Name', 'Email', 'Topic', 'Message', 'Source', 'Received'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <Fragment key={r.id}>
                    <tr
                      onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                      style={{ borderBottom: expanded === r.id ? 'none' : i < filtered.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
                      className="hover:bg-black/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: 'var(--foreground)' }}>{r.name}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        <a
                          href={`mailto:${r.email}`}
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 hover:underline"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          {r.email}
                          <ExternalLink size={10} />
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: 'var(--cream)', color: 'var(--foreground)' }}
                        >
                          {r.topic}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[260px] truncate" style={{ color: 'var(--muted-foreground)' }}>{r.message}</td>
                      <td className="px-4 py-3">
                        <span
                          className="text-xs font-medium"
                          style={{ color: r.source === 'widget' ? '#D97706' : 'var(--muted-foreground)' }}
                        >
                          {r.source}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>{fmtDate(r.created_at)}</td>
                    </tr>
                    {expanded === r.id && (
                      <tr style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td colSpan={6} className="px-4 pb-4 pt-1">
                          <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: 'var(--cream)', color: 'var(--foreground)' }}>
                            <p className="font-semibold mb-1 text-xs uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>Full Message</p>
                            <p className="leading-relaxed">{r.message}</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Click any row to expand the full message.</p>

    </div>
  )
}
