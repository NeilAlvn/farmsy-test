import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

const getFarmDetail = unstable_cache(
  async (osmId: string) => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data, error } = await supabase
      .from('farms')
      .select('osm_id, description, email, facebook, instagram, organic, produce, operator')
      .eq('osm_id', osmId)
      .eq('is_published', true)
      .single()

    if (error || !data) return null
    return data
  },
  ['farm-detail'],
  { revalidate: 1800 },
)

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ osmId: string }> }
) {
  const { osmId } = await params
  const data = await getFarmDetail(osmId)

  if (!data) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json(data)
}
