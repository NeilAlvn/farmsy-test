import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getUser(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const client = sb()
  const { data: { user } } = await client.auth.getUser(token)
  return user ?? null
}

// GET /api/notifications — fetch last 50 for current user
export async function GET(request: Request) {
  const user = await getUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await sb()
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

// PATCH /api/notifications — mark as read
// body: { all: true } OR { ids: string[] }
export async function PATCH(request: Request) {
  const user = await getUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const client = sb()

  if (body.all) {
    const { error } = await client
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  } else if (Array.isArray(body.ids) && body.ids.length > 0) {
    const { error } = await client
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .in('id', body.ids)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
