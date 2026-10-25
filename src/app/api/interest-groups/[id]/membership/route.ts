import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateAge } from '@/lib/utils'
import { hasMinorGroupConsent } from '@/lib/additional-details/server'
import { actorFor, json } from '@/lib/additional-details/http'
import { INTEREST_GROUP_TYPE, getGroupAccess, leaveGroup } from '@/lib/interest-groups'

/** Join a group by choice. Leaving and re-joining is always the member's call. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const memberId = (session.user as any).memberId as string | null
  if (!memberId) return json({ message: 'Complete your member profile first' }, 400)
  const access = await getGroupAccess(session, params.id)
  const g = access.group
  if (!g || g.groupType !== INTEREST_GROUP_TYPE || g.deletedAt || g.status !== 'ACTIVE') return json({ message: 'Not found' }, 404)
  if (access.isMember) return json({ message: 'Already a member' }, 409)
  if (access.membership?.leftReason === 'REMOVED_BY_MODERATOR') return json({ message: 'A moderator removed you from this group' }, 403)

  const me = await prisma.member.findUnique({ where: { id: memberId }, select: { dateOfBirth: true } })
  const age = calculateAge(me?.dateOfBirth)
  if (age !== null && age < 18) {
    if (!g.isChildSafe) return json({ message: 'This group is for members 18 and over' }, 403)
    if (!(await hasMinorGroupConsent(memberId))) return json({ message: 'A parent or the family Karta needs to give consent first' }, 403)
  }
  if (g.parentGroupId) {
    const inParent = await prisma.communityGroupMember.findUnique({ where: { groupId_memberId: { groupId: g.parentGroupId, memberId } } })
    if (!inParent || inParent.leftAt) return json({ message: 'Join the main group first' }, 400)
  }

  await prisma.communityGroupMember.upsert({
    where: { groupId_memberId: { groupId: g.id, memberId } },
    update: { leftAt: null, leftReason: null, autoJoined: false, joinedAt: new Date(), addedBy: session.user.id },
    create: { groupId: g.id, memberId, autoJoined: false, addedBy: session.user.id },
  })
  const actor = actorFor(session, req)
  await prisma.auditLog.create({ data: { actorId: actor.userId, actorRole: actor.role, action: 'interest_group.join', entityType: 'group', entityId: g.id, metadata: { memberId } } })
  return json({ message: `You joined ${g.name}` }, 201)
}

/** Leave (Step 3 rule 4). Never deletes the hobby, and the system will not re-add you. */
export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const memberId = (session.user as any).memberId as string | null
  const access = await getGroupAccess(session, params.id)
  if (!access.group || !memberId) return json({ message: 'Not found' }, 404)
  if (!access.isMember) return json({ message: 'You are not in this group' }, 409)
  await leaveGroup(params.id, memberId, 'LEFT_BY_MEMBER')
  const actor = actorFor(session, req)
  await prisma.auditLog.create({ data: { actorId: actor.userId, actorRole: actor.role, action: 'interest_group.leave', entityType: 'group', entityId: params.id, metadata: { memberId } } })
  return json({ message: `You left ${access.group.name}` })
}

/** My settings in this group. body: { notifyMode?: 'DAILY_DIGEST' | 'EVERY_POST', isMuted?: boolean, acceptRules?: true } */
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const access = await getGroupAccess(session, params.id)
  if (!access.group || !access.isMember) return json({ message: 'Not found' }, 404)
  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (body.notifyMode !== undefined) {
    if (!['DAILY_DIGEST', 'EVERY_POST'].includes(body.notifyMode)) return json({ message: 'Choose daily digest or every post' }, 400)
    data.notifyMode = body.notifyMode
  }
  if (typeof body.isMuted === 'boolean') data.isMuted = body.isMuted
  if (body.acceptRules === true) data.rulesAcceptedAt = new Date()
  if (!Object.keys(data).length) return json({ message: 'Nothing to change' }, 400)
  await prisma.communityGroupMember.update({ where: { id: access.membership!.id }, data })
  return json({ message: 'Saved' })
}
