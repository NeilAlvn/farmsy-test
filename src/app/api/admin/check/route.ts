import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { session_token } = await request.json().catch(() => ({})) as { session_token?: string }
  if (!session_token) return Response.json({ isAdmin: false })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: session } = await sb
    .from('active_sessions')
    .select('user_id')
    .eq('session_token', session_token)
    .single()

  if (!session?.user_id) return Response.json({ isAdmin: false })

  const { data: profile } = await sb
    .from('profiles')
    .select('role, email')
    .eq('id', session.user_id)
    .single()

  const isAdmin =
    profile?.role === 'admin' ||
    profile?.email === 'neilalvinmedallon@gmail.com'

  return Response.json({ isAdmin, userId: session.user_id })
}
