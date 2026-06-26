import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

const FROM    = 'Farmsy <noreply@mail.farmsy.app>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.replace('localhost:3000', 'farmsy.app') ?? 'https://farmsy.app'

// ─── Design tokens ────────────────────────────────────────────────────────────
const CREAM  = '#F5F3EE'
const GREEN  = '#3F5E3A'
const WHITE  = '#FFFFFF'
const TEXT   = '#1C1C1C'
const MUTED  = '#6B6B6B'
const BORDER = '#E5E2DB'
const AMBER  = '#FFF8E7'
const AMBER_BORDER = '#F0E9D2'
const AMBER_TEXT   = '#92621A'
const RED    = '#FFF2F2'
const RED_BORDER   = '#FFC5C5'
const RED_TEXT     = '#B91C1C'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowFormatted(): string {
  return new Date().toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Amsterdam',
  }) + ' CET'
}

function base(content: string, preheader = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Farmsy</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;1,400&display=swap');
    body { margin:0; padding:0; background:${CREAM}; }
    * { box-sizing:border-box; }
  </style>
</head>
<body style="margin:0;padding:0;background:${CREAM};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Card -->
          <tr>
            <td style="background:${WHITE};border-radius:12px;border:1px solid ${BORDER};overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.07);">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 0 0;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:${MUTED};">Farmsy · Discover local farms across the Netherlands &amp; Belgium</p>
              <p style="margin:0;font-size:12px;color:${MUTED};">
                Questions? <a href="${APP_URL}/contact" style="color:${MUTED};text-decoration:underline;">farmsy.app/contact</a>
                &nbsp;·&nbsp;
                <a href="${APP_URL}/account/subscription" style="color:${MUTED};text-decoration:underline;">Manage account</a>
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

function logo(): string {
  return `<table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="background:${GREEN};padding:32px;text-align:center;">
        <span style="font-family:'Fraunces',Georgia,serif;font-size:28px;font-style:italic;font-weight:600;color:${WHITE};letter-spacing:-0.5px;">Farmsy</span>
      </td>
    </tr>
  </table>`
}

function cta(label: string, href: string): string {
  return `<a href="${href}"
    style="display:inline-block;background:${GREEN};color:${WHITE};text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:8px;letter-spacing:0.01em;"
  >${label} →</a>`
}

function divider(): string {
  return `<tr><td style="padding:0 32px;"><div style="height:1px;background:${BORDER};"></div></td></tr>`
}

function metaBox(rows: { label: string; value: string }[]): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:10px;border:1px solid ${BORDER};margin:20px 0;">
    <tr>
      <td style="padding:16px 20px;">
        ${rows.map(r => `
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:${rows.indexOf(r) === rows.length - 1 ? '0' : '8px'};">
            <tr>
              <td width="100" style="font-size:13px;color:${MUTED};font-weight:500;">${r.label}</td>
              <td style="font-size:13px;color:${TEXT};font-weight:600;">${r.value}</td>
            </tr>
          </table>`).join('')}
      </td>
    </tr>
  </table>`
}

function securityNote(lines: string[]): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${RED};border-radius:10px;border:1px solid ${RED_BORDER};margin-top:20px;">
    <tr>
      <td style="padding:16px 20px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${RED_TEXT};">Security notice</p>
        ${lines.map(l => `<p style="margin:0 0 4px;font-size:13px;color:${RED_TEXT};line-height:1.5;">${l}</p>`).join('')}
      </td>
    </tr>
  </table>`
}

