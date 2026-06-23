import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import ResetForm from './ResetForm'

export const dynamic = 'force-dynamic'

export default async function ResetPasswordPage({
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
    .select('reset_expires_at')
    .eq('reset_token', token)
    .single()

  if (!profile) redirect('/auth/signin?error=invalid-token')

  if (new Date(profile.reset_expires_at) < new Date()) {
    redirect('/auth/signin?error=token-expired')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--background)' }}>
      <ResetForm token={token} />
    </div>
  )
}
