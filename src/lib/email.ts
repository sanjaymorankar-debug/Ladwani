import nodemailer from 'nodemailer'

/**
 * Email is sent whenever SMTP is configured — including in development, so
 * you can prove your provider's settings work locally before deploying.
 * Without SMTP configured we fall back to logging to the console, which keeps
 * local development usable with no mail server at all.
 */
export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD)
}

let cachedTransporter: nodemailer.Transporter | null = null

export function getTransporter(): nodemailer.Transporter | null {
  if (!isEmailConfigured()) return null
  if (cachedTransporter) return cachedTransporter

  const port = parseInt(process.env.SMTP_PORT ?? '587', 10)
  // Port 465 is implicit TLS (connect over TLS from the start); 587 is
  // STARTTLS (connect plain, then upgrade). Getting this backwards is the
  // single most common cause of SMTP timeouts, so derive it from the port
  // unless explicitly overridden.
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  })
  return cachedTransporter
}

/** Checks credentials/connectivity without sending anything. */
export async function verifyEmailConnection(): Promise<{ ok: boolean; error?: string }> {
  const transporter = getTransporter()
  if (!transporter) return { ok: false, error: 'SMTP is not configured (need SMTP_HOST, SMTP_USER, SMTP_PASSWORD)' }
  try {
    await transporter.verify()
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) }
  }
}

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  // Default the From address to the authenticated mailbox — most providers
  // (Hostinger included) reject a From that isn't the account you logged in as.
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@miladwani.com'

  const transporter = getTransporter()
  if (!transporter) {
    console.log(`[EMAIL:not-configured] To: ${to} | Subject: ${subject}`)
    console.log(`[EMAIL:not-configured] Body: ${text ?? 'HTML email'}`)
    return { messageId: 'console-fallback', accepted: [to] }
  }

  try {
    return await transporter.sendMail({ from, to, subject, html, text })
  } catch (e: any) {
    // Never let a mail failure take down the request that triggered it —
    // the caller decides what to do about an undelivered message.
    console.error(`[EMAIL] Failed to send to ${to}:`, e?.message ?? e)
    throw e
  }
}

// ── Email Templates ────────────────────────────────────────────────

export function otpEmailTemplate(otp: string, name: string) {
  return {
    subject: 'Verify your Mi Ladwani account',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px">
        <div style="text-align:center;margin-bottom:24px">
          <div style="background:#ea580c;color:white;width:48px;height:48px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-size:24px;font-weight:bold">म</div>
          <h2 style="color:#1e293b;margin:12px 0 4px">Mi Ladwani</h2>
          <p style="color:#64748b;margin:0;font-size:14px">Ladwani Samaj Community Platform</p>
        </div>
        <p>Hello ${name},</p>
        <p>Your verification code for Mi Ladwani is:</p>
        <div style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:24px;text-align:center;margin:20px 0">
          <span style="font-size:36px;font-weight:bold;color:#ea580c;letter-spacing:8px">${otp}</span>
        </div>
        <p style="color:#64748b;font-size:14px">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
        <p style="color:#64748b;font-size:14px">If you did not request this, please ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="color:#94a3b8;font-size:12px;text-align:center">© ${new Date().getFullYear()} Mi Ladwani — Ladwani Samaj</p>
      </div>
    `,
    text: `Your Mi Ladwani verification code: ${otp}\nExpires in 10 minutes.`,
  }
}

export function passwordResetEmailTemplate(otp: string, name: string) {
  return {
    subject: 'Reset your Mi Ladwani password',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px">
        <h2 style="color:#1e293b">Password Reset</h2>
        <p>Hello ${name},</p>
        <p>Your password reset code is:</p>
        <div style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:24px;text-align:center;margin:20px 0">
          <span style="font-size:36px;font-weight:bold;color:#ea580c;letter-spacing:8px">${otp}</span>
        </div>
        <p style="color:#64748b;font-size:14px">Expires in 10 minutes. If you didn't request a reset, ignore this email — your password won't change.</p>
      </div>
    `,
    text: `Your Mi Ladwani password reset code: ${otp}\nExpires in 10 minutes.`,
  }
}

export function approvalNotificationTemplate(memberName: string, action: string, status: string, note?: string) {
  return {
    subject: `Update on your request — ${status}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px">
        <h2 style="color:#1e293b">Request ${status}</h2>
        <p>Hello ${memberName},</p>
        <p>Your request for <strong>${action}</strong> has been <strong>${status.toLowerCase()}</strong>.</p>
        ${note ? `<div style="background:#f8fafc;border-left:4px solid #ea580c;padding:12px 16px;margin:16px 0;"><p style="margin:0;color:#475569">${note}</p></div>` : ''}
        <p>Log in to Mi Ladwani to view the full details.</p>
      </div>
    `,
    text: `Your request for ${action} has been ${status}.${note ? ` Note: ${note}` : ''}`,
  }
}
