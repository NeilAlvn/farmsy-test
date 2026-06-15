import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
) {
  await sb().from('notifications').insert({ user_id: userId, type, title, message })
}
