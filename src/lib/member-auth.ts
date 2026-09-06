import { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'

/**
 * Who may edit a member profile.
 *
 *  - the member themself
 *  - platform staff (ADMIN / OPERATOR)
 *  - the Karta of that member's family, **but only for members who have no
 *    login account of their own** — children, elderly parents, deceased
 *    relatives. Somebody has to be able to maintain those records, and the
 *    Karta is who the spec puts in charge of family data (§13, §27).
 *
 * A member who *does* have an account manages their own profile: a Karta
 * cannot silently override another adult account-holder's private
 * information (spec §27). Staff can, and every such edit is audit-logged.
 */
export async function getMemberAccess(session: Session | null, memberId: string) {
  const denied = { authorized: false as const, exists: false, isOwn: false, isStaff: false, isKartaGuardian: false }
  if (!session?.user?.id) return denied

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      userId: true,
      families: { where: { leftAt: null }, select: { familyId: true } },
    },
  })
  if (!member) return denied

  const roles = ((session.user as any).roles ?? []) as string[]
  const isStaff = roles.includes('ADMIN') || roles.includes('OPERATOR')
  const isOwn = !!member.userId && member.userId === session.user.id
  const viewerMemberId = (session.user as any).memberId as string | null

  // Karta-as-guardian: only for account-less members of a family this viewer
  // actually heads. Re-derived from the database, never from the request.
  let isKartaGuardian = false
  if (!isOwn && !isStaff && !member.userId && viewerMemberId && member.families.length > 0) {
    const kartaLink = await prisma.familyMember.findFirst({
      where: {
        memberId: viewerMemberId,
        familyId: { in: member.families.map((f) => f.familyId) },
        isKarta: true,
        leftAt: null,
      },
    })
    isKartaGuardian = !!kartaLink
  }

  return {
    authorized: isOwn || isStaff || isKartaGuardian,
    exists: true,
    isOwn,
    isStaff,
    isKartaGuardian,
  }
}
