import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { email } = await request.json() as { email: string }
  if (!email) return Response.json({ verified: true })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: profile } = await sb
    .from('profiles')
    .select('email_verified')
    .eq('email', email)
    .single()

  // If no profile found, let signIn proceed (it will fail with wrong credentials)
  if (!profile) return Response.json({ verified: true })

  return Response.json({ verified: profile.email_verified ?? false })
}
