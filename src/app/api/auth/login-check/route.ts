import { NextRequest, NextResponse } from 'next/server'
import { validateLogin, type LoginErrorCode } from '@/lib/auth'
import { adminSecondFactorRequired } from '@/lib/auth-config'
import { issueOtp, OTP_TTL_MINUTES } from '@/lib/otp'
import { sendEmail } from '@/lib/email'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * Pre-flight login validation, called by the login form before signIn().
 *
 * NextAuth v4's Credentials provider collapses every authorize() throw into
 * the generic "CredentialsSignin" error code on the client, so there is no
 * reliable way to surface distinct suspended/locked/pending messages through
 * signIn() itself. This route runs the same validateLogin() check and
 * returns a specific, safe message; the form only calls signIn() once this
 * confirms the credentials are good, at which point NextAuth's authorize()
 * re-runs the identical check and (trivially) succeeds.
 */

const MESSAGES: Record<LoginErrorCode, string> = {
  INVALID_CREDENTIALS: 'Incorrect login details. Please try again.',
  ACCOUNT_SUSPENDED: 'Your account has been temporarily suspended. Please contact the community administrator.',
  ACCOUNT_LOCKED: 'Too many failed attempts. Your account is temporarily locked. Please try again later.',
  ACCOUNT_PENDING: 'Please verify your account before continuing.',
}

export async function POST(req: NextRequest) {
  let body: { identifier?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid request.' }, { status: 400 })
  }

  const { identifier, password } = body
  if (!identifier || !password) {
    return NextResponse.json({ ok: false, message: 'Email/mobile and password are required.' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = checkRateLimit(`login:${ip}:${identifier.toLowerCase()}`)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, message: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }

  const result = await validateLogin(identifier, password)
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: MESSAGES[result.code] }, { status: 401 })
  }

  // F32: Admins get a second-factor code by email; the form then signs in
  // with identifier + password + code.
  if (result.user.roles.includes('ADMIN') && adminSecondFactorRequired()) {
    if (!result.user.email) {
      return NextResponse.json({ ok: false, message: 'This Admin account has no email for its sign-in code. Contact another Admin.' }, { status: 401 })
    }
    const { code } = await issueOtp(result.user.id, 'ADMIN_2FA')
    try {
      await sendEmail({
        to: result.user.email,
        subject: 'Your Mi Ladwani Admin sign-in code',
        html: `<p>Your Admin sign-in code is <strong style="font-size:20px;letter-spacing:4px">${code}</strong>.</p><p>It expires in ${OTP_TTL_MINUTES} minutes. If you did not try to sign in, change your password.</p>`,
        text: `Your Mi Ladwani Admin sign-in code: ${code} (expires in ${OTP_TTL_MINUTES} minutes)`,
      })
    } catch {
      return NextResponse.json({ ok: false, message: 'The sign-in code could not be emailed. Please try again shortly.' }, { status: 503 })
    }
    return NextResponse.json({ ok: true, otpRequired: true, message: 'We emailed you a 6-digit sign-in code.' })
  }

  return NextResponse.json({ ok: true })
}
