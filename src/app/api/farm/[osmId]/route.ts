import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

export const dynamic = 'force-dynamic'

// Full farm detail — phone, website, address, hours and the enrichment fields.
// This is the paywalled payload: get_farms_pins() deliberately omits all of it,
// so it is only ever served here, and only to a verified subscriber.
const getFarmDetail = unstable_cache(
  async (osmId: string) => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data, error } = await supabase
      .from('farms')
      .select('osm_id, phone, website, address, postal_code, country, opening_hours, image, description, email, facebook, instagram, organic, produce, operator')
      .eq('osm_id', osmId)
      .eq('is_published', true)
      .single()

    if (error || !data) return null
    return data
  },
  ['farm-detail'],
  { revalidate: 1800 },
)

function isPaid(status: string | null, endDate: string | null): boolean {
  if (status === 'active' || status === 'trialing') return true
  // A cancelled subscription still has access until the paid period ends.
  if (status === 'canceled' && endDate && new Date(endDate) > new Date()) return true
  return false
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ osmId: string }> }
) {
  const { osmId } = await params

  // ── Subscriber gate ─────────────────────────────────────────────────────────
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return Response.json({ error: 'Subscription required' }, { status: 401 })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: { user }, error: authError } = await sb.auth.getUser(token)
  if (authError || !user) return Response.json({ error: 'Invalid token' }, { status: 401 })

  const { data: profile } = await sb
    .from('profiles')
    .select('subscription_status, subscription_end_date')
    .eq('id', user.id)
    .single()

  if (!isPaid(profile?.subscription_status ?? null, profile?.subscription_end_date ?? null)) {
    return Response.json({ error: 'Subscription required' }, { status: 403 })
  }

  const data = await getFarmDetail(osmId)
  if (!data) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json(data)
}
