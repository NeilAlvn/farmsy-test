'use client'

import { useEffect, useState } from 'react'
import { Loader2, X, RotateCcw, Save } from 'lucide-react'
import { useToast } from '@/app/_components/ToastProvider'
import {
  getUserDetail,
  updateUserFields,
  resetUserTestingState,
} from '../../actions'

// ─── Field definitions ──────────────────────────────────────────────────────
// Only fields whose `key` exists on the fetched row are rendered, so this stays
// correct even before the referral/personal-column migration has been run.

type FieldType = 'text' | 'email' | 'number' | 'boolean' | 'datetime' | 'select'

interface FieldDef {
  key: string
  label: string
  type: FieldType
  options?: { value: string; label: string }[]
  help?: string
  section: 'Account' | 'Billing' | 'Referral'
}

const FIELDS: FieldDef[] = [
  { key: 'name',        label: 'Display name',  type: 'text',  section: 'Account' },
  { key: 'first_name',  label: 'First name',    type: 'text',  section: 'Account' },
  { key: 'last_name',   label: 'Last name',     type: 'text',  section: 'Account' },
  { key: 'email',       label: 'Email',         type: 'email', section: 'Account', help: 'Changes the profile email only — not the auth login email.' },
  { key: 'role',        label: 'Role',          type: 'select', section: 'Account',
    options: [
      { value: 'user',   label: 'User' },
      { value: 'farmer', label: 'Farmer' },
      { value: 'admin',  label: 'Admin' },
    ] },
  { key: 'email_verified', label: 'Email verified', type: 'boolean', section: 'Account' },

  { key: 'subscription_status', label: 'Subscription status', type: 'select', section: 'Billing',
    options: [
      { value: 'free',     label: 'Free' },
      { value: 'trialing', label: 'Trialing' },
      { value: 'active',   label: 'Active' },
      { value: 'past_due', label: 'Past due' },
      { value: 'canceled', label: 'Canceled' },
    ] },
  { key: 'subscription_plan', label: 'Plan', type: 'select', section: 'Billing',
    options: [
      { value: '',         label: '— none —' },
      { value: 'yearly',   label: 'Yearly' },
      { value: 'lifetime', label: 'Lifetime' },
    ] },
  { key: 'subscription_end_date', label: 'Subscription end / trial end', type: 'datetime', section: 'Billing' },
  { key: 'cancelled_at',          label: 'Cancelled at',                  type: 'datetime', section: 'Billing' },
  { key: 'win_back_sent',         label: 'Win-back email sent',           type: 'boolean',  section: 'Billing' },
  { key: 'stripe_customer_id',    label: 'Stripe customer ID',            type: 'text',     section: 'Billing' },
  { key: 'stripe_subscription_id',label: 'Stripe subscription ID',        type: 'text',     section: 'Billing' },

  { key: 'referral_code',           label: 'Referral code',            type: 'text',   section: 'Referral' },
  { key: 'referred_by',             label: 'Referred by (user ID)',    type: 'text',   section: 'Referral' },
  { key: 'pending_referral_months', label: 'Pending free months',      type: 'number', section: 'Referral' },
]

const SECTIONS: FieldDef['section'][] = ['Account', 'Billing', 'Referral']

// ── Value <-> input helpers ──────────────────────────────────────────────────

