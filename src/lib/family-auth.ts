import { prisma } from '@/lib/prisma'

export async function isFamilyKartaOrAdmin(familyId: string, session: any): Promise<boolean> {
  const roles: string[] = session?.user?.roles ?? []
  if (roles.includes('ADMIN') || roles.includes('OPERATOR')) return true
  const memberId = session?.user?.memberId
  if (!memberId) return false
  const membership = await prisma.familyMember.findFirst({
    where: { familyId, memberId, isKarta: true, leftAt: null },
  })
  return !!membership
}
