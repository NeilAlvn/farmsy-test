import { createClient } from '@supabase/supabase-js'
import { sendPasswordResetEmail } from '@/lib/email'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { email } = await request.json() as { email: string }

  // Always return ok — prevents user enumeration
  if (!email) return Response.json({ ok: true })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: profile } = await sb
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  // Silently succeed if no account found
  if (!profile) return Response.json({ ok: true })

  const token   = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

  await sb.from('profiles').update({
    reset_token:      token,
    reset_expires_at: expires,
  }).eq('id', profile.id)

  const APP_URL = 'https://farmsy.app'
  await sendPasswordResetEmail(email, { resetUrl: `${APP_URL}/auth/reset-password?token=${token}` })

  return Response.json({ ok: true })
}
