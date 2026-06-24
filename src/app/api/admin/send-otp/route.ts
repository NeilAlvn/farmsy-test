import { createClient } from '@supabase/supabase-js'
import { sendAdminOtpEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { session_token } = await request.json().catch(() => ({})) as { session_token?: string }
  if (!session_token) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Resolve the user from the custom session token
  const { data: session } = await sb
    .from('active_sessions')
    .select('user_id')
    .eq('session_token', session_token)
    .single()

  if (!session?.user_id) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await sb
    .from('profiles')
    .select('role, email')
    .eq('id', session.user_id)
    .single()

  if (profile?.role !== 'admin' || !profile?.email) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  // Generate 6-digit code, store hashed-free (short-lived, single-use) with 10 min expiry
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error: updateErr } = await sb
    .from('profiles')
    .update({ otp_code: code, otp_expires_at: expiresAt })
    .eq('id', session.user_id)

  if (updateErr) return Response.json({ error: 'Could not generate code.' }, { status: 500 })

  await sendAdminOtpEmail(profile.email, { code })

  return Response.json({ ok: true })
}
