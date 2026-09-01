import { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'

/** Self, or platform staff (ADMIN/OPERATOR). Karta status alone does NOT grant edit access to another adult member's profile — only the member themself or staff can. */
export async function getMemberAccess(session: Session | null, memberId: string) {
  if (!session?.user?.id) {
    return { authorized: false as const, exists: false, isOwn: false, isStaff: false }
  }

  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { userId: true } })
  if (!member) {
    return { authorized: false as const, exists: false, isOwn: false, isStaff: false }
  }

  const roles = ((session.user as any).roles ?? []) as string[]
  const isStaff = roles.includes('ADMIN') || roles.includes('OPERATOR')
  const isOwn = member.userId === session.user.id

  return { authorized: isOwn || isStaff, exists: true, isOwn, isStaff }
}
