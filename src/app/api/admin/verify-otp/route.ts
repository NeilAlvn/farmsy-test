import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

function sign(data: object): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64')
  const sig = createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!).update(payload).digest('hex')
  return `${payload}.${sig}`
}

export async function POST(request: Request) {
  const { session_token, code } = await request.json().catch(() => ({})) as {
    session_token?: string
    code?: string
  }
  if (!session_token) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (!code) return Response.json({ error: 'Please enter the 6-digit code.' }, { status: 400 })

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
    .select('role, otp_code, otp_expires_at')
    .eq('id', session.user_id)
    .single()

  if (profile?.role !== 'admin') return Response.json({ error: 'forbidden' }, { status: 403 })

  if (!profile.otp_code || !profile.otp_expires_at) {
    return Response.json({ error: 'Code expired, click resend', expired: true }, { status: 400 })
  }

  if (new Date(profile.otp_expires_at).getTime() < Date.now()) {
    // Clear stale code
    await sb.from('profiles').update({ otp_code: null, otp_expires_at: null }).eq('id', session.user_id)
    return Response.json({ error: 'Code expired, click resend', expired: true }, { status: 400 })
  }

  if (code.trim() !== profile.otp_code) {
    return Response.json({ error: 'Invalid code, try again' }, { status: 400 })
  }

  // Correct — clear the code and mark this session verified for 8h
  await sb.from('profiles').update({ otp_code: null, otp_expires_at: null }).eq('id', session.user_id)

  const verifiedToken = sign({ userId: session.user_id, expires: Date.now() + 8 * 60 * 60 * 1000 })
  const cookieStore = await cookies()
  cookieStore.set('admin_verified', verifiedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60,
    path: '/',
  })

  return Response.json({ ok: true })
}
