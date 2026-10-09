import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isActiveAdmin } from '@/lib/scope'

/** F40: the Admin's queue of deletion requests. */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !(await isActiveAdmin(session.user.id))) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const rows = await prisma.dataDeletionRequest.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'asc' }], take: 200 })
  const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, email: true, member: { select: { firstName: true, lastName: true, memberNumber: true } } } })
  return NextResponse.json({
    requests: rows.map((r) => {
      const u = users.find((x) => x.id === r.userId)
      return { ...r, person: u?.member ? `${[u.member.firstName, u.member.lastName].filter(Boolean).join(' ')} (${u.member.memberNumber})` : u?.email ?? r.userId }
    }),
  })
}
