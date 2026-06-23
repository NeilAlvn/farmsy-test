import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

const TO = 'neilalvinmedallon@gmail.com'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function POST(request: Request) {
  const { name, email, topic, message, source } = await request.json() as {
    name: string
    email: string
    topic: string
    message: string
    source?: string
  }

  if (!name || !email || !message) {
    return Response.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Save to database
  await sb.from('contact_submissions').insert({
    name,
    email,
    topic:   topic   || 'general',
    message,
    source:  source  || 'contact_page',
  })

  // Send notification email
  await getResend().emails.send({
    from:    'Farmsy <noreply@mail.farmsy.app>',
    to:      TO,
    replyTo: email,
    subject: `[Farmsy Contact] ${topic ? `${topic} — ` : ''}from ${name}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:32px 16px;color:#1C1C1C;">
        <h2 style="margin:0 0 4px;font-size:20px;">New message from Farmsy</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#6B6B6B;">Via: ${source === 'widget' ? 'Feedback widget' : 'Contact page'}</p>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #E5E2DB;font-size:13px;color:#6B6B6B;width:100px;">Name</td>
            <td style="padding:10px 0;border-bottom:1px solid #E5E2DB;font-size:14px;font-weight:600;">${name}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #E5E2DB;font-size:13px;color:#6B6B6B;">Email</td>
            <td style="padding:10px 0;border-bottom:1px solid #E5E2DB;font-size:14px;"><a href="mailto:${email}" style="color:#3F5E3A;">${email}</a></td>
          </tr>
          ${topic ? `<tr>
            <td style="padding:10px 0;border-bottom:1px solid #E5E2DB;font-size:13px;color:#6B6B6B;">Topic</td>
            <td style="padding:10px 0;border-bottom:1px solid #E5E2DB;font-size:14px;">${topic}</td>
          </tr>` : ''}
        </table>

        <div style="background:#F5F3EE;border-radius:8px;padding:20px;margin-bottom:24px;">
          <p style="margin:0;font-size:14px;line-height:1.7;white-space:pre-wrap;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        </div>

        <p style="margin:0;font-size:12px;color:#6B6B6B;">
          Reply directly to this email to respond to ${name}.
        </p>
      </div>
    `,
  })

  return Response.json({ ok: true })
}
