import { createClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { session_token, user_id } = body
  if (!session_token || !user_id) {
    return Response.json({ valid: false }, { status: 400 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await sb
    .from('active_sessions')
    .select('id')
    .eq('session_token', session_token)
    .eq('user_id', user_id)
    .single()

  if (error || !data) {
    // Token is gone — another device logged in and wiped this session.
    // Create a notification so the user sees it in their inbox.
    createNotification(
      user_id,
      'session_kicked',
      'Signed out remotely',
      'Your account was signed in from another device, so this session was ended.',
    ).catch(() => {})
    return Response.json({ valid: false })
  }

  // Update last_active (fire and forget — don't block the response)
  sb.from('active_sessions')
    .update({ last_active: new Date().toISOString() })
    .eq('session_token', session_token)
    .then(() => {})

  return Response.json({ valid: true })
}
