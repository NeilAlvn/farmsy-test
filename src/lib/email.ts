import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

const FROM = 'Farmsy <noreply@mail.farmsy.app>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.replace('localhost:3000', 'farmsy.app') ?? 'https://farmsy.app'

// ─── Shared styles ────────────────────────────────────────────────────────────
const CREAM   = '#F5F3EE'
const GREEN   = '#3F5E3A'
const WHITE   = '#FFFFFF'
const TEXT    = '#1C1C1C'
const MUTED   = '#6B6B6B'
const BORDER  = '#E5E2DB'

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
            <td style="background:${WHITE};border-radius:8px;border:1px solid ${BORDER};overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:${MUTED};">Farmsy · Discover local farms across NL &amp; BE</p>
              <p style="margin:0;font-size:12px;color:${MUTED};">
                Questions? <a href="${APP_URL}/contact" style="color:${MUTED};text-decoration:underline;">farmsy.app/contact</a>
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

function cta(label: string, href: string): string {
  return `<a href="${href}"
    style="display:inline-block;background:${GREEN};color:${WHITE};text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:6px;letter-spacing:0.01em;"
  >${label} →</a>`
}

function divider(): string {
  return `<tr><td style="padding:0 32px;"><div style="height:1px;background:${BORDER};"></div></td></tr>`
}


// ─── 0. Email Verification ────────────────────────────────────────────────────
export async function sendVerificationEmail(to: string, opts: { confirmUrl: string }) {
  const html = base(`
    <!-- Dark green header with centered logo -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:${GREEN};padding:36px 32px 32px;text-align:center;">
          <span style="font-family:'Fraunces',Georgia,serif;font-size:30px;font-style:italic;font-weight:600;color:${WHITE};letter-spacing:-0.5px;">Farmsy</span>
        </td>
      </tr>
    </table>

    <!-- Body -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:40px 40px 16px;text-align:center;">
          <h1 style="margin:0 0 12px;font-family:'Fraunces',Georgia,serif;font-size:26px;font-weight:600;color:${TEXT};line-height:1.25;">One step left to get started</h1>
          <p style="margin:0 0 8px;font-size:16px;color:${TEXT};line-height:1.6;">
            Welcome to Farmsy — we're glad you're here.
          </p>
          <p style="margin:0 0 32px;font-size:15px;color:${MUTED};line-height:1.6;">
            Confirm your email address to activate your account and start discovering local farms near you.
          </p>
          ${cta('Verify my email', opts.confirmUrl)}
          <p style="margin:32px 0 0;font-size:13px;color:${MUTED};line-height:1.6;">
            This link expires in 24 hours.<br/>
            If you didn't create an account, you can safely ignore this email.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 40px 36px;text-align:center;border-top:1px solid ${BORDER};margin-top:8px;">
          <p style="margin:0;font-size:13px;color:${MUTED};">
            Having trouble? Copy and paste this link into your browser:<br/>
            <a href="${opts.confirmUrl}" style="color:${GREEN};font-size:12px;word-break:break-all;text-decoration:none;">${opts.confirmUrl}</a>
          </p>
        </td>
      </tr>
    </table>
  `, 'Confirm your email to activate your Farmsy account and start exploring local farms.')

  return getResend().emails.send({ from: FROM, to, subject: 'Confirm your email — Farmsy', html })
}


