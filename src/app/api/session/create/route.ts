import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { createNotification } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

function parseDeviceInfo(ua: string): string {
  const browser =
    /Edg\//.test(ua)    ? 'Edge' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Firefox\//.test(ua)? 'Firefox' :
    /Safari\//.test(ua) ? 'Safari' : 'Unknown browser'

  const os =
    /Windows/.test(ua) ? 'Windows' :
    /Mac OS X/.test(ua)? 'macOS' :
    /Android/.test(ua) ? 'Android' :
    /iPhone|iPad/.test(ua) ? 'iOS' :
    /Linux/.test(ua)   ? 'Linux' : 'Unknown OS'

  return `${browser} on ${os}`
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { user_id } = body
  if (!user_id) return Response.json({ error: 'user_id required' }, { status: 400 })

  const headersList = await headers()
  const ua         = headersList.get('user-agent') ?? ''
  const ip         =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    null

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Invalidate all existing sessions for this user
  await sb.from('active_sessions').delete().eq('user_id', user_id)

  const session_token = crypto.randomUUID()

  const { error } = await sb.from('active_sessions').insert({
    user_id,
    session_token,
    device_info: parseDeviceInfo(ua),
    ip_address:  ip,
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const device = parseDeviceInfo(ua)
  createNotification(
    user_id,
    'account_login',
    'New sign-in detected',
    `Signed in from ${device}${ip ? ` (${ip})` : ''}.`,
  ).catch(() => {})

  return Response.json({ session_token })
}
