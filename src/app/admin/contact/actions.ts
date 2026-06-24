'use server'

import { createClient } from '@supabase/supabase-js'
import { sendContactReply } from '@/lib/email'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

// Unified inbox row — represents either an existing thread or an unprocessed
// contact_submission that hasn't been replied to yet (lazy migration).
export interface ConversationRow {
  id: string              // thread.id OR contact_submission.id
  type: 'thread' | 'submission'
  threadId: string | null // null until first admin reply converts it to a thread
  userId: string | null
  userEmail: string
  userName: string
  subject: string
  topic: string | null
  source: string          // 'contact_form' | 'in_app'
  lastMessageAt: string
  preview: string
  unreadAdmin: number
  isReplied: boolean
  isArchived: boolean
}

export interface MessageRow {
  id: string
  threadId: string
  senderType: 'admin' | 'user'
  body: string
  source: string
  emailStatus: string
  createdAt: string
}

export interface UserSearchResult {
  id: string
  email: string
  name: string
}

// ─── getInboxThreads ──────────────────────────────────────────────────────────
// Returns unified list: existing threads + contact_submissions without a thread.
// Sorted by last activity, newest first.

export async function getInboxThreads(): Promise<ConversationRow[]> {
  const supabase = db()

  const [{ data: threads }, { data: allSubs }] = await Promise.all([
    supabase
      .from('message_threads')
      .select('id, user_id, user_email, user_name, subject, topic, contact_submission_id, last_message_at, last_message_preview, unread_admin, is_archived')
      .eq('is_archived', false)
      .order('last_message_at', { ascending: false })
      .limit(500),
    supabase
      .from('contact_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  // Which contact_submission IDs already have a thread?
  const linkedSubIds = new Set(
    (threads ?? []).map((t: any) => t.contact_submission_id).filter(Boolean)
  )

  // Which threads have at least one admin reply?
  const threadIds = (threads ?? []).map((t: any) => t.id)
  const repliedThreadIds = new Set<string>()
  if (threadIds.length > 0) {
    const { data: adminMsgs } = await supabase
      .from('messages')
      .select('thread_id')
      .in('thread_id', threadIds)
      .eq('sender_type', 'admin')
    ;(adminMsgs ?? []).forEach((m: any) => repliedThreadIds.add(m.thread_id))
  }

  const result: ConversationRow[] = []

  // Threads (new system)
  for (const t of threads ?? []) {
    result.push({
      id: t.id,
      type: 'thread',
      threadId: t.id,
      userId: t.user_id,
      userEmail: t.user_email,
      userName: t.user_name,
      subject: t.subject,
      topic: t.topic,
      source: t.contact_submission_id ? 'contact_form' : 'in_app',
      lastMessageAt: t.last_message_at,
      preview: t.last_message_preview ?? '',
      unreadAdmin: t.unread_admin,
      isReplied: repliedThreadIds.has(t.id),
      isArchived: t.is_archived,
    })
  }

  // Unprocessed contact_submissions (legacy — no thread yet)
  for (const s of allSubs ?? []) {
    if (linkedSubIds.has(s.id)) continue
    result.push({
      id: s.id,
      type: 'submission',
      threadId: null,
      userId: null,
      userEmail: s.email,
      userName: s.name,
      subject: s.topic ?? 'Contact',
      topic: s.topic,
      source: s.source ?? 'contact_form',
      lastMessageAt: s.created_at,
      preview: (s.message ?? '').slice(0, 100),
      unreadAdmin: s.replied_at ? 0 : 1,
      isReplied: !!s.replied_at,
      isArchived: false,
    })
  }

  result.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
  return result
}

// ─── getThreadMessages ────────────────────────────────────────────────────────
// Returns all messages for an existing thread, oldest first (chat order).

export async function getThreadMessages(threadId: string): Promise<MessageRow[]> {
  const { data } = await db()
    .from('messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })

  return (data ?? []).map((m: any) => ({
    id: m.id,
    threadId: m.thread_id,
    senderType: m.sender_type as 'admin' | 'user',
    body: m.body,
    source: m.source,
    emailStatus: m.email_status,
    createdAt: m.created_at,
  }))
}

// ─── getContactSubmission ─────────────────────────────────────────────────────
// Fetches a single contact_submission by ID (used when viewing a submission
// that hasn't been converted to a thread yet).

export async function getContactSubmission(id: string) {
  const { data } = await db()
    .from('contact_submissions')
    .select('*')
    .eq('id', id)
    .single()
  return data ?? null
}

// ─── replyToThread ────────────────────────────────────────────────────────────
// Adds an admin message to an existing thread and sends a Resend email.

export async function replyToThread(
  threadId: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()

  const { data: thread } = await supabase
    .from('message_threads')
    .select('user_email, subject')
    .eq('id', threadId)
    .single()

  if (!thread) return { ok: false, error: 'Thread not found' }

  // Send email
  let emailStatus: 'sent' | 'failed' | 'skipped' = 'skipped'
  try {
    await sendContactReply(thread.user_email, {
      subject: `Re: ${thread.subject} — Farmsy`,
      body,
    })
    emailStatus = 'sent'
  } catch {
    emailStatus = 'failed'
  }

  // Insert message row
  await supabase.from('messages').insert({
    thread_id: threadId,
    sender_type: 'admin',
    body,
    source: 'in_app',
    email_status: emailStatus,
    is_read: true,
  })

  // Update thread metadata
  await supabase
    .from('message_threads')
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: body.slice(0, 100),
    })
    .eq('id', threadId)

  return { ok: true }
}

// ─── replyToSubmission ────────────────────────────────────────────────────────
// Lazy thread creation: converts a contact_submission into a thread on the
// admin's first reply. Imports the original message, sends the reply email,
// and updates the submission's replied_at for backward compatibility.

export async function replyToSubmission(
  submissionId: string,
  body: string,
): Promise<{ ok: boolean; threadId?: string; error?: string }> {
  const supabase = db()

  const { data: sub } = await supabase
    .from('contact_submissions')
    .select('*')
    .eq('id', submissionId)
    .single()

  if (!sub) return { ok: false, error: 'Submission not found' }

  // Create the thread
  const { data: thread, error: threadErr } = await supabase
    .from('message_threads')
    .insert({
      user_email: sub.email,
      user_name: sub.name,
      subject: sub.topic ?? 'Contact',
      topic: sub.topic,
      contact_submission_id: submissionId,
      last_message_at: new Date().toISOString(),
      last_message_preview: body.slice(0, 100),
      unread_admin: 0,
    })
    .select('id')
    .single()

  if (threadErr || !thread) return { ok: false, error: 'Failed to create thread' }

  const threadId: string = thread.id

  // Import original contact form message as first message (preserving timestamp)
  await supabase.from('messages').insert({
    thread_id: threadId,
    sender_type: 'user',
    body: sub.message ?? '',
    source: 'contact_form',
    email_status: 'skipped',
    is_read: true,
    created_at: sub.created_at,
  })

  // Send reply email
  let emailStatus: 'sent' | 'failed' | 'skipped' = 'skipped'
  try {
    await sendContactReply(sub.email, {
      subject: `Re: ${sub.topic ?? 'Contact'} — Farmsy`,
      body,
    })
    emailStatus = 'sent'
  } catch {
    emailStatus = 'failed'
  }

  // Insert admin reply message
  await supabase.from('messages').insert({
    thread_id: threadId,
    sender_type: 'admin',
    body,
    source: 'in_app',
    email_status: emailStatus,
    is_read: true,
  })

  // Keep contact_submission.replied_at in sync for backward compatibility
  await supabase
    .from('contact_submissions')
    .update({
      replied_at: new Date().toISOString(),
      reply_message: body,
      reply_subject: `Re: ${sub.topic ?? 'Contact'} — Farmsy`,
    })
    .eq('id', submissionId)

  return { ok: true, threadId }
}

// ─── composeNewMessage ────────────────────────────────────────────────────────
// Admin-initiated: creates a brand-new thread and sends an outbound email.
// Used by the Compose modal (v1: single recipient).

export async function composeNewMessage(opts: {
  toEmail: string
  toName: string
  toUserId?: string
  subject: string
  body: string
}): Promise<{ ok: boolean; threadId?: string; error?: string }> {
  const supabase = db()

  const { data: thread, error } = await supabase
    .from('message_threads')
    .insert({
      user_id: opts.toUserId ?? null,
      user_email: opts.toEmail,
      user_name: opts.toName,
      subject: opts.subject,
      last_message_at: new Date().toISOString(),
      last_message_preview: opts.body.slice(0, 100),
      unread_admin: 0,
      unread_user: 1,
    })
    .select('id')
    .single()

  if (error || !thread) return { ok: false, error: 'Failed to create thread' }

  let emailStatus: 'sent' | 'failed' | 'skipped' = 'skipped'
  try {
    await sendContactReply(opts.toEmail, { subject: opts.subject, body: opts.body })
    emailStatus = 'sent'
  } catch {
    emailStatus = 'failed'
  }

  await supabase.from('messages').insert({
    thread_id: thread.id,
    sender_type: 'admin',
    body: opts.body,
    source: 'in_app',
    email_status: emailStatus,
    is_read: true,
  })

  return { ok: true, threadId: thread.id }
}

// ─── markThreadRead ───────────────────────────────────────────────────────────
// Resets the admin unread counter on a thread to 0.

export async function markThreadRead(threadId: string): Promise<void> {
  await db()
    .from('message_threads')
    .update({ unread_admin: 0 })
    .eq('id', threadId)
}

// ─── archiveThread ────────────────────────────────────────────────────────────
// Soft-deletes a thread (hides it from inbox). Only works on threads, not raw
// submissions (submissions have no is_archived column).

export async function archiveThread(threadId: string): Promise<void> {
  await db()
    .from('message_threads')
    .update({ is_archived: true })
    .eq('id', threadId)
}

// ─── deleteSubmission ─────────────────────────────────────────────────────────
// Hard-deletes a contact_submission that hasn't been converted to a thread yet.

export async function deleteSubmission(submissionId: string): Promise<void> {
  await db()
    .from('contact_submissions')
    .delete()
    .eq('id', submissionId)
}

// ─── searchUsers ──────────────────────────────────────────────────────────────
// Powers the recipient autocomplete in the Compose modal.
// Returns up to 10 matching profiles by email or name.

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const { data } = await db()
    .from('profiles')
    .select('id, email, first_name, last_name, name')
    .or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
    .limit(10)

  return (data ?? []).map((u: any) => ({
    id: u.id,
    email: u.email ?? '',
    name:
      [u.first_name, u.last_name].filter(Boolean).join(' ') ||
      u.name ||
      u.email ||
      '',
  }))
}
