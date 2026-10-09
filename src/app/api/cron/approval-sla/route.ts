import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { escalateOverdueTasks } from '@/lib/verification'

/**
 * F06 step 4 — escalate verification tasks past their SLA. Called by the
 * hosting cron, e.g. hourly:
 *   curl -fsS -H "x-cron-secret: $CRON_SECRET" https://<site>/api/cron/approval-sla
 * No session: the shared secret is the credential.
 */
function authorised(req: Request) {
  const secret = process.env.CRON_SECRET
  const given = req.headers.get('x-cron-secret') ?? ''
  if (!secret || secret.length < 16) return false
  const a = Buffer.from(secret)
  const b = Buffer.from(given)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function run(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ message: 'CRON_SECRET is not configured' }, { status: 503 })
  if (!authorised(req)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  return NextResponse.json(await escalateOverdueTasks())
}

export const GET = run
export const POST = run
