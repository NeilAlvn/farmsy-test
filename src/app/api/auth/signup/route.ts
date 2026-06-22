import { createClient } from '@supabase/supabase-js'
import { sendVerificationEmail } from '@/lib/email'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { email, password } = await request.json() as { email: string; password: string }

  if (!email || !password) {
    return Response.json({ error: 'Email and password are required.' }, { status: 400 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Create user via admin API — no Supabase email sent, no session returned
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) {
    if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already exists')) {
      return Response.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }
    return Response.json({ error: error.message }, { status: 400 })
  }

  // Generate a 32-byte hex token, expires in 24h
  const token   = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  await sb.from('profiles')
    .update({ verification_token: token, verification_expires_at: expires, email_verified: false })
    .eq('id', data.user.id)

  const APP_URL = 'https://farmsy.app'
  const verifyUrl = `${APP_URL}/auth/verify?token=${token}`

  await sendVerificationEmail(email, { confirmUrl: verifyUrl })

  return Response.json({ ok: true })
}
