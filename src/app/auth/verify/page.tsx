import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) redirect('/auth/signin?error=invalid-token')

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: profile } = await sb
    .from('profiles')
    .select('id, verification_expires_at')
    .eq('verification_token', token)
    .single()

  if (!profile) redirect('/auth/signin?error=invalid-token')

  if (new Date(profile.verification_expires_at) < new Date()) {
    redirect('/auth/signin?error=token-expired')
  }

  await sb.from('profiles').update({
    email_verified:          true,
    verification_token:      null,
    verification_expires_at: null,
  }).eq('id', profile.id)

  redirect('/auth/signin?verified=true')
}
