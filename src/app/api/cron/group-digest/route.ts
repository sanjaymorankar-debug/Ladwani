import { json } from '@/lib/additional-details/http'
import { runDailyDigest } from '@/lib/interest-groups'

export const dynamic = 'force-dynamic'

/**
 * Daily group digest (Step 3 rule 11). Call once a day from the host's cron
 * (hPanel → Advanced → Cron Jobs):
 *   curl -s -X POST -H "x-cron-secret: $CRON_SECRET" https://<site>/api/cron/group-digest
 * Refuses to run without CRON_SECRET configured.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ message: 'Forbidden' }, 403)
  const sent = await runDailyDigest()
  return json({ message: 'Digest sent', notifications: sent })
}
