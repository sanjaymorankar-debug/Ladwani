import { NextRequest, NextResponse } from 'next/server'
import { validateLogin, type LoginErrorCode } from '@/lib/auth'
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

  return NextResponse.json({ ok: true })
}
