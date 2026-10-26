import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

/**
 * P0 notification service: one call records the in-app notification and,
 * when asked, also emails and/or texts the user. The in-app row is always
 * written — it is the record that the alert was raised — and its
 * `emailSent` / `smsSent` flags say which extra channels actually delivered.
 *
 * Delivery failures never throw: an alert that could not be sent must not
 * roll back or fail the action that triggered it.
 */
export type ExtraChannel = 'EMAIL' | 'SMS'

export interface NotifyOptions {
  userId: string
  type: string
  title: string
  body?: string
  data?: Record<string, unknown>
  senderId?: string | null
  also?: ExtraChannel[]
}

export interface NotifyResult {
  notificationId: string
  emailSent: boolean
  smsSent: boolean
}

/**
 * SMS needs a DLT-registered template and a paid gateway in India (Open
 * Point OP-10), neither of which exists yet. SMS_DRIVER selects the sender:
 *   LOG (default) — writes the message to the server log and reports it as
 *                   NOT sent, so `smsSent` never claims a delivery that did
 *                   not happen.
 * A real gateway is added here as another driver once templates are approved.
 */
export async function sendSms(mobile: string, text: string): Promise<boolean> {
  const driver = (process.env.SMS_DRIVER ?? 'LOG').toUpperCase()
  if (driver === 'LOG') {
    if (process.env.NODE_ENV !== 'production') console.log(`[SMS:log] To: ${mobile} | ${text}`)
    return false
  }
  console.error(`[SMS] Unknown SMS_DRIVER "${driver}" — message to ${mobile} not sent`)
  return false
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export async function notifyUser(opts: NotifyOptions): Promise<NotifyResult | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: opts.userId },
      select: { id: true, email: true, mobile: true },
    })
    if (!user) return null

    const notification = await prisma.notification.create({
      data: {
        recipientId: user.id,
        senderId: opts.senderId ?? null,
        type: opts.type,
        title: opts.title,
        body: opts.body ?? null,
        data: (opts.data ?? undefined) as any,
      },
    })

    const also = opts.also ?? []
    let emailSent = false
    let smsSent = false

    if (also.includes('EMAIL') && user.email) {
      try {
        await sendEmail({
          to: user.email,
          subject: opts.title,
          html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px">
            <h2 style="color:#1e293b">${escapeHtml(opts.title)}</h2>
            ${opts.body ? `<p>${escapeHtml(opts.body)}</p>` : ''}
            <p style="color:#64748b;font-size:14px">Log in to Mi Ladwani to see the details.</p>
          </div>`,
          text: opts.body ? `${opts.title}\n\n${opts.body}` : opts.title,
        })
        emailSent = true
      } catch {
        emailSent = false
      }
    }

    if (also.includes('SMS') && user.mobile) {
      smsSent = await sendSms(user.mobile, opts.body ? `${opts.title}: ${opts.body}` : opts.title)
    }

    if (emailSent || smsSent) {
      await prisma.notification.update({ where: { id: notification.id }, data: { emailSent, smsSent } })
    }
    return { notificationId: notification.id, emailSent, smsSent }
  } catch (e: any) {
    console.error('[notify] failed:', e?.message ?? e)
    return null
  }
}
