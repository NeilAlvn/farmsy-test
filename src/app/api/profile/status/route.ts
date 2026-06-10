import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Verify the JWT and get the user
  const { data: { user }, error: authError } = await sb.auth.getUser(token)
  if (authError || !user) return Response.json({ error: 'Invalid token' }, { status: 401 })

  // Service role bypasses RLS — reads the profile regardless of GRANT state
  const { data, error } = await sb
    .from('profiles')
    .select('subscription_status, subscription_end_date')
    .eq('id', user.id)
    .single()

  if (error || !data) return Response.json({ error: 'Profile not found' }, { status: 404 })

  return Response.json(data)
}
