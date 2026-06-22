import { createClient } from '@supabase/supabase-js'
import { sendWinBackEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

// Vercel Cron calls this daily with the CRON_SECRET header.
export async function GET(request: Request) {
  const auth = request.headers.get('Authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Find users cancelled 3 days ago (±12h window) who haven't received the win-back yet
  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  const windowStart = new Date(threeDaysAgo.getTime() - 12 * 60 * 60 * 1000).toISOString()
  const windowEnd   = new Date(threeDaysAgo.getTime() + 12 * 60 * 60 * 1000).toISOString()

  const { data: users, error } = await sb
    .from('profiles')
    .select('id, email, cancelled_at')
    .eq('subscription_status', 'canceled')
    .eq('win_back_sent', false)
    .gte('cancelled_at', windowStart)
    .lte('cancelled_at', windowEnd)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!users?.length) return Response.json({ sent: 0 })

  let sent = 0
  for (const user of users) {
    if (!user.email) continue
    try {
      await sendWinBackEmail(user.email, {})
      await sb.from('profiles').update({ win_back_sent: true }).eq('id', user.id)
      sent++
    } catch {
      // Log and continue — don't fail the whole batch
    }
  }

  return Response.json({ sent })
}
