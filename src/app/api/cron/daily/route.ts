import { NextResponse } from 'next/server'
import { cronGuard } from '@/lib/cron'
import { runDailyFamilyJobs } from '@/lib/family-rules'

/**
 * Daily housekeeping (hosting cron, once a day):
 *   curl -fsS -H "x-cron-secret: $CRON_SECRET" https://<site>/api/cron/daily
 *  - F15: unanswered join requests past the expiry window become EXPIRED.
 *  - F16: a family left without a Karta beyond the SLA alerts its District
 *         team and the Admins (once).
 */
async function run(req: Request) {
  const denied = cronGuard(req)
  if (denied) return denied
  return NextResponse.json(await runDailyFamilyJobs())
}

export const GET = run
export const POST = run
