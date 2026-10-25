import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { actorFor, json } from '@/lib/additional-details/http'
import { getGroupAccess, leaveGroup } from '@/lib/interest-groups'

/** Moderator or staff removes a member (Step 3 rule 10). They are not re-added automatically. */
export async function DELETE(req: Request, props: { params: Promise<{ id: string; memberId: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const access = await getGroupAccess(session, params.id)
  if (!access.group) return json({ message: 'Not found' }, 404)
  if (!access.isModerator && !access.isStaff) return json({ message: 'Only a moderator can remove members' }, 403)
  const row = await prisma.communityGroupMember.findUnique({ where: { groupId_memberId: { groupId: params.id, memberId: params.memberId } } })
  if (!row || row.leftAt) return json({ message: 'Not a member' }, 404)

  const body = await req.json().catch(() => ({}))
  await leaveGroup(params.id, params.memberId, 'REMOVED_BY_MODERATOR')
  const actor = actorFor(session, req)
  await prisma.auditLog.create({
    data: {
      actorId: actor.userId, actorRole: actor.role, action: 'interest_group.member.remove', entityType: 'group', entityId: params.id,
      metadata: { memberId: params.memberId, reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : null },
    },
  })
  const target = await prisma.member.findUnique({ where: { id: params.memberId }, select: { userId: true } })
  if (target?.userId) {
    await prisma.notification.create({
      data: { recipientId: target.userId, senderId: actor.userId, type: 'SYSTEM', title: `You were removed from ${access.group.name}`, body: typeof body.reason === 'string' ? body.reason : null },
    })
  }
  return json({ message: 'Member removed' })
}
