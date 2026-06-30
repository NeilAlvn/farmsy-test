import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

export const dynamic = 'force-dynamic'

// Bulk contact fields (phone / website / address) for every published farm.
// These are the paywalled fields that get_farms_pins() omits. Subscribers
// prefetch this once so opening a farm is instant (as it was before gating);
// it is never served to non-subscribers.
const getAllContact = unstable_cache(
  async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const out: Array<Record<string, unknown>> = []
    const SIZE = 1000
    let from = 0
    // Supabase caps rows per query (~1000), so page through them.
    for (;;) {
      const { data, error } = await supabase
        .from('farms')
        .select('osm_id, phone, website, address, postal_code, country')
        .eq('is_published', true)
        .order('osm_id')
        .range(from, from + SIZE - 1)
      if (error || !data || data.length === 0) break
      out.push(...data)
      if (data.length < SIZE) break
      from += SIZE
    }
    return out
  },
  ['farms-contact'],
  { revalidate: 1800 },
)

function isPaid(status: string | null, endDate: string | null): boolean {
  if (status === 'active' || status === 'trialing') return true
  if (status === 'canceled' && endDate && new Date(endDate) > new Date()) return true
  return false
}

export async function GET(request: Request) {
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

  const data = await getAllContact()
  return Response.json(data)
}