function toInputValue(type: FieldType, raw: unknown): string {
  if (raw === null || raw === undefined) return ''
  if (type === 'datetime') {
    const d = new Date(String(raw))
    if (isNaN(d.getTime())) return ''
    // local YYYY-MM-DDTHH:mm
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  return String(raw)
}

function fromInputValue(type: FieldType, value: string | boolean): unknown {
  if (type === 'boolean') return !!value
  if (value === '') return null
  if (type === 'number') return Number(value)
  if (type === 'datetime') return new Date(value as string).toISOString()
  return value
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EditUserDrawer({
  userId,
  onClose,
  onSaved,
}: {
  userId: string
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [row, setRow]         = useState<Record<string, unknown> | null>(null)
  const [values, setValues]   = useState<Record<string, string | boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    let active = true
    getUserDetail(userId).then(data => {
      if (!active) return
      setRow(data)
      if (data) {
        const init: Record<string, string | boolean> = {}
        for (const f of FIELDS) {
          if (f.key in data) {
            init[f.key] = f.type === 'boolean'
              ? !!data[f.key]
              : toInputValue(f.type, data[f.key])
          }
        }
        setValues(init)
      }
      setLoading(false)
    })
    return () => { active = false }
  }, [userId])

  // Only render fields that actually exist on the row
  const presentFields = row ? FIELDS.filter(f => f.key in row) : []

  function setVal(key: string, v: string | boolean) {
    setValues(prev => ({ ...prev, [key]: v }))
  }

  async function handleSave() {
    if (!row) return
    setSaving(true)
    // Diff against original
    const changed: Record<string, unknown> = {}
    for (const f of presentFields) {
      const orig = f.type === 'boolean' ? !!row[f.key] : toInputValue(f.type, row[f.key])
      const cur  = values[f.key]
      if (orig !== cur) changed[f.key] = fromInputValue(f.type, cur)
    }
    if (Object.keys(changed).length === 0) {
      toast({ type: 'info', title: 'No changes to save' })
      setSaving(false)
      return
    }
    const result = await updateUserFields(userId, changed)
    setSaving(false)
    if (result.ok) {
      toast({ type: 'success', title: 'User updated' })
      onSaved()
      onClose()
    } else {
      toast({ type: 'error', title: result.error ?? 'Update failed' })
    }
  }

  async function handleReset() {
    if (!confirm('Reset this user\'s billing & referral state for testing?\n\nSets subscription to free, clears plan/dates/Stripe IDs, zeroes pending months, and removes any referral code they redeemed.')) return
    setResetting(true)
    const result = await resetUserTestingState(userId)
    setResetting(false)
    if (result.ok) {
      toast({ type: 'success', title: 'User reset for testing' })
      onSaved()
      onClose()
    } else {
      toast({ type: 'error', title: result.error ?? 'Reset failed' })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div
        className="relative w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col"
        style={{ backgroundColor: 'var(--background)' }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
          style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>Edit user</h2>
            <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{userId}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/[0.05] transition-colors">
            <X size={18} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
          </div>
        ) : !row ? (
          <p className="p-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>User not found.</p>
        ) : (
          <>
            <div className="flex-1 px-6 py-5 space-y-6">
              {SECTIONS.map(section => {
                const fields = presentFields.filter(f => f.section === section)
                if (fields.length === 0) return null
                return (
                  <div key={section}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--muted-foreground)' }}>
                      {section}
                    </p>
                    <div className="space-y-4">
                      {fields.map(f => (
                        <div key={f.key}>
                          {f.type === 'boolean' ? (
                            <label className="flex items-center justify-between cursor-pointer">
                              <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{f.label}</span>
                              <button
                                type="button"
                                onClick={() => setVal(f.key, !values[f.key])}
                                className="relative w-11 h-6 rounded-full transition-colors"
                                style={{ backgroundColor: values[f.key] ? 'var(--primary)' : 'var(--border)' }}
                              >
                                <span
                                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                                  style={{ transform: values[f.key] ? 'translateX(20px)' : 'none' }}
                                />
                              </button>
                            </label>
                          ) : (
                            <>
                              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>{f.label}</label>
                              {f.type === 'select' ? (
                                <select
                                  value={String(values[f.key] ?? '')}
                                  onChange={e => setVal(f.key, e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
                                  style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                                >
                                  {f.options!.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type={f.type === 'datetime' ? 'datetime-local' : f.type === 'number' ? 'number' : f.type === 'email' ? 'email' : 'text'}
                                  value={String(values[f.key] ?? '')}
                                  onChange={e => setVal(f.key, e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
                                  style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                                />
                              )}
                            </>
                          )}
                          {f.help && (
                            <p className="text-[11px] mt-1" style={{ color: 'var(--muted-foreground)' }}>{f.help}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer actions */}
            <div
              className="sticky bottom-0 px-6 py-4 flex items-center gap-3"
              style={{ backgroundColor: 'var(--card)', borderTop: '1px solid var(--border)' }}
            >
              <button
                onClick={handleReset}
                disabled={resetting || saving}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:bg-black/[0.04] disabled:opacity-50"
                style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
                title="Reset billing & referral state for testing"
              >
                {resetting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={saving || resetting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save changes
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
