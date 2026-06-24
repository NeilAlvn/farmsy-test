import { createHmac } from 'crypto'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

function sign(data: object): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64')
  const sig = createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!).update(payload).digest('hex')
  return `${payload}.${sig}`
}

function unsign(token: string): Record<string, unknown> | null {
  const dot = token.lastIndexOf('.')
  if (dot === -1) return null
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!).update(payload).digest('hex')
  if (sig !== expected) return null
  try {
    return JSON.parse(Buffer.from(payload, 'base64').toString())
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const { code } = await request.json().catch(() => ({})) as { code?: string }
  if (!code) return Response.json({ error: 'Code required.' }, { status: 400 })

  const cookieStore = await cookies()
  const pending = cookieStore.get('admin_otp_pending')?.value
  if (!pending) return Response.json({ error: 'No verification in progress. Please go back and try again.' }, { status: 400 })

  const data = unsign(pending)
  if (!data) return Response.json({ error: 'Invalid session. Please go back and try again.' }, { status: 400 })

  const { code: expected, userId, expires } = data as { code: string; userId: string; expires: number }

  if (Date.now() > expires) {
    cookieStore.delete('admin_otp_pending')
    return Response.json({ error: 'Code expired. Please go back to request a new one.' }, { status: 400 })
  }

  if (code.trim() !== expected) {
    return Response.json({ error: 'Incorrect code. Please try again.' }, { status: 400 })
  }

  cookieStore.delete('admin_otp_pending')

  const verifiedToken = sign({ userId, expires: Date.now() + 8 * 60 * 60 * 1000 })
  cookieStore.set('admin_verified', verifiedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60,
    path: '/',
  })

  return Response.json({ ok: true })
}
