import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTeamScope } from '@/lib/additional-details/access'
import { json } from '@/lib/additional-details/http'
import { INTEREST_GROUP_TYPE, getGroupAccess, suggestModerator } from '@/lib/interest-groups'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const access = await getGroupAccess(session, params.id)
  const g = access.group
  if (!g || g.groupType !== INTEREST_GROUP_TYPE || g.deletedAt) return json({ message: 'Not found' }, 404)

  const [memberCount, subGroups, moderators, parent] = await Promise.all([
    prisma.communityGroupMember.count({ where: { groupId: g.id, leftAt: null } }),
    prisma.communityGroup.findMany({ where: { parentGroupId: g.id, deletedAt: null }, select: { id: true, name: true, district: true } }),
    prisma.communityGroupMember.count({ where: { groupId: g.id, leftAt: null, roleInGroup: 'MODERATOR' } }),
    g.parentGroupId ? prisma.communityGroup.findUnique({ where: { id: g.parentGroupId }, select: { id: true, name: true } }) : null,
  ])
  const scope = await getTeamScope(session)
  const canAssign = scope.isAdmin || (!!g.district && scope.districts.includes(g.district.toLowerCase()))
  const m = access.membership

  return json({
    group: {
      id: g.id, name: g.name, description: g.description, rules: g.rules, district: g.district,
      isChildSafe: !!g.isChildSafe, memberCount, subGroups, parent,
    },
    viewer: {
      isMember: access.isMember,
      isModerator: access.isModerator,
      isStaff: access.isStaff,
      canAssignModerator: canAssign,
      // Rule 10: rules are shown on first entry until accepted.
      mustAcceptRules: access.isMember && !m!.rulesAcceptedAt,
      notifyMode: m?.notifyMode ?? 'DAILY_DIGEST',
      isMuted: !!m?.isMuted,
      leftReason: m?.leftAt ? m.leftReason : null,
    },
    moderation: {
      moderatorCount: moderators,
      suggestion: moderators === 0 && (canAssign || access.isStaff) ? await suggestModerator(g.id) : null,
    },
  })
}
