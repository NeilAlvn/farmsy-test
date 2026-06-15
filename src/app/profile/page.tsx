'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  User, Mail, Calendar, Shield, LogOut,
  Loader2, CheckCircle2, AlertCircle, Pencil, X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { destroySession } from '@/lib/session'
import ContentLayout from '@/app/_components/ContentLayout'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface Profile {
  id: string
  email: string | null
  name: string | null
  created_at: string
  role: 'user' | 'farmer' | 'admin'
}

const ROLE_LABELS: Record<string, string> = {
  user: 'Member',
  farmer: 'Farm Owner',
  admin: 'Administrator',
}

const ROLE_COLORS: Record<string, string> = {
  user: 'bg-gray-100 text-gray-600',
  farmer: 'bg-emerald-100 text-emerald-700',
  admin: 'bg-amber-100 text-amber-700',
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-NL', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/auth/signin?redirect=/profile')
        return
      }
      setUser(session.user)

      const { data } = await supabase
        .from('profiles')
        .select('id, email, name, created_at, role')
        .eq('id', session.user.id)
        .maybeSingle()

      setProfile(data ?? {
        id: session.user.id,
        email: session.user.email ?? null,
        name: null,
        created_at: session.user.created_at,
        role: 'user',
      })
      setLoading(false)
    })
  }, [router])

  async function saveName() {
    if (!user) return
    setSaving(true)
    setSaveMsg(null)

    const { error } = await supabase
      .from('profiles')
      .update({ name: nameInput.trim() || null })
      .eq('id', user.id)

    if (error) {
      setSaveMsg({ type: 'err', text: 'Could not save. Please try again.' })
    } else {
      setProfile(p => p ? { ...p, name: nameInput.trim() || null } : p)
      setEditingName(false)
      setSaveMsg({ type: 'ok', text: 'Name updated.' })
      setTimeout(() => setSaveMsg(null), 3000)
    }
    setSaving(false)
  }

  async function signOut() {
    await destroySession()
    router.push('/')
  }

  if (loading) {
    return (
      <ContentLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 size={22} className="animate-spin text-gray-300" />
        </div>
      </ContentLayout>
    )
  }

  const initials = profile?.name
    ? profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : profile?.email?.[0].toUpperCase() ?? 'U'

  return (
    <ContentLayout>

      {/* Hero */}
      <section className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white py-16 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="max-w-3xl mx-auto relative flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-2xl font-black text-white shrink-0">
            {initials}
          </div>
          <div>
            <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1">Your account</p>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {profile?.name || 'My profile'}
            </h1>
            <p className="text-emerald-100/70 text-sm mt-1">{profile?.email}</p>
          </div>
        </div>
      </section>

      <div className="py-12 px-4 bg-gray-50 min-h-[60vh]">
        <div className="max-w-2xl mx-auto space-y-5">

          {saveMsg && (
            <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-medium ${
              saveMsg.type === 'ok'
                ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                : 'bg-red-50 border border-red-100 text-red-600'
            }`}>
              {saveMsg.type === 'ok'
                ? <CheckCircle2 size={15} className="shrink-0" />
                : <AlertCircle size={15} className="shrink-0" />}
              {saveMsg.text}
            </div>
          )}

          {/* Profile card */}
          <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-50">
              <h2 className="text-base font-bold text-gray-900">Profile information</h2>
            </div>

            <div className="divide-y divide-gray-50">

              {/* Name */}
              <div className="px-6 py-4 flex items-start gap-4">
                <User size={16} className="text-gray-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Display name</p>
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                        placeholder="Your name"
                        className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                      />
                      <button
                        onClick={saveName}
                        disabled={saving}
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                      >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingName(false)}
                        className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-900 font-medium">
                        {profile?.name || <span className="text-gray-400 italic">Not set</span>}
                      </p>
                      <button
                        onClick={() => { setNameInput(profile?.name ?? ''); setEditingName(true) }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="Edit name"
                      >
                        <Pencil size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="px-6 py-4 flex items-start gap-4">
                <Mail size={16} className="text-gray-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Email address</p>
                  <p className="text-sm text-gray-900 font-medium">{profile?.email ?? user?.email}</p>
                </div>
              </div>

              {/* Role */}
              <div className="px-6 py-4 flex items-start gap-4">
                <Shield size={16} className="text-gray-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Account type</p>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${ROLE_COLORS[profile?.role ?? 'user']}`}>
                    {ROLE_LABELS[profile?.role ?? 'user']}
                  </span>
                  {profile?.role === 'user' && (
                    <p className="text-xs text-gray-400 mt-1.5">
                      Own a farm?{' '}
                      <Link href="/contact" className="text-emerald-600 hover:underline font-medium">
                        Contact us to claim it
                      </Link>
                    </p>
                  )}
                </div>
              </div>

              {/* Member since */}
              <div className="px-6 py-4 flex items-start gap-4">
                <Calendar size={16} className="text-gray-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Member since</p>
                  <p className="text-sm text-gray-900 font-medium">
                    {profile?.created_at ? fmt(profile.created_at) : '—'}
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Actions */}
          <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-50">
              <h2 className="text-base font-bold text-gray-900">Account</h2>
            </div>
            <div className="p-4">
              <button
                onClick={signOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-gray-200 hover:border-red-200 hover:bg-red-50 text-gray-700 hover:text-red-600 text-sm font-semibold transition-all"
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          </div>

        </div>
      </div>
    </ContentLayout>
  )
}
