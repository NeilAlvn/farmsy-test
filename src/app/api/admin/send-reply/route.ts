import { createClient } from '@supabase/supabase-js'
import { sendContactReply } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    session_token?: string
    submission_id?: string
    to?: string
    subject?: string
    message?: string
  }

  const { session_token, submission_id, to, subject, message } = body

  if (!session_token) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (!to || !subject || !message || !submission_id) {
    return Response.json({ error: 'missing fields' }, { status: 400 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: session } = await sb
    .from('active_sessions')
    .select('user_id')
    .eq('session_token', session_token)
    .single()

  if (!session?.user_id) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', session.user_id)
    .single()

  if (profile?.role !== 'admin') return Response.json({ error: 'forbidden' }, { status: 403 })

  await sendContactReply(to, { subject, body: message })

  await sb
    .from('contact_submissions')
    .update({
      replied_at: new Date().toISOString(),
      reply_subject: subject,
      reply_message: message,
    })
    .eq('id', submission_id)

  return Response.json({ ok: true })
}
