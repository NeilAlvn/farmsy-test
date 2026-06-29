import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

const FROM    = 'Farmsy <noreply@mail.farmsy.app>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.replace('localhost:3000', 'farmsy.app') ?? 'https://farmsy.app'

// ─── Tokens ───────────────────────────────────────────────────────────────────
const BG      = '#F4F4F0'
const WHITE   = '#FFFFFF'
const GREEN   = '#3F5E3A'
const TEXT    = '#111827'
const MUTED   = '#6B7280'
const BORDER  = '#E5E7EB'
const LIGHT   = '#F9F9F7'

function now(): string {
  return new Date().toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Amsterdam',
  }) + ' CET'
}

// ─── Shell ────────────────────────────────────────────────────────────────────
// Clean card on warm gray — matches leemunroe/htmlemail pattern but with
// Farmsy brand tones.

function shell(body: string, preheader = ''): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html;charset=UTF-8">
  <title>Farmsy</title>
  <style>
    body{margin:0;padding:0;background:${BG};-webkit-font-smoothing:antialiased;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%;}
    table{border-collapse:separate;mso-table-lspace:0;mso-table-rspace:0;width:100%;}
    table td{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;vertical-align:top;}
    p{margin:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;font-weight:normal;line-height:1.65;color:${TEXT};}
    a{color:${GREEN};text-decoration:underline;}
    @media only screen and (max-width:640px){
      .card{border-radius:0!important;border-left:none!important;border-right:none!important;}
      .pad{padding:28px 24px!important;}
      .container{width:100%!important;padding-top:0!important;}
    }
  </style>
</head>
<body>
  ${preheader ? `<span style="display:none;max-height:0;overflow:hidden;color:transparent;font-size:1px;">${preheader}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</span>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table role="presentation" class="container" cellpadding="0" cellspacing="0" style="max-width:600px;width:600px;padding-top:0;">
          <tr>
            <td class="card" style="background:${WHITE};border:1px solid ${BORDER};border-radius:10px;overflow:hidden;">

              <!-- Logo bar -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:28px 40px;border-bottom:1px solid ${BORDER};">
                    <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-style:italic;font-weight:700;color:${GREEN};letter-spacing:-0.5px;">Farmsy</span>
                  </td>
                </tr>
              </table>

              <!-- Body -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="pad" style="padding:40px;">
                    ${body}
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;color:${MUTED};">Farmsy · Local farms across the Netherlands &amp; Belgium</p>
              <p style="margin:0;font-size:13px;color:${MUTED};">
                <a href="${APP_URL}/contact" style="color:${MUTED};text-decoration:underline;">Contact us</a>
                &nbsp;&middot;&nbsp;
                <a href="${APP_URL}/account/subscription" style="color:${MUTED};text-decoration:underline;">Manage subscription</a>
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── Reusable blocks ──────────────────────────────────────────────────────────

function btn(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
    <tr>
      <td style="border-radius:6px;background:${GREEN};">
        <a href="${href}" target="_blank"
          style="display:inline-block;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:6px;letter-spacing:0.01em;"
        >${label}</a>
      </td>
    </tr>
  </table>`
}

function divider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
    <tr><td style="height:1px;background:${BORDER};font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>`
}

