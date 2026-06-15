import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { session_token } = body
  if (!session_token) return Response.json({ error: 'session_token required' }, { status: 400 })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error } = await sb
    .from('active_sessions')
    .delete()
    .eq('session_token', session_token)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ success: true })
}
