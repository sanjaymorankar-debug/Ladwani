import { NextResponse } from 'next/server'
import { cronGuard } from '@/lib/cron'
import { runDailyFamilyJobs } from '@/lib/family-rules'
import { runOrganisationJobs } from '@/lib/organisations'

/**
 * Daily housekeeping (hosting cron, once a day):
 *   curl -fsS -H "x-cron-secret: $CRON_SECRET" https://<site>/api/cron/daily
 *  - F15: unanswered join requests past the expiry window become EXPIRED.
 *  - F16: a family left without a Karta beyond the SLA alerts its District
 *         team and the Admins (once).
 *  - F31: office bearers whose term has ended step down; the post is flagged.
 */
async function run(req: Request) {
  const denied = cronGuard(req)
  if (denied) return denied
  return NextResponse.json({ ...(await runDailyFamilyJobs()), ...(await runOrganisationJobs()) })
}

export const GET = run
export const POST = run