function meta(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:1px solid ${BORDER};padding-top:20px;">
    ${rows.map(([label, value]) => `
      <tr>
        <td width="130" style="padding-bottom:8px;font-size:13px;color:${MUTED};vertical-align:top;">${label}</td>
        <td style="padding-bottom:8px;font-size:13px;color:${TEXT};font-weight:500;">${value}</td>
      </tr>`).join('')}
  </table>`
}

function note(text: string): string {
  return `<p style="margin:20px 0 0;font-size:13px;color:${MUTED};line-height:1.6;">${text}</p>`
}

function h1(text: string): string {
  return `<p style="margin:0 0 20px;font-size:24px;font-weight:700;color:${TEXT};line-height:1.25;letter-spacing:-0.3px;">${text}</p>`
}

function label(text: string): string {
  return `<p style="margin:0 0 10px;font-size:12px;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:0.1em;">${text}</p>`
}


// ─── 0. Email Verification ────────────────────────────────────────────────────
export async function sendVerificationEmail(to: string, opts: { confirmUrl: string }) {
  const html = shell(`
    ${label('Verify your account')}
    ${h1('Confirm your email address')}

    <p>Someone (hopefully you) created a Farmsy account using this email address. Click the button below to confirm it's you and activate your account.</p>
    <p>Once verified, you'll have instant access to <strong>12,000+ local farms</strong> across the Netherlands and Belgium.</p>

    ${btn('Confirm email address', opts.confirmUrl)}

    ${divider()}

    ${meta([
      ['Sent',       now()],
      ['Expires',    '24 hours after this email was sent'],
    ])}

    ${note('If you didn\'t create a Farmsy account, you can safely ignore this email. Nothing will happen.<br><br>Button not working? <a href="' + opts.confirmUrl + '" style="color:' + GREEN + ';word-break:break-all;">' + opts.confirmUrl + '</a>')}
  `, 'Confirm your email to activate your Farmsy account.')

  return getResend().emails.send({ from: FROM, to, subject: 'Please confirm your email — Farmsy', html })
}


// ─── 1. Welcome / Trial Started ───────────────────────────────────────────────
export async function sendWelcomeEmail(to: string) {
  const html = shell(`
    ${label('Welcome')}
    ${h1('Your free trial has started')}

    <p>Welcome to Farmsy! You now have <strong>3 days of full access</strong> to the platform — 12,000+ local farms across the Netherlands and Belgium.</p>

    <p>Here's what you can do right now:</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      ${[
        ['🗺️', 'Browse the interactive farm map and filter by product type'],
        ['❤️', 'Save your favourite farms and come back to them anytime'],
        ['📍', 'Plan routes to visit multiple farms in one trip'],
        ['🔔', 'Get notified when new farms open near you'],
      ].map(([icon, text]) => `
        <tr>
          <td width="28" style="padding-bottom:12px;font-size:18px;vertical-align:top;">${icon}</td>
          <td style="padding-bottom:12px;font-size:15px;color:${TEXT};line-height:1.6;vertical-align:top;">${text}</td>
        </tr>`).join('')}
    </table>

    ${btn('Start exploring farms', `${APP_URL}/map`)}

    ${divider()}

    ${meta([
      ['Trial started',  now()],
      ['Trial length',   '3 days'],
      ['After trial',    '€29.99 / year — cancel anytime before your trial ends'],
    ])}

    ${note('To cancel your trial before being charged, go to <a href="' + APP_URL + '/account/subscription">Account → Subscription</a>.')}
  `)

  return getResend().emails.send({ from: FROM, to, subject: 'Welcome to Farmsy — your trial has started!', html })
}


// ─── 2. Payment Confirmation ──────────────────────────────────────────────────
export async function sendPaymentConfirmationEmail(to: string, opts: {
  plan: 'yearly' | 'lifetime'
  amount: string
  nextBillingDate?: string
}) {
  const isLifetime = opts.plan === 'lifetime'

  const html = shell(`
    ${label('Payment confirmed')}
    ${h1(isLifetime ? 'Lifetime access activated!' : 'You\'re all set!')}

    <p>Your payment was successful. Your Farmsy ${isLifetime ? '<strong>Lifetime</strong>' : '<strong>Yearly</strong>'} plan is now active and you have full access to every farm on the platform.</p>

    <!-- Receipt -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:${LIGHT};border:1px solid ${BORDER};border-radius:8px;">
      <tr>
        <td style="padding:20px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:15px;color:${TEXT};padding-bottom:12px;">${isLifetime ? 'Farmsy Lifetime Access' : 'Farmsy Yearly Plan'}</td>
              <td align="right" style="font-size:15px;color:${TEXT};padding-bottom:12px;">${opts.amount}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding-bottom:12px;"><div style="height:1px;background:${BORDER};"></div></td>
            </tr>
            <tr>
              <td style="font-size:15px;font-weight:700;color:${TEXT};">Total</td>
              <td align="right" style="font-size:16px;font-weight:700;color:${GREEN};">${opts.amount}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${btn('Explore farms', `${APP_URL}/map`)}

    ${divider()}

    ${meta([
      ['Paid on',       now()],
      ['Plan',          isLifetime ? 'Lifetime (one payment, access forever)' : 'Yearly'],
      ...(!isLifetime && opts.nextBillingDate ? [['Next renewal', opts.nextBillingDate] as [string,string]] : []),
    ])}

    ${isLifetime ? note('🌱 Lifetime access means no renewals and no future charges — ever.') : note('You can manage or cancel your subscription anytime from <a href="' + APP_URL + '/account/subscription">your account</a>.')}
  `)

  return getResend().emails.send({
    from: FROM, to,
    subject: isLifetime ? 'Payment confirmed — Farmsy Lifetime is yours!' : 'Payment confirmed — Welcome to Farmsy!',
    html,
  })
}


// ─── 3. Trial Ending Reminder ─────────────────────────────────────────────────
export async function sendTrialEndingEmail(to: string, opts: { endDate: string }) {
  const html = shell(`
    ${label('Your trial is ending')}
    ${h1('One day left on your free trial')}

    <p>Your Farmsy trial ends on <strong>${opts.endDate}</strong>. After that, your account will be charged <strong>€29.99</strong> for a full year of access — unless you cancel before then.</p>

    <p>With a yearly plan you keep:</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
      ${[
        'Full access to 12,000+ farms across NL & BE',
        'Interactive map, routing, and farm filters',
        'Favourites, trip planning, and new farm alerts',
      ].map(item => `
        <tr>
          <td width="20" style="padding-bottom:10px;color:${GREEN};font-weight:700;font-size:15px;vertical-align:top;">✓</td>
          <td style="padding-bottom:10px;font-size:15px;color:${TEXT};line-height:1.5;">${item}</td>
        </tr>`).join('')}
    </table>

    ${btn('Keep my access', `${APP_URL}/map`)}

    ${divider()}

    ${meta([
      ['Trial ends',    opts.endDate],
      ['Charge amount', '€29.99 / year (if not cancelled)'],
    ])}

    ${note('Don\'t want to continue? <a href="' + APP_URL + '/account/subscription">Cancel before ' + opts.endDate + '</a> and you won\'t be charged.')}
  `)

  return getResend().emails.send({ from: FROM, to, subject: 'Your Farmsy trial ends tomorrow', html })
}


// ─── 4. Win-back ─────────────────────────────────────────────────────────────
export async function sendWinBackEmail(to: string, opts: { discountCode?: string }) {
  const code = opts.discountCode ?? 'COMEBACK20'

  const html = shell(`
    ${label('A special offer for you')}
    ${h1('We\'d love to have you back')}

    <p>It's been a while. As a thank-you for trying Farmsy, here's a personal <strong>20% discount</strong> on your first year back — that's <strong>€23.99</strong> instead of €29.99.</p>

    <!-- Discount code -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="padding:24px;background:${LIGHT};border:1px dashed #C5BFB4;border-radius:8px;text-align:center;">
          ${label('Your discount code')}
          <p style="margin:4px 0 6px;font-family:monospace;font-size:30px;font-weight:700;color:${GREEN};letter-spacing:0.2em;">${code}</p>
          <p style="margin:0;font-size:13px;color:${MUTED};">20% off · Valid for 7 days</p>
        </td>
      </tr>
    </table>

    <p>Farmsy gives you access to 12,000+ local farms — fresh eggs, vegetables, dairy, flowers, and more from farmers near you.</p>

    ${btn('Claim your discount', `${APP_URL}/?coupon=${code}#pricing`)}

    ${divider()}

    ${meta([
      ['Discount',   '20% off — €23.99 instead of €29.99'],
      ['Code',       code],
      ['Valid for',  '7 days'],
    ])}

    ${note('Not interested? <a href="' + APP_URL + '/contact">Let us know how we can improve</a> — we read every reply.')}
  `)

  return getResend().emails.send({ from: FROM, to, subject: "We'd love to have you back 🌱", html })
}


// ─── 5. Admin OTP ─────────────────────────────────────────────────────────────
export async function sendAdminOtpEmail(to: string, opts: { code: string }) {
  const html = shell(`
    ${label('Admin · Two-factor verification')}
    ${h1('Your sign-in code')}

    <p>Enter this code on the Farmsy admin dashboard to complete sign-in. It expires in <strong>10 minutes</strong> and can only be used once.</p>

    <!-- Code box -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td align="center" style="padding:28px 24px;background:${LIGHT};border:1px solid ${BORDER};border-radius:8px;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:0.12em;">6-digit code</p>
          <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:48px;font-weight:700;color:${GREEN};letter-spacing:0.35em;line-height:1;">${opts.code}</p>
        </td>
      </tr>
    </table>

    ${divider()}

    ${meta([
      ['Requested', now()],
      ['Expires',   '10 minutes after this email was sent'],
      ['Use only on', 'farmsy.app/admin'],
    ])}

    ${note('<strong>Security:</strong> Never share this code with anyone. Farmsy staff will never ask for it. If you didn\'t request this, someone may be trying to access the admin dashboard — change your password immediately.')}
  `, 'Your Farmsy admin verification code — expires in 10 minutes.')

  return getResend().emails.send({ from: FROM, to, subject: 'Your admin sign-in code — Farmsy', html })
}


// ─── 6. Contact Reply ─────────────────────────────────────────────────────────
export async function sendContactReply(to: string, opts: { subject: string; body: string }) {
  const isAdminNotification = to === 'neilalvinmedallon@gmail.com'
  const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

  if (isAdminNotification) {
    // Internal notification to admin — plain, readable
    const bodyLines = opts.body.split('\n').map(line =>
      line.trim()
        ? `<p style="margin:0 0 12px;font-size:15px;color:${TEXT};line-height:1.65;">${esc(line)}</p>`
        : `<p style="margin:0 0 12px;">&nbsp;</p>`
    ).join('')

    const html = shell(`
      ${label('New message from a user')}
      <p style="margin:0 0 6px;font-size:13px;color:${MUTED};">Subject</p>
      <p style="margin:0 0 24px;font-size:18px;font-weight:600;color:${TEXT};">${esc(opts.subject)}</p>
      ${bodyLines}
      ${btn('View in admin', `${APP_URL}/admin/contact`)}
      ${meta([['Received', now()]])}
    `)

    return getResend().emails.send({ from: FROM, to, subject: opts.subject, html })
  }

  // User-facing reply from Farmsy Support
  const bodyLines = opts.body.split('\n').map(line =>
    line.trim()
      ? `<p style="margin:0 0 16px;font-size:15px;color:${TEXT};line-height:1.75;">${esc(line)}</p>`
      : `<p style="margin:0 0 16px;">&nbsp;</p>`
  ).join('')

  const html = shell(`
    ${label('Message from Farmsy Support')}
    <p style="margin:0 0 6px;font-size:13px;color:${MUTED};">Subject</p>
    <p style="margin:0 0 28px;font-size:20px;font-weight:600;color:${TEXT};line-height:1.3;">${esc(opts.subject)}</p>

    ${bodyLines}

    ${btn('Reply on Farmsy', `${APP_URL}/messages`)}

    ${divider()}

    ${meta([
      ['From',    'Farmsy Support Team'],
      ['Sent',    now()],
    ])}

    ${note('This is an official message from the Farmsy team. If you have concerns, contact us at <a href="' + APP_URL + '/contact">farmsy.app/contact</a>.')}
  `)

  return getResend().emails.send({ from: FROM, to, subject: opts.subject, html })
}


// ─── 7. Password Reset ────────────────────────────────────────────────────────
export async function sendPasswordResetEmail(to: string, opts: { resetUrl: string }) {
  const html = shell(`
    ${label('Password reset')}
    ${h1('Reset your password')}

    <p>We received a request to reset the password for your Farmsy account. Click the button below to choose a new password. This link can only be used once.</p>

    ${btn('Reset my password', opts.resetUrl)}

    ${divider()}

    ${meta([
      ['Requested', now()],
      ['Expires',   '1 hour after this email was sent'],
    ])}

    ${note('If you didn\'t request a password reset, you can safely ignore this email — your password won\'t change.<br><br>Button not working? <a href="' + opts.resetUrl + '" style="color:' + GREEN + ';word-break:break-all;">' + opts.resetUrl + '</a>')}
  `, 'Reset your Farmsy password — link expires in 1 hour.')

  return getResend().emails.send({ from: FROM, to, subject: 'Reset your Farmsy password', html })
}
