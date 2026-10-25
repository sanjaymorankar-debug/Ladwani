import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateAge } from '@/lib/utils'
import { getTeamScope } from '@/lib/additional-details/access'
import { actorFor, json } from '@/lib/additional-details/http'
import { getGroupAccess, suggestModerator } from '@/lib/interest-groups'

/**
 * Moderators (Step 3 rule 10): assigned by Admin, or by the District team for
 * that district's sub-groups. The most active expert/mentor is suggested.
 */
async function canAssign(session: any, group: { district: string | null }) {
  const scope = await getTeamScope(session)
  return scope.isAdmin || (!!group.district && scope.districts.includes(group.district.toLowerCase()))
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const access = await getGroupAccess(session, params.id)
  if (!access.group) return json({ message: 'Not found' }, 404)
  if (!access.isStaff && !(await canAssign(session, access.group))) return json({ message: 'Forbidden' }, 403)
  const moderators = await prisma.communityGroupMember.findMany({
    where: { groupId: params.id, leftAt: null, roleInGroup: 'MODERATOR' },
    include: { member: { select: { id: true, firstName: true, lastName: true } } },
  })
  return json({
    moderators: moderators.map((m) => ({ memberId: m.member.id, name: `${m.member.firstName} ${m.member.lastName ?? ''}`.trim() })),
    suggestion: await suggestModerator(params.id),
  })
}

/** body: { memberId, action?: 'assign' | 'revoke' } */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const access = await getGroupAccess(session, params.id)
  if (!access.group) return json({ message: 'Not found' }, 404)
  if (!(await canAssign(session, access.group))) return json({ message: 'Only Admin or the District team can assign moderators' }, 403)
  const body = await req.json().catch(() => ({}))
  const row = body.memberId
    ? await prisma.communityGroupMember.findUnique({ where: { groupId_memberId: { groupId: params.id, memberId: String(body.memberId) } }, include: { member: { select: { dateOfBirth: true, userId: true } } } })
    : null
  if (!row || row.leftAt) return json({ message: 'Choose a current member of the group' }, 400)
  const age = calculateAge(row.member.dateOfBirth)
  if (body.action !== 'revoke' && age !== null && age < 18) return json({ message: 'Moderators must be 18 or over' }, 400)

  const role = body.action === 'revoke' ? 'MEMBER' : 'MODERATOR'
  await prisma.communityGroupMember.update({ where: { id: row.id }, data: { roleInGroup: role } })
  const actor = actorFor(session, req)
  await prisma.auditLog.create({
    data: { actorId: actor.userId, actorRole: actor.role, action: `interest_group.moderator.${body.action === 'revoke' ? 'revoke' : 'assign'}`, entityType: 'group', entityId: params.id, metadata: { memberId: row.memberId } },
  })
  if (role === 'MODERATOR' && row.member.userId) {
    await prisma.notification.create({
      data: { recipientId: row.member.userId, senderId: actor.userId, type: 'SYSTEM', title: `You are now a moderator of ${access.group.name}` },
    })
  }
  return json({ message: role === 'MODERATOR' ? 'Moderator assigned' : 'Moderator role removed' })
}
