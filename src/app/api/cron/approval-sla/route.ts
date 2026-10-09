import { NextResponse } from 'next/server'
import { escalateOverdueTasks } from '@/lib/verification'
import { cronGuard } from '@/lib/cron'

/**
 * F06 step 4 — escalate verification tasks past their SLA. Called by the
 * hosting cron, e.g. hourly:
 *   curl -fsS -H "x-cron-secret: $CRON_SECRET" https://<site>/api/cron/approval-sla
 * No session: the shared secret is the credential.
 */
async function run(req: Request) {
  const denied = cronGuard(req)
  if (denied) return denied
  return NextResponse.json(await escalateOverdueTasks())
}

export const GET = run
export const POST = run
