import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function POST() {
  const cookieStore = await cookies()
  cookieStore.delete('admin_verified')
  cookieStore.delete('admin_otp_pending')
  return Response.json({ ok: true })
}
