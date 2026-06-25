import { createClient } from '@supabase/supabase-js'
import { sendVerificationEmail } from '@/lib/email'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const {
    email, password,
    firstName, lastName, dob,
    streetAddress, city, postalCode, country,
    refCode,
  } = await request.json() as {
    email: string
    password: string
    firstName?: string
    lastName?: string
    dob?: string
    streetAddress?: string
    city?: string
    postalCode?: string
    country?: string
    refCode?: string
  }

  if (!email || !password) {
    return Response.json({ error: 'Email and password are required.' }, { status: 400 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) {
    if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already exists')) {
      return Response.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }
    return Response.json({ error: error.message }, { status: 400 })
  }

  const token   = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  await sb.from('profiles').update({
    email_verified:          false,
    verification_token:      token,
    verification_expires_at: expires,
    ...(firstName        ? { first_name: firstName }         : {}),
    ...(lastName         ? { last_name: lastName }           : {}),
    ...(dob              ? { date_of_birth: dob }            : {}),
    ...(streetAddress    ? { street_address: streetAddress } : {}),
    ...(city             ? { city }                          : {}),
    ...(postalCode       ? { postal_code: postalCode }       : {}),
    ...(country          ? { country }                       : {}),
  }).eq('id', data.user.id)

  const APP_URL = 'https://farmsy.app'
  await sendVerificationEmail(email, { confirmUrl: `${APP_URL}/auth/verify?token=${token}` })

  // Referral tracking — link new user to referrer if a valid ref code was supplied
  if (refCode && data.user?.id) {
    const code = refCode.toUpperCase()
    const { data: referrer } = await sb
      .from('profiles')
      .select('id')
      .eq('referral_code', code)
      .neq('id', data.user.id)  // cannot refer yourself
      .maybeSingle()

    if (referrer) {
      await sb.from('profiles')
        .update({ referred_by: referrer.id })
        .eq('id', data.user.id)

      await sb.from('referrals').insert({
        referrer_id:   referrer.id,
        referee_id:    data.user.id,
        referral_code: code,
        status:        'pending',
      })
      // ignore unique-constraint error (idempotent — can't be referred twice)
    }
  }

  return Response.json({ ok: true })
}