function infoNote(text: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:10px;border:1px solid ${BORDER};margin-top:16px;">
    <tr>
      <td style="padding:14px 18px;">
        <p style="margin:0;font-size:13px;color:${MUTED};line-height:1.6;">${text}</p>
      </td>
    </tr>
  </table>`
}


// ─── 0. Email Verification ────────────────────────────────────────────────────
export async function sendVerificationEmail(to: string, opts: { confirmUrl: string }) {
  const html = base(`
    ${logo()}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:36px 36px 32px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:${GREEN};text-transform:uppercase;letter-spacing:0.12em;">Email Verification</p>
          <h1 style="margin:0 0 14px;font-family:'Fraunces',Georgia,serif;font-size:26px;font-weight:600;color:${TEXT};line-height:1.25;">Confirm your email address</h1>
          <p style="margin:0 0 20px;font-size:15px;color:${TEXT};line-height:1.7;">
            You've just created a <strong>Farmsy account</strong> using this email address.
            Click the button below to confirm this is you and activate your account.
          </p>
          <p style="margin:0 0 28px;font-size:15px;color:${MUTED};line-height:1.7;">
            Once confirmed, you'll have instant access to <strong>12,717+ local farms</strong> across the Netherlands and Belgium — fresh produce, dairy, eggs, flowers, and more from farmers near you.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:28px;">
            ${cta('Confirm my email address', opts.confirmUrl)}
          </td></tr></table>

          ${metaBox([
            { label: 'Requested at', value: nowFormatted() },
            { label: 'Valid for',    value: '24 hours' },
          ])}

          ${infoNote('Having trouble clicking the button? Copy and paste this link into your browser: <a href="' + opts.confirmUrl + '" style="color:' + GREEN + ';word-break:break-all;text-decoration:none;font-size:12px;">' + opts.confirmUrl + '</a>')}

          ${securityNote([
            "If you didn't create a Farmsy account, you can safely ignore this email — nothing will happen.",
            'Never share this link with anyone. It gives direct access to your account.',
          ])}
        </td>
      </tr>
    </table>
  `, 'Confirm your email to activate your Farmsy account.')

  return getResend().emails.send({ from: FROM, to, subject: 'Confirm your email — Farmsy', html })
}


// ─── 1. Welcome / Trial Started ───────────────────────────────────────────────
export async function sendWelcomeEmail(to: string) {
  const html = base(`
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:${GREEN};padding:36px 32px 32px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:rgba(255,255,255,0.65);text-transform:uppercase;letter-spacing:0.12em;">Free Trial Started</p>
          <h1 style="margin:0 0 8px;font-family:'Fraunces',Georgia,serif;font-size:30px;font-weight:600;color:${WHITE};line-height:1.2;">Welcome to Farmsy!</h1>
          <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.85);line-height:1.5;">Your <strong style="color:${WHITE};">3-day free trial</strong> is now active.</p>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:32px 36px 8px;">
          <p style="margin:0 0 18px;font-size:15px;color:${TEXT};line-height:1.7;">
            You now have <strong>full access</strong> to 12,717+ farms across the Netherlands and Belgium.
            Explore fresh produce, dairy, eggs, flowers, and more — sourced directly from local farmers in your area.
          </p>

          <!-- Feature list -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:12px;border:1px solid ${BORDER};margin-bottom:24px;">
            <tr>
              <td style="padding:20px 24px;">
                <p style="margin:0 0 14px;font-size:12px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.1em;">What you can do right now</p>
                ${[
                  ['🗺️', 'Browse the interactive farm map and filter by product type'],
                  ['❤️', 'Save your favourite farms to your personal list'],
                  ['📍', 'Plan efficient routes to visit multiple farms in one trip'],
                  ['🔔', 'Get notified when new farms open near you'],
                ].map(([icon, text]) => `
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                    <tr>
                      <td width="28" style="font-size:18px;vertical-align:top;padding-top:1px;">${icon}</td>
                      <td style="font-size:14px;color:${TEXT};line-height:1.5;">${text}</td>
                    </tr>
                  </table>`).join('')}
              </td>
            </tr>
          </table>

          ${metaBox([
            { label: 'Trial started',  value: nowFormatted() },
            { label: 'Trial ends',     value: '3 days from now' },
            { label: 'After trial',    value: '€29.99 / year (cancel anytime before)' },
          ])}

          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 0;">
            ${cta('Start Exploring Farms', `${APP_URL}/map`)}
          </td></tr></table>

          ${infoNote('You can cancel your trial at any time before it ends from your <a href="' + APP_URL + '/account/subscription" style="color:' + GREEN + ';text-decoration:underline;">account settings</a> — no charge will be applied.')}
        </td>
      </tr>
    </table>
  `)

  return getResend().emails.send({ from: FROM, to, subject: 'Welcome to Farmsy — your free trial has started!', html })
}


// ─── 2. Payment Confirmation ──────────────────────────────────────────────────
export async function sendPaymentConfirmationEmail(to: string, opts: {
  plan: 'yearly' | 'lifetime'
  amount: string
  nextBillingDate?: string
}) {
  const isLifetime = opts.plan === 'lifetime'

  const html = base(`
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:${GREEN};padding:36px 32px 32px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:rgba(255,255,255,0.65);text-transform:uppercase;letter-spacing:0.12em;">Payment Confirmed</p>
          <h1 style="margin:0 0 8px;font-family:'Fraunces',Georgia,serif;font-size:30px;font-weight:600;color:${WHITE};line-height:1.2;">
            ${isLifetime ? 'Lifetime access activated!' : 'You\'re all set!'}
          </h1>
          <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.85);">
            ${isLifetime ? 'One payment, access forever.' : 'Your yearly plan is now active.'}
          </p>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:32px 36px 8px;">
          <p style="margin:0 0 20px;font-size:15px;color:${TEXT};line-height:1.7;">
            Thank you for your payment. Your Farmsy ${isLifetime ? 'Lifetime' : 'Yearly'} plan is now active.
            You have <strong>full access</strong> to all farms, the interactive map, favourites, and routing.
          </p>

          <!-- Receipt -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:10px;overflow:hidden;margin-bottom:20px;">
            <tr>
              <td style="padding:14px 20px;background:${CREAM};">
                <p style="margin:0;font-size:12px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.1em;">Receipt</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:15px;color:${TEXT};padding-bottom:10px;">${isLifetime ? 'Farmsy Lifetime Access' : 'Farmsy Yearly Plan'}</td>
                    <td align="right" style="font-size:15px;color:${TEXT};padding-bottom:10px;">${opts.amount}</td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding:0 0 10px;"><div style="height:1px;background:${BORDER};"></div></td>
                  </tr>
                  <tr>
                    <td style="font-size:15px;font-weight:700;color:${TEXT};">Total paid</td>
                    <td align="right" style="font-size:16px;font-weight:700;color:${GREEN};">${opts.amount}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          ${metaBox([
            { label: 'Paid on',     value: nowFormatted() },
            { label: 'Plan',        value: isLifetime ? 'Lifetime (one-time payment)' : 'Yearly' },
            ...((!isLifetime && opts.nextBillingDate) ? [{ label: 'Next billing', value: opts.nextBillingDate }] : []),
          ])}

          ${isLifetime ? `
          ${infoNote('🌱 <strong>Lifetime access</strong> means you\'ll never be charged again. No renewals, no subscriptions — just permanent access to every farm on Farmsy.')}` : ''}

          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 0;">
            ${cta('Explore Farms', `${APP_URL}/map`)}
          </td></tr></table>
        </td>
      </tr>
    </table>
  `)

  const subject = isLifetime
    ? 'Payment confirmed — Farmsy Lifetime access is yours!'
    : 'Payment confirmed — Welcome to Farmsy!'

  return getResend().emails.send({ from: FROM, to, subject, html })
}


// ─── 3. Trial Ending Reminder ─────────────────────────────────────────────────
export async function sendTrialEndingEmail(to: string, opts: { endDate: string }) {
  const html = base(`
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:${AMBER};padding:28px 32px 24px;border-bottom:1px solid ${AMBER_BORDER};">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:${AMBER_TEXT};text-transform:uppercase;letter-spacing:0.12em;">⏳ Your trial ends tomorrow</p>
          <h1 style="margin:0;font-family:'Fraunces',Georgia,serif;font-size:26px;font-weight:600;color:${TEXT};line-height:1.2;">Action needed — keep your access</h1>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:32px 36px 8px;">
          <p style="margin:0 0 20px;font-size:15px;color:${TEXT};line-height:1.7;">
            Your Farmsy free trial ends on <strong>${opts.endDate}</strong>.
            After that date, your account will be <strong>automatically charged €29.99</strong> for a full year of access —
            unless you cancel before then.
          </p>

          <!-- What's included -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:12px;border:1px solid ${BORDER};margin-bottom:24px;">
            <tr>
              <td style="padding:20px 24px;">
                <p style="margin:0 0 14px;font-size:12px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.1em;">With your yearly plan you keep</p>
                ${[
                  'Full access to 12,717+ farms across NL & BE',
                  'Interactive farm map with filters & routing',
                  'Save favourites and plan multi-farm trips',
                  'New farms added to the platform regularly',
                ].map(item => `
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
                    <tr>
                      <td width="20" style="font-size:14px;color:${GREEN};font-weight:700;vertical-align:top;">✓</td>
                      <td style="font-size:14px;color:${TEXT};line-height:1.5;">${item}</td>
                    </tr>
                  </table>`).join('')}
              </td>
            </tr>
          </table>

          ${metaBox([
            { label: 'Trial ends',    value: opts.endDate },
            { label: 'Charge amount', value: '€29.99 / year' },
            { label: 'Cancel by',     value: opts.endDate + ' to avoid being charged' },
          ])}

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:28px 0 12px;">
                ${cta('Keep My Access', `${APP_URL}/map`)}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:28px;">
                <a href="${APP_URL}/account/subscription"
                  style="font-size:13px;color:${MUTED};text-decoration:underline;text-underline-offset:3px;">
                  Cancel subscription before ${opts.endDate}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `)

  return getResend().emails.send({ from: FROM, to, subject: 'Your Farmsy trial ends tomorrow', html })
}


// ─── 4. Win-back ─────────────────────────────────────────────────────────────
export async function sendWinBackEmail(to: string, opts: { discountCode?: string }) {
  const discountCode = opts.discountCode ?? 'COMEBACK20'

  const html = base(`
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:${GREEN};padding:36px 32px 32px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:rgba(255,255,255,0.65);text-transform:uppercase;letter-spacing:0.12em;">Special Offer</p>
          <h1 style="margin:0 0 8px;font-family:'Fraunces',Georgia,serif;font-size:30px;font-style:italic;font-weight:400;color:${WHITE};line-height:1.2;">We'd love to have you back</h1>
          <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.85);">Here's 20% off your first year back.</p>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:32px 36px 8px;">
          <p style="margin:0 0 22px;font-size:15px;color:${TEXT};line-height:1.7;">
            It's been a while since you last visited Farmsy.
            As a thank-you for giving it a try, we'd like to offer you a <strong>personal 20% discount</strong> on your first year back.
          </p>

          <!-- Discount code box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:14px;border:2px dashed #C5BFB4;margin-bottom:24px;overflow:hidden;">
            <tr>
              <td style="background:${CREAM};padding:24px;text-align:center;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.12em;">Your personal discount code</p>
                <p style="margin:0 0 8px;font-family:monospace;font-size:32px;font-weight:700;color:${GREEN};letter-spacing:0.15em;">${discountCode}</p>
                <p style="margin:0;font-size:13px;color:${MUTED};">20% off your first year · Limited time offer</p>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 20px;font-size:15px;color:${TEXT};line-height:1.7;">
            With Farmsy you get access to <strong>12,717+ local farms</strong> — fresh eggs, vegetables, dairy, flowers, and more, directly from farmers in your area.
          </p>

          ${metaBox([
            { label: 'Discount',     value: '20% off — €23.99 instead of €29.99' },
            { label: 'Code',         value: discountCode },
            { label: 'Valid until',  value: '7 days from now' },
          ])}

          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 0;">
            ${cta('Claim Your Discount', `${APP_URL}/?coupon=${discountCode}#pricing`)}
          </td></tr></table>

          ${infoNote('Not interested? <a href="' + APP_URL + '/contact" style="color:' + GREEN + ';text-decoration:underline;">Let us know how we can improve</a> — we genuinely read every reply.')}
        </td>
      </tr>
    </table>
  `)

  return getResend().emails.send({ from: FROM, to, subject: "We'd love to have you back 🌱", html })
}


// ─── 5. Admin OTP ─────────────────────────────────────────────────────────────
export async function sendAdminOtpEmail(to: string, opts: { code: string }) {
  const html = base(`
    ${logo()}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:36px 36px 32px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:${GREEN};text-transform:uppercase;letter-spacing:0.12em;">Admin Access · Two-Factor Verification</p>
          <h1 style="margin:0 0 14px;font-family:'Fraunces',Georgia,serif;font-size:26px;font-weight:600;color:${TEXT};line-height:1.25;">Your verification code</h1>
          <p style="margin:0 0 24px;font-size:15px;color:${MUTED};line-height:1.7;">
            A sign-in attempt was made for the <strong>Farmsy admin dashboard</strong>.
            Enter the code below to complete verification. Do not share it with anyone.
          </p>

          <!-- Big code display -->
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:24px;">
            <div style="display:inline-block;background:${CREAM};border:2px solid ${BORDER};border-radius:14px;padding:22px 48px;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.12em;">6-digit code</p>
              <p style="margin:0;font-family:monospace;font-size:44px;font-weight:700;color:${GREEN};letter-spacing:0.3em;">${opts.code}</p>
            </div>
          </td></tr></table>

          ${metaBox([
            { label: 'Requested at', value: nowFormatted() },
            { label: 'Expires in',   value: '10 minutes' },
            { label: 'Use in',       value: 'Farmsy admin dashboard only' },
          ])}

          ${securityNote([
            "Only enter this code on the official Farmsy admin dashboard. Never share it with anyone — Farmsy staff will never ask for it.",
            "If you didn't request this code, someone may be attempting to access the admin panel. Change your password immediately.",
          ])}
        </td>
      </tr>
    </table>
  `, 'Your Farmsy admin verification code — expires in 10 minutes.')

  return getResend().emails.send({ from: FROM, to, subject: 'Admin verification code — Farmsy', html })
}


// ─── 6. Contact Reply (admin → user) ─────────────────────────────────────────
export async function sendContactReply(to: string, opts: { subject: string; body: string }) {
  const isAdminNotification = to === 'neilalvinmedallon@gmail.com'

  // Admin notification emails (user replied) — simple readable format
  if (isAdminNotification) {
    const bodyHtml = opts.body
      .split('\n')
      .map(line =>
        line.trim() === ''
          ? `<tr><td style="height:10px;"></td></tr>`
          : `<tr><td style="padding:0 0 4px;font-size:15px;color:${TEXT};line-height:1.7;">${line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</td></tr>`
      )
      .join('')

    const html = base(`
      ${logo()}
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:32px 36px 36px;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:${GREEN};text-transform:uppercase;letter-spacing:0.12em;">Admin Notification</p>
            <h1 style="margin:0 0 20px;font-family:'Fraunces',Georgia,serif;font-size:22px;font-weight:600;color:${TEXT};line-height:1.3;">${opts.subject.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</h1>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:10px;border:1px solid ${BORDER};margin-bottom:24px;">
              <tr><td style="padding:20px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">${bodyHtml}</table>
              </td></tr>
            </table>
            ${metaBox([{ label: 'Received at', value: nowFormatted() }])}
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 0 0;">
              ${cta('View in Admin', `${APP_URL}/admin/contact`)}
            </td></tr></table>
          </td>
        </tr>
      </table>
    `)

    return getResend().emails.send({ from: FROM, to, subject: opts.subject, html })
  }

  // User-facing email — proper message design
  const bodyHtml = opts.body
    .split('\n')
    .map(line =>
      line.trim() === ''
        ? `<tr><td style="height:12px;"></td></tr>`
        : `<tr><td style="padding:0 0 5px;font-size:15px;color:${TEXT};line-height:1.75;">${line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</td></tr>`
    )
    .join('')

  const html = base(`
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:${GREEN};padding:32px;text-align:center;">
          <span style="font-family:'Fraunces',Georgia,serif;font-size:28px;font-style:italic;font-weight:600;color:${WHITE};letter-spacing:-0.5px;">Farmsy</span>
          <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Message from Farmsy Support</p>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:32px 36px 0;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.1em;">Subject</p>
          <h1 style="margin:0 0 24px;font-family:'Fraunces',Georgia,serif;font-size:22px;font-weight:600;color:${TEXT};line-height:1.3;">${opts.subject.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</h1>
        </td>
      </tr>
    </table>

    ${divider()}

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:24px 36px 8px;">
          <!-- Sender row -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr>
              <td width="40">
                <div style="width:36px;height:36px;border-radius:50%;background:${GREEN};display:inline-flex;align-items:center;justify-content:center;text-align:center;line-height:36px;">
                  <span style="font-size:14px;font-weight:700;color:${WHITE};">FS</span>
                </div>
              </td>
              <td style="padding-left:10px;vertical-align:middle;">
                <p style="margin:0;font-size:14px;font-weight:600;color:${TEXT};">Farmsy Support</p>
                <p style="margin:2px 0 0;font-size:12px;color:${MUTED};">support@farmsy.app</p>
              </td>
            </tr>
          </table>

          <!-- Message body -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:10px;border:1px solid ${BORDER};margin-bottom:20px;">
            <tr>
              <td style="padding:22px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">${bodyHtml}</table>
              </td>
            </tr>
          </table>

          ${metaBox([
            { label: 'Sent at',  value: nowFormatted() },
            { label: 'From',     value: 'Farmsy Support Team' },
          ])}

          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 0 8px;">
            ${cta('Reply on Farmsy', `${APP_URL}/messages`)}
          </td></tr></table>

          ${infoNote('This is an official message from the Farmsy Support team. If you have concerns about this message, contact us directly at <a href="' + APP_URL + '/contact" style="color:' + GREEN + ';text-decoration:underline;">farmsy.app/contact</a>.')}
        </td>
      </tr>
    </table>
  `)

  return getResend().emails.send({ from: FROM, to, subject: opts.subject, html })
}


// ─── 7. Password Reset ────────────────────────────────────────────────────────
export async function sendPasswordResetEmail(to: string, opts: { resetUrl: string }) {
  const html = base(`
    ${logo()}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:36px 36px 32px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:${GREEN};text-transform:uppercase;letter-spacing:0.12em;">Password Reset</p>
          <h1 style="margin:0 0 14px;font-family:'Fraunces',Georgia,serif;font-size:26px;font-weight:600;color:${TEXT};line-height:1.25;">Reset your Farmsy password</h1>
          <p style="margin:0 0 24px;font-size:15px;color:${TEXT};line-height:1.7;">
            We received a request to <strong>reset the password</strong> for your Farmsy account.
            Click the button below to choose a new password. This link can only be used once.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:24px;">
            ${cta('Reset my password', opts.resetUrl)}
          </td></tr></table>

          ${metaBox([
            { label: 'Requested at', value: nowFormatted() },
            { label: 'Expires in',   value: '1 hour' },
            { label: 'Use once',     value: 'This link becomes invalid after use' },
          ])}

          ${infoNote('Having trouble with the button? Copy and paste this link into your browser:<br/><a href="' + opts.resetUrl + '" style="color:' + GREEN + ';font-size:12px;word-break:break-all;text-decoration:none;">' + opts.resetUrl + '</a>')}

          ${securityNote([
            "If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.",
            'Never share this link with anyone. It gives direct access to change your Farmsy password.',
          ])}
        </td>
      </tr>
    </table>
  `, 'Reset your Farmsy password — link expires in 1 hour.')

  return getResend().emails.send({ from: FROM, to, subject: 'Reset your Farmsy password', html })
}
