import { createClient } from '@supabase/supabase-js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { email, source, consent } = body as Record<string, unknown>

  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return Response.json({ error: 'A valid email address is required.' }, { status: 400 })
  }

  if (!consent) {
    return Response.json({ error: 'Consent is required.' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const safeSource = typeof source === 'string' && source.trim() ? source.trim() : 'direct'

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    null
  const userAgent = request.headers.get('user-agent') || null

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error } = await supabase
    .from('email_subscribers')
    .insert({
      email: normalizedEmail,
      source: safeSource,
      ip_address: ip,
      user_agent: userAgent,
      consent_given: true,
    })

  if (error) {
    if (error.code === '23505') {
      return Response.json({ error: 'This email is already on the list.' }, { status: 409 })
    }
    console.error('[subscribe] Supabase error:', error.message)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }

  return Response.json({ success: true }, { status: 201 })
}
