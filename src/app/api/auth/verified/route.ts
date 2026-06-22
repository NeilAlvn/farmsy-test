import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return Response.json({ verified: false })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: { user }, error: userError } = await sb.auth.getUser(token)
  if (userError || !user) return Response.json({ verified: false })

  const { data: profile } = await sb
    .from('profiles')
    .select('email_verified')
    .eq('id', user.id)
    .single()

  return Response.json({ verified: profile?.email_verified ?? false })
}
