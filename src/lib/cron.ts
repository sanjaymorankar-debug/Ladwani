import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

/**
 * Hosting cron endpoints authenticate with the CRON_SECRET header, not a
 * session. Returns the error response, or null when the caller is the cron.
 */
export function cronGuard(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ message: 'CRON_SECRET is not configured' }, { status: 503 })
  const given = Buffer.from(req.headers.get('x-cron-secret') ?? '')
  const expected = Buffer.from(secret)
  if (secret.length < 16 || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }
  return null
}
