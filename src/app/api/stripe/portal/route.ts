import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  const { userId } = await request.json() as { userId: string }

  if (!userId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: profile } = await sb
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  if (!profile?.stripe_customer_id) {
    return Response.json({ error: 'No active subscription' }, { status: 404 })
  }

  const origin = new URL(request.url).origin

  const session = await stripe.billingPortal.sessions.create({
    customer:   profile.stripe_customer_id,
    return_url: `${origin}/pricing`,
  })

  return Response.json({ url: session.url })
}
