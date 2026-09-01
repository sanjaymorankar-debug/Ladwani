import { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'

/**
 * Server-side authorization for family-scoped actions. Never trust a
 * familyId/memberId coming from the client as proof of membership — always
 * re-derive it here from the DB.
 */
export async function getFamilyAccess(session: Session | null, familyId: string) {
  if (!session?.user?.id) {
    return { authenticated: false as const, isMember: false, isKarta: false, isStaff: false }
  }

  const roles = ((session.user as any).roles ?? []) as string[]
  const isStaff = roles.includes('ADMIN') || roles.includes('OPERATOR')
  const memberId = (session.user as any).memberId as string | null

  let isMember = false
  let isKarta = false

  if (memberId) {
    const membership = await prisma.familyMember.findUnique({
      where: { familyId_memberId: { familyId, memberId } },
    })
    isMember = !!membership && !membership.leftAt
    isKarta = !!membership && !membership.leftAt && membership.isKarta
  }

  return { authenticated: true as const, isMember, isKarta, isStaff, memberId }
}

/** Karta of this specific family, or platform staff. Used to gate mutations. */
export async function canManageFamily(session: Session | null, familyId: string): Promise<boolean> {
  const access = await getFamilyAccess(session, familyId)
  return access.isKarta || access.isStaff
}

/** Any member of this family, or platform staff. Used to gate reads (e.g. the tree). */
export async function canViewFamily(session: Session | null, familyId: string): Promise<boolean> {
  const access = await getFamilyAccess(session, familyId)
  return access.isMember || access.isStaff
}
