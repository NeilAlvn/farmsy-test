import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { token, password } = await request.json() as { token: string; password: string }

  if (!token || !password) {
    return Response.json({ error: 'Missing token or password.' }, { status: 400 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: profile } = await sb
    .from('profiles')
    .select('id, reset_expires_at')
    .eq('reset_token', token)
    .single()

  if (!profile) {
    return Response.json({ error: 'invalid-token' }, { status: 400 })
  }

  if (new Date(profile.reset_expires_at) < new Date()) {
    return Response.json({ error: 'token-expired' }, { status: 400 })
  }

  // Set new password via admin API
  const { error: updateError } = await sb.auth.admin.updateUserById(profile.id, { password })
  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 })
  }

  // Clear reset token
  await sb.from('profiles').update({
    reset_token:      null,
    reset_expires_at: null,
  }).eq('id', profile.id)

  return Response.json({ ok: true })
}
