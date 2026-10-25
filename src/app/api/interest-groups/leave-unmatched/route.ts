import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDetailsContext } from '@/lib/additional-details/access'
import { actorFor, json } from '@/lib/additional-details/http'
import { prisma } from '@/lib/prisma'
import { leaveUnmatched } from '@/lib/interest-groups'

/**
 * Confirmation step after a hobby/interest was removed from the profile
 * (Step 3 rule 3). body: { memberId, groupIds: string[] }. Only groups the
 * member genuinely no longer matches are left; they may be re-added if the
 * interest comes back, because the member didn't choose to leave.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const body = await req.json().catch(() => ({}))
  const memberId = String(body.memberId ?? (session.user as any).memberId ?? '')
  const ctx = await getDetailsContext(session, memberId)
  if (!ctx.exists) return json({ message: 'Not found' }, 404)
  if (!ctx.canEdit) return json({ message: 'Forbidden' }, 403)
  const ids = Array.isArray(body.groupIds) ? body.groupIds.map(String) : []
  const left = await leaveUnmatched(memberId, ids)
  if (left.length) {
    const actor = actorFor(session, req)
    await prisma.auditLog.create({ data: { actorId: actor.userId, actorRole: actor.role, action: 'interest_group.leave_unmatched', entityType: 'member', entityId: memberId, metadata: { groupIds: left } } })
  }
  return json({ message: left.length ? 'Removed from those groups' : 'Nothing to change', left })
}
