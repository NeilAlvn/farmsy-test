import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'
import { cookies } from 'next/headers'
import { sendAdminOtpEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

function sign(data: object): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64')
  const sig = createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!).update(payload).digest('hex')
  return `${payload}.${sig}`
}

export async function POST(request: Request) {
  const { session_token } = await request.json().catch(() => ({})) as { session_token?: string }
  if (!session_token) return Response.json({ error: 'unauthorized' }, { status: 401 })

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
    .select('role, email')
    .eq('id', session.user_id)
    .single()

  const isAdmin = profile?.role === 'admin' || profile?.email === 'neilalvinmedallon@gmail.com'
  if (!isAdmin || !profile?.email) return Response.json({ error: 'forbidden' }, { status: 403 })

  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expires = Date.now() + 10 * 60 * 1000

  const token = sign({ code, userId: session.user_id, expires })
  const cookieStore = await cookies()
  cookieStore.set('admin_otp_pending', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  await sendAdminOtpEmail(profile.email, { code })

  return Response.json({ ok: true })
}
