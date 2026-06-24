import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

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
  const { session_token } = await request.json().catch(() => ({})) as { session_token?: string }
  if (!session_token) return Response.json({ isAdmin: false, otpVerified: false })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: session } = await sb
    .from('active_sessions')
    .select('user_id')
    .eq('session_token', session_token)
    .single()

  if (!session?.user_id) return Response.json({ isAdmin: false, otpVerified: false })

  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', session.user_id)
    .single()

  if (profile?.role !== 'admin') return Response.json({ isAdmin: false, otpVerified: false })

  const cookieStore = await cookies()
  const verifiedCookie = cookieStore.get('admin_verified')?.value
  let otpVerified = false

  if (verifiedCookie) {
    const data = unsign(verifiedCookie)
    if (data) {
      const { userId, expires } = data as { userId: string; expires: number }
      otpVerified = userId === session.user_id && Date.now() < expires
    }
  }

  return Response.json({ isAdmin: true, otpVerified, userId: session.user_id })
}
