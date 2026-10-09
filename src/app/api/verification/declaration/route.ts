import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { issueOtp, verifyOtp, OTP_TTL_MINUTES } from '@/lib/otp'
import { sendEmail } from '@/lib/email'
import { sendSms, notifyUser } from '@/lib/notify'
import { requestIp, recordAudit } from '@/lib/audit'
import { DECLARATION_TEXT, DECLARATION_VERSION } from '@/lib/declaration'
import { submitRegistration } from '@/lib/registration'

/**
 * F03 steps 3–5: the self-declaration.
 *   { action: 'send-otp' }               — code by email (and SMS once a gateway exists)
 *   { action: 'agree', agree: true, otp } — consent record (text version, time,
 *                                           IP, OTP reference), copy to the user,
 *                                           then submit for approval.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } })
  if (!['DRAFT', 'CORRECTION_REQUIRED'].includes(user.status)) {
    return NextResponse.json({ message: 'There is no registration to declare for.' }, { status: 409 })
  }
  const body = await req.json().catch(() => ({}))

  if (body.action === 'send-otp') {
    const { code } = await issueOtp(user.id, 'DECLARATION')
    const text = `Your LadWani declaration code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`
    let sent = false
    if (user.email) {
      try {
        await sendEmail({ to: user.email, subject: 'Your LadWani declaration code', html: `<p>${text}</p>`, text })
        sent = true
      } catch { /* reported below */ }
    }
    if (user.mobile) sent = (await sendSms(user.mobile, text)) || sent
    if (!sent) return NextResponse.json({ message: 'The code could not be sent. Please try again shortly.' }, { status: 503 })
    return NextResponse.json({ message: 'We sent you a 6-digit code.' })
  }

  if (body.action === 'agree') {
    if (body.agree !== true) return NextResponse.json({ message: 'Tick "I Agree" to continue' }, { status: 400 })
    const check = await verifyOtp(user.id, 'DECLARATION', String(body.otp ?? ''))
    if (!check.ok) {
      return NextResponse.json({
        message: check.reason === 'TOO_MANY_ATTEMPTS' ? 'Too many wrong attempts. Request a new code.' : 'That code is wrong or has expired.',
      }, { status: 400 })
    }
    const consent = await prisma.consentRecord.create({
      data: {
        userId: user.id, consentType: 'REGISTRATION_DECLARATION', granted: true,
        version: DECLARATION_VERSION, declarationText: DECLARATION_TEXT, otpReference: check.tokenId,
        ipAddress: requestIp(req), userAgent: req.headers.get('user-agent'),
      },
    })
    await recordAudit({
      actorId: user.id, action: 'consent.declaration', entityType: 'consent_record', entityId: consent.id,
      newValue: { version: DECLARATION_VERSION, otpReference: check.tokenId },
    }, req)
    // Alert: "Declaration agreed — user gets a copy (SMS + email)".
    await notifyUser({
      userId: user.id, type: 'DECLARATION_COPY', title: 'Copy of your LadWani declaration',
      body: `Agreed on ${consent.grantedAt.toISOString()} (version ${DECLARATION_VERSION}):\n\n${DECLARATION_TEXT}`,
      also: ['EMAIL', 'SMS'],
    })

    const submitted = await submitRegistration(user.id, req)
    if (!submitted.ok) {
      return NextResponse.json({ message: `Declaration recorded. ${submitted.message}`, missing: submitted.missing, declared: true }, { status: submitted.status })
    }
    return NextResponse.json({ message: 'Submitted for verification.', status: submitted.status })
  }

  return NextResponse.json({ message: 'Unknown action' }, { status: 400 })
}
