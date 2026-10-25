import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateAge } from '@/lib/utils'
import { json } from '@/lib/additional-details/http'
import { INTEREST_GROUP_TYPE } from '@/lib/interest-groups'

/**
 * Interest groups. ?mine=true → the groups I'm in, with my settings.
 * Otherwise the community-level directory (members under 18 only see
 * child-safe groups). District sub-groups are listed under their parent.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const memberId = (session.user as any).memberId as string | null
  const url = new URL(req.url)

  if (url.searchParams.get('mine') === 'true') {
    if (!memberId) return json({ groups: [] })
    const rows = await prisma.communityGroupMember.findMany({
      where: { memberId, leftAt: null, group: { groupType: INTEREST_GROUP_TYPE, deletedAt: null } },
      include: {
        group: {
          select: { id: true, name: true, description: true, parentGroupId: true, district: true, _count: { select: { members: { where: { leftAt: null } } } } },
        },
      },
      orderBy: { joinedAt: 'desc' },
    })
    return json({
      groups: rows.map((r) => ({
        ...r.group, memberCount: r.group._count.members, roleInGroup: r.roleInGroup,
        notifyMode: r.notifyMode ?? 'DAILY_DIGEST', isMuted: !!r.isMuted, autoJoined: !!r.autoJoined,
      })),
    })
  }

  const viewer = memberId ? await prisma.member.findUnique({ where: { id: memberId }, select: { dateOfBirth: true } }) : null
  const age = calculateAge(viewer?.dateOfBirth)
  const q = url.searchParams.get('q')?.trim()
  const groups = await prisma.communityGroup.findMany({
    where: {
      groupType: INTEREST_GROUP_TYPE, parentGroupId: null, deletedAt: null, status: 'ACTIVE', isActive: true,
      ...(age !== null && age < 18 ? { isChildSafe: true } : {}),
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    },
    select: {
      id: true, name: true, description: true, isChildSafe: true,
      interest: { select: { category: true } },
      _count: { select: { members: { where: { leftAt: null } }, subGroups: true } },
    },
    orderBy: { name: 'asc' },
    take: 300,
  })
  return json({
    groups: groups.map((g) => ({
      id: g.id, name: g.name, description: g.description, category: g.interest?.category ?? 'Community',
      memberCount: g._count.members, subGroupCount: g._count.subGroups,
    })),
  })
}
