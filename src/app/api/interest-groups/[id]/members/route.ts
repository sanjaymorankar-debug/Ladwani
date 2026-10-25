import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateAge } from '@/lib/utils'
import { json } from '@/lib/additional-details/http'
import { getGroupAccess } from '@/lib/interest-groups'

/**
 * Members list (Step 3 rules 6, 7, 9). Only name, photo, city and the hobby
 * level are ever returned — joining a group reveals nothing else from anyone's
 * profile. "Mentor" marks members who said they can teach or guide. Members
 * under 18 are left out of district sub-group lists.
 */
export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const access = await getGroupAccess(session, params.id)
  if (!access.group) return json({ message: 'Not found' }, 404)
  if (!access.isMember && !access.isStaff) return json({ message: 'Join the group to see its members' }, 403)
  const g = access.group
  const viewerMemberId = (session.user as any).memberId as string | null

  const rows = await prisma.communityGroupMember.findMany({
    where: { groupId: g.id, leftAt: null },
    include: { member: { select: { id: true, firstName: true, lastName: true, currentCity: true, profilePhotoId: true, dateOfBirth: true, status: true } } },
    orderBy: [{ roleInGroup: 'desc' }, { joinedAt: 'asc' }],
  })
  const ids = rows.map((r) => r.memberId)
  const [hobbies, sports] = g.interestId
    ? await Promise.all([
        prisma.memberHobby.findMany({ where: { interestId: g.interestId, memberId: { in: ids } }, select: { memberId: true, level: true, canTeach: true } }),
        prisma.memberSport.findMany({ where: { interestId: g.interestId, memberId: { in: ids } }, select: { memberId: true, level: true } }),
      ])
    : [[], []]
  // Levels and mentor flags only from members who share hobbies/sports with the community.
  const shared = new Set((await prisma.memberSectionSetting.findMany({
    where: { memberId: { in: ids }, sectionKey: { in: ['hobbies', 'sports'] }, visibility: 'COMMUNITY', answer: 'YES' },
    select: { memberId: true },
  })).map((s) => s.memberId))
  const hobbyBy = new Map(hobbies.map((h) => [h.memberId, h]))
  const sportBy = new Map(sports.map((s) => [s.memberId, s]))

  const members = rows
    .filter((r) => r.member.status === 'ACTIVE')
    .filter((r) => {
      if (!g.parentGroupId || r.memberId === viewerMemberId) return true
      const age = calculateAge(r.member.dateOfBirth)
      return age === null || age >= 18
    })
    .map((r) => {
      const h = hobbyBy.get(r.memberId)
      return {
        memberId: r.member.id,
        name: `${r.member.firstName} ${r.member.lastName ?? ''}`.trim(),
        city: r.member.currentCity,
        profilePhotoId: r.member.profilePhotoId,
        level: shared.has(r.memberId) ? (h?.level ?? sportBy.get(r.memberId)?.level ?? null) : null,
        isMentor: shared.has(r.memberId) && !!h?.canTeach,
        role: r.roleInGroup === 'MODERATOR' ? 'MODERATOR' : 'MEMBER',
      }
    })
  return json({ members, mentors: members.filter((m) => m.isMentor) })
}
