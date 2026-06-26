'use server'

import { createClient } from '@supabase/supabase-js'
import { sendContactReply } from '@/lib/email'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface UserThread {
  id: string
  subject: string
  lastMessageAt: string
  preview: string
  unreadUser: number
}

export interface UserMessageRow {
  id: string
  threadId: string
  senderType: 'admin' | 'user'
  body: string
  createdAt: string
}

export async function getUserThreads(userId: string): Promise<UserThread[]> {
  const { data, error } = await db()
    .from('message_threads')
    .select('id, subject, last_message_at, last_message_preview, unread_user')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('last_message_at', { ascending: false })
    .limit(100)

  if (error) return []

  return (data ?? []).map((t: any) => ({
    id: t.id,
    subject: t.subject,
    lastMessageAt: t.last_message_at,
    preview: t.last_message_preview ?? '',
    unreadUser: (t.unread_user as number) ?? 0,
  }))
}

export async function getUserThreadMessages(threadId: string, userId: string): Promise<UserMessageRow[]> {
  const supabase = db()

  const { data: thread } = await supabase
    .from('message_threads')
    .select('id')
    .eq('id', threadId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!thread) return []

  const { data } = await supabase
    .from('messages')
    .select('id, thread_id, sender_type, body, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })

  return (data ?? []).map((m: any) => ({
    id: m.id,
    threadId: m.thread_id,
    senderType: m.sender_type as 'admin' | 'user',
    body: m.body,
    createdAt: m.created_at,
  }))
}

export async function markThreadReadByUser(threadId: string, userId: string): Promise<void> {
  await db()
    .from('message_threads')
    .update({ unread_user: 0 })
    .eq('id', threadId)
    .eq('user_id', userId)
}

export async function createUserThread(
  userId: string,
  userEmail: string,
  userName: string,
  subject: string,
  body: string,
): Promise<{ ok: boolean; thread?: UserThread; error?: string }> {
  const supabase = db()

  // Prefer the name stored in profiles over what auth metadata reports
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, name')
    .eq('id', userId)
    .maybeSingle()
  const resolvedName = profile
    ? ([profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.name || userName)
    : userName

  const { data: thread, error: threadErr } = await supabase
    .from('message_threads')
    .insert({
      user_id: userId,
      user_email: userEmail,
      user_name: resolvedName,
      subject,
      last_message_at: new Date().toISOString(),
      last_message_preview: body.slice(0, 100),
      unread_admin: 1,
      unread_user: 0,
      is_archived: false,
    })
    .select('id, subject, last_message_at, last_message_preview, unread_user')
    .single()

  if (threadErr || !thread) return { ok: false, error: 'Could not create thread' }

  await supabase.from('messages').insert({
    thread_id: thread.id,
    sender_type: 'user',
    body,
    source: 'in_app',
    email_status: 'skipped',
    is_read: false,
  })

  try {
    await sendContactReply('neilalvinmedallon@gmail.com', {
      subject: `New support message: ${subject} — Farmsy`,
      body: `New message from ${userEmail}:\n\n${body}`,
    })
  } catch { /* non-fatal */ }

  return {
    ok: true,
    thread: {
      id: thread.id,
      subject: thread.subject,
      lastMessageAt: thread.last_message_at,
      preview: body.slice(0, 100),
      unreadUser: 0,
    },
  }
}

export async function sendUserReply(
  threadId: string,
  userId: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()

  const { data: thread } = await supabase
    .from('message_threads')
    .select('id, subject, user_email, unread_admin')
    .eq('id', threadId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!thread) return { ok: false, error: 'Thread not found' }

  await supabase.from('messages').insert({
    thread_id: threadId,
    sender_type: 'user',
    body,
    source: 'in_app',
    email_status: 'skipped',
    is_read: false,
  })

  await supabase
    .from('message_threads')
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: body.slice(0, 100),
      unread_admin: ((thread.unread_admin as number) ?? 0) + 1,
    })
    .eq('id', threadId)

  // Notify admin via email
  try {
    await sendContactReply('neilalvinmedallon@gmail.com', {
      subject: `Re: ${thread.subject} — Farmsy`,
      body: `New in-app reply from ${thread.user_email}:\n\n${body}`,
    })
  } catch { /* non-fatal */ }

  return { ok: true }
}
