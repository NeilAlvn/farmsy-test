import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: { user }, error: authError } = await sb.auth.getUser(token)
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await sb
    .from('profiles')
    .select('subscription_status, subscription_plan, subscription_end_date, stripe_subscription_id, stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (error || !data) return Response.json({ error: 'Profile not found' }, { status: 404 })

  return Response.json(data)
}
