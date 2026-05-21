'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Trash2, MessageSquare } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import StarRating from '@/app/_components/StarRating'

interface Review {
  id: string
  user_id: string
  reviewer_name: string
  rating: number
  body: string | null
  created_at: string
}

interface Props {
  farmOsmId: string
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(new Date(iso))
}

export default function ReviewsSection({ farmOsmId }: Props) {
  const router = useRouter()
  const [userId, setUserId]       = useState<string | null>(null)
  const [userName, setUserName]   = useState('')
  const [reviews, setReviews]     = useState<Review[]>([])
  const [myReview, setMyReview]   = useState<Review | null>(null)
  const [loading, setLoading]     = useState(true)

  // Form state
  const [editing, setEditing]     = useState(false)
  const [draftRating, setDraftRating] = useState(0)
  const [draftBody, setDraftBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id)
        const name =
          (session.user.user_metadata?.full_name as string | undefined) ||
          (session.user.user_metadata?.name as string | undefined) ||
          session.user.email?.split('@')[0] ||
          'Anonymous'
        setUserName(name)
      }
    })
  }, [])

  useEffect(() => {
    supabase
      .from('reviews')
      .select('id, user_id, reviewer_name, rating, body, created_at')
      .eq('farm_osm_id', farmOsmId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const list = (data ?? []) as Review[]
        setReviews(list)
        setLoading(false)
      })
  }, [farmOsmId])

  // Derive myReview once both userId and reviews are loaded
  useEffect(() => {
    if (!userId) return
    const mine = reviews.find(r => r.user_id === userId) ?? null
    setMyReview(mine)
    if (mine && !editing) {
      setDraftRating(mine.rating)
      setDraftBody(mine.body ?? '')
    }
  }, [userId, reviews, editing])

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function submitReview() {
    if (!userId || draftRating === 0) return
    setSubmitting(true)
    setError(null)

    const payload = {
      farm_osm_id:   farmOsmId,
      user_id:       userId,
      reviewer_name: userName,
      rating:        draftRating,
      body:          draftBody.trim() || null,
    }

    let result
    if (myReview) {
      result = await supabase.from('reviews').update(payload).eq('id', myReview.id)
    } else {
      result = await supabase.from('reviews').insert(payload)
    }

    if (result.error) {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
      return
    }

    // Reload
    const { data } = await supabase
      .from('reviews')
      .select('id, user_id, reviewer_name, rating, body, created_at')
      .eq('farm_osm_id', farmOsmId)
      .order('created_at', { ascending: false })

    setReviews((data ?? []) as Review[])
    setEditing(false)
    setSubmitting(false)
  }

  async function deleteReview() {
    if (!myReview) return
    await supabase.from('reviews').delete().eq('id', myReview.id)
    setReviews(prev => prev.filter(r => r.id !== myReview.id))
    setMyReview(null)
    setDraftRating(0)
    setDraftBody('')
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 size={16} className="animate-spin text-gray-300" />
      </div>
    )
  }

  const avg = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0

  const others = reviews.filter(r => r.user_id !== userId)

  return (
    <div className="space-y-4">

      {/* ── Summary ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <MessageSquare size={12} className="text-gray-400 shrink-0" />
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Reviews
        </h3>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <StarRating rating={avg} size={13} />
            <span className="text-sm font-bold text-gray-800">{avg.toFixed(1)}</span>
            <span className="text-xs text-gray-400">({reviews.length})</span>
          </div>
        )}
      </div>

      {/* ── My review / write form ───────────────────────────────────────────── */}
      {userId ? (
        myReview && !editing ? (
          /* Existing review — display mode */
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Your review</p>
                <StarRating rating={myReview.rating} size={14} />
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => { setEditing(true); setDraftRating(myReview.rating); setDraftBody(myReview.body ?? '') }}
                  className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-600 transition-colors"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={deleteReview}
                  className="p-1.5 rounded-lg hover:bg-red-100 text-red-400 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            {myReview.body && (
              <p className="text-sm text-gray-700 leading-relaxed mt-2">{myReview.body}</p>
            )}
          </div>
        ) : (
          /* Write / edit form */
          <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500">
              {myReview ? 'Edit your review' : 'Leave a review'}
            </p>
            <StarRating
              rating={draftRating}
              size={22}
              interactive
              onRate={setDraftRating}
            />
            <textarea
              rows={3}
              value={draftBody}
              onChange={e => setDraftBody(e.target.value)}
              placeholder="Share your experience… (optional)"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors bg-white"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 justify-end">
              {(myReview || editing) && (
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={submitReview}
                disabled={submitting || draftRating === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold transition-colors"
              >
                {submitting && <Loader2 size={13} className="animate-spin" />}
                {myReview ? 'Update' : 'Submit'}
              </button>
            </div>
          </div>
        )
      ) : (
        /* Not logged in */
        <button
          onClick={() => router.push('/auth/signin')}
          className="w-full py-3 rounded-2xl border border-dashed border-gray-200 text-sm text-gray-400 hover:text-emerald-600 hover:border-emerald-300 transition-colors"
        >
          Sign in to leave a review
        </button>
      )}

      {/* ── Other reviews ───────────────────────────────────────────────────── */}
      {others.length > 0 && (
        <div className="space-y-3">
          {others.map(r => (
            <div key={r.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-xs font-bold text-gray-500">
                {initials(r.reviewer_name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-gray-800 truncate">{r.reviewer_name}</span>
                  <span className="text-xs text-gray-400 shrink-0">{formatDate(r.created_at)}</span>
                </div>
                <StarRating rating={r.rating} size={12} />
                {r.body && <p className="text-sm text-gray-600 leading-relaxed mt-1">{r.body}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {reviews.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-2">No reviews yet. Be the first!</p>
      )}
    </div>
  )
}