// ─── 1. Welcome / Trial Started ───────────────────────────────────────────────
export async function sendWelcomeEmail(to: string) {
  const html = base(`
    <!-- Green header band -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:${GREEN};padding:36px 32px 32px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.12em;">Free Trial</p>
          <h1 style="margin:0;font-family:'Fraunces',Georgia,serif;font-size:32px;font-weight:600;color:${WHITE};line-height:1.2;">Welcome to Farmsy!</h1>
          <p style="margin:10px 0 0;font-size:16px;color:rgba(255,255,255,0.85);">Your 3-day free trial has started.</p>
        </td>
      </tr>
    </table>

    <!-- Body -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:32px 32px 8px;">
          <p style="margin:0 0 20px;font-size:16px;color:${TEXT};line-height:1.6;">
            You now have full access to <strong>12,717+ farms</strong> across the Netherlands and Belgium.
            Explore fresh produce, dairy, flowers, and more — directly from local farmers.
          </p>

          <!-- What to explore -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:12px;margin-bottom:28px;">
            <tr>
              <td style="padding:20px 24px;">
                <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:0.1em;">What you can do</p>
                ${['🗺️  Browse the interactive farm map', '❤️  Save your favourite farms', '📍  Plan routes to multiple farms', '🔔  Get notified about new farms nearby'].map(item =>
                  `<p style="margin:0 0 10px;font-size:15px;color:${TEXT};">${item}</p>`
                ).join('')}
              </td>
            </tr>
          </table>

          <p style="margin:0 0 28px;font-size:15px;color:${MUTED};line-height:1.6;">
            Your trial runs for <strong>3 days</strong>. After that, you'll be charged €29.99/year automatically — or cancel anytime before then from your account.
          </p>

          <p style="margin:0 0 32px;text-align:center;">
            ${cta('Start Exploring', `${APP_URL}/map`)}
          </p>
        </td>
      </tr>
    </table>
  `)

  return getResend().emails.send({ from: FROM, to, subject: 'Welcome to Farmsy! Your trial has started', html })
}


// ─── 2. Payment Confirmation ──────────────────────────────────────────────────
export async function sendPaymentConfirmationEmail(to: string, opts: {
  plan: 'yearly' | 'lifetime'
  amount: string
  nextBillingDate?: string
}) {
  const isLifetime = opts.plan === 'lifetime'

  const html = base(`
    <!-- Header -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:36px 32px 24px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:${GREEN};text-transform:uppercase;letter-spacing:0.12em;">Payment Confirmed</p>
          <h1 style="margin:0;font-family:'Fraunces',Georgia,serif;font-size:30px;font-weight:600;color:${TEXT};line-height:1.2;">
            ${isLifetime ? 'Welcome to Farmsy Lifetime!' : 'You\'re all set — welcome to Farmsy!'}
          </h1>
        </td>
      </tr>
    </table>

    ${divider()}

    <!-- Receipt -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:24px 32px;">
          <p style="margin:0 0 16px;font-size:13px;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:0.1em;">Receipt</p>

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:15px;color:${TEXT};padding-bottom:10px;">${isLifetime ? 'Farmsy Lifetime Access' : 'Farmsy Yearly Plan'}</td>
              <td align="right" style="font-size:15px;font-weight:600;color:${TEXT};padding-bottom:10px;">${opts.amount}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding:0 0 10px;"><div style="height:1px;background:${BORDER};"></div></td>
            </tr>
            <tr>
              <td style="font-size:15px;font-weight:600;color:${TEXT};">Total paid</td>
              <td align="right" style="font-size:15px;font-weight:700;color:${GREEN};">${opts.amount}</td>
            </tr>
          </table>

          ${!isLifetime && opts.nextBillingDate ? `
          <p style="margin:20px 0 0;font-size:14px;color:${MUTED};">
            Next billing date: <strong style="color:${TEXT};">${opts.nextBillingDate}</strong>
          </p>` : ''}

          ${isLifetime ? `
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:12px;margin-top:20px;">
            <tr>
              <td style="padding:18px 20px;">
                <p style="margin:0;font-size:15px;color:${TEXT};">🌱 <strong>Lifetime access</strong> — you'll never be charged again. No renewals, no cancellations needed.</p>
              </td>
            </tr>
          </table>` : ''}
        </td>
      </tr>
    </table>

    ${divider()}

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:28px 32px 36px;text-align:center;">
          <p style="margin:0 0 24px;font-size:15px;color:${MUTED};">Ready to find your nearest farm?</p>
          ${cta('Explore Farms', `${APP_URL}/map`)}
        </td>
      </tr>
    </table>
  `)

  const subject = isLifetime
    ? 'Payment confirmed — Welcome to Farmsy Lifetime!'
    : 'Payment confirmed — Welcome to Farmsy!'

  return getResend().emails.send({ from: FROM, to, subject, html })
}


// ─── 3. Trial Ending Reminder ─────────────────────────────────────────────────
export async function sendTrialEndingEmail(to: string, opts: { endDate: string }) {
  const html = base(`
    <!-- Amber warning header -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#FFF8E7;padding:28px 32px 24px;border-bottom:1px solid #F0E9D2;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#92621A;text-transform:uppercase;letter-spacing:0.12em;">⏳ Trial ending soon</p>
          <h1 style="margin:0;font-family:'Fraunces',Georgia,serif;font-size:28px;font-weight:600;color:${TEXT};line-height:1.2;">Your Farmsy trial ends tomorrow</h1>
        </td>
      </tr>
    </table>

    <!-- Body -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:28px 32px 8px;">
          <p style="margin:0 0 20px;font-size:16px;color:${TEXT};line-height:1.6;">
            Your free trial ends on <strong>${opts.endDate}</strong>. After that, you'll be charged <strong>€29.99</strong> for a full year of access.
          </p>

          <!-- What they keep -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:12px;margin-bottom:20px;">
            <tr>
              <td style="padding:18px 24px;">
                <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:0.1em;">With your yearly plan</p>
                ${['Full access to 12,717+ farms', 'Interactive farm map & routing', 'Save favourites & plan trips', 'New farms added regularly'].map(item =>
                  `<p style="margin:0 0 8px;font-size:15px;color:${TEXT};">✓ &nbsp;${item}</p>`
                ).join('')}
              </td>
            </tr>
          </table>

          <p style="margin:0 0 28px;font-size:14px;color:${MUTED};line-height:1.6;">
            Don't want to continue? You can cancel anytime before ${opts.endDate} — no charge.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-bottom:32px;" align="center">
                ${cta('Keep My Access', `${APP_URL}/map`)}
              </td>
            </tr>
            <tr>
              <td style="text-align:center;padding-bottom:32px;">
                <a href="${APP_URL}/account/subscription"
                  style="font-size:13px;color:${MUTED};text-decoration:underline;text-underline-offset:3px;">
                  Manage or cancel subscription
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
    <!-- Header -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:36px 32px 24px;">
          <h1 style="margin:0 0 10px;font-family:'Fraunces',Georgia,serif;font-size:30px;font-style:italic;font-weight:400;color:${TEXT};line-height:1.2;">We'd love to have you back</h1>
          <p style="margin:0;font-size:16px;color:${MUTED};line-height:1.5;">It's not too late to reconnect with local farms in your area.</p>
        </td>
      </tr>
    </table>

    ${divider()}

    <!-- Offer -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:28px 32px;">
          <p style="margin:0 0 20px;font-size:15px;color:${TEXT};line-height:1.6;">
            As a thank-you for trying Farmsy, we'd like to offer you <strong>20% off your first year</strong>.
          </p>

          <!-- Discount code box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:14px;border:2px dashed #C5BFB4;margin-bottom:24px;">
            <tr>
              <td style="padding:20px 24px;text-align:center;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:0.12em;">Your discount code</p>
                <p style="margin:0;font-family:monospace;font-size:26px;font-weight:700;color:${GREEN};letter-spacing:0.12em;">${discountCode}</p>
                <p style="margin:8px 0 0;font-size:13px;color:${MUTED};">20% off your first year · Limited time</p>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 20px;font-size:15px;color:${TEXT};line-height:1.6;">
            Farmsy gives you access to <strong>12,717+ local farms</strong> — fresh eggs, vegetables, dairy, flowers, and more from farmers near you.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-bottom:12px;" align="center">
                ${cta('Claim Your Discount', `${APP_URL}/?coupon=${discountCode}#pricing`)}
              </td>
            </tr>
          </table>

          <p style="margin:16px 0 0;font-size:13px;color:${MUTED};text-align:center;line-height:1.5;">
            20% off your first year back · €23.99 instead of €29.99
          </p>
        </td>
      </tr>
    </table>

    ${divider()}

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:20px 32px 32px;text-align:center;">
          <p style="margin:0;font-size:13px;color:${MUTED};line-height:1.5;">
            Not interested?
            <a href="${APP_URL}/contact" style="color:${MUTED};text-decoration:underline;text-underline-offset:3px;">Let us know how we can improve.</a>
          </p>
        </td>
      </tr>
    </table>
  `)

  return getResend().emails.send({ from: FROM, to, subject: "We'd love to have you back 🌱", html })
}


// ─── 5. Admin OTP ─────────────────────────────────────────────────────────────
export async function sendAdminOtpEmail(to: string, opts: { code: string }) {
  const html = base(`
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:${GREEN};padding:36px 32px 32px;text-align:center;">
          <span style="font-family:'Fraunces',Georgia,serif;font-size:30px;font-style:italic;font-weight:600;color:${WHITE};letter-spacing:-0.5px;">Farmsy</span>
        </td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:40px 40px 16px;text-align:center;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:0.12em;">Admin Access</p>
          <h1 style="margin:0 0 16px;font-family:'Fraunces',Georgia,serif;font-size:26px;font-weight:600;color:${TEXT};line-height:1.25;">Your verification code</h1>
          <p style="margin:0 0 32px;font-size:15px;color:${MUTED};line-height:1.6;">Enter this code to access the Farmsy admin dashboard.</p>
          <div style="display:inline-block;background:${CREAM};border:2px solid ${BORDER};border-radius:12px;padding:20px 40px;margin-bottom:28px;">
            <p style="margin:0;font-family:monospace;font-size:40px;font-weight:700;color:${GREEN};letter-spacing:0.25em;">${opts.code}</p>
          </div>
          <p style="margin:0;font-size:13px;color:${MUTED};line-height:1.6;">
            This code expires in <strong>10 minutes</strong>.<br/>
            If you didn't request this, someone may be trying to access the admin panel.
          </p>
        </td>
      </tr>
    </table>
  `, 'Your Farmsy admin verification code')

  return getResend().emails.send({ from: FROM, to, subject: 'Admin verification code — Farmsy', html })
}


// ─── 6. Password Reset ────────────────────────────────────────────────────────
export async function sendPasswordResetEmail(to: string, opts: { resetUrl: string }) {
  const html = base(`
    <!-- Dark green header with logo -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:${GREEN};padding:36px 32px 32px;text-align:center;">
          <span style="font-family:'Fraunces',Georgia,serif;font-size:30px;font-style:italic;font-weight:600;color:${WHITE};letter-spacing:-0.5px;">Farmsy</span>
        </td>
      </tr>
    </table>

    <!-- Body -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:40px 40px 16px;text-align:center;">
          <h1 style="margin:0 0 12px;font-family:'Fraunces',Georgia,serif;font-size:26px;font-weight:600;color:${TEXT};line-height:1.25;">Reset your password</h1>
          <p style="margin:0 0 32px;font-size:15px;color:${MUTED};line-height:1.6;">
            We received a request to reset your Farmsy password.<br/>Click the button below to choose a new one.
          </p>
          ${cta('Reset my password', opts.resetUrl)}
          <p style="margin:32px 0 0;font-size:13px;color:${MUTED};line-height:1.6;">
            This link expires in 1 hour.<br/>
            If you didn't request a password reset, you can safely ignore this email.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 40px 36px;text-align:center;border-top:1px solid ${BORDER};margin-top:8px;">
          <p style="margin:0;font-size:13px;color:${MUTED};">
            Having trouble? Copy and paste this link into your browser:<br/>
            <a href="${opts.resetUrl}" style="color:${GREEN};font-size:12px;word-break:break-all;text-decoration:none;">${opts.resetUrl}</a>
          </p>
        </td>
      </tr>
    </table>
  `, 'Reset your Farmsy password — link expires in 1 hour.')

  return getResend().emails.send({ from: FROM, to, subject: 'Reset your Farmsy password', html })
}
