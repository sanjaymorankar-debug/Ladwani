import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roles: string[] = (session.user as any)?.roles ?? []
  if (!roles.includes('ADMIN') && !roles.includes('OPERATOR')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [families, members, matrimonial, pendingApprovals, posts] = await Promise.all([
    prisma.family.count({ where: { status: 'ACTIVE' } }),
    prisma.member.count({ where: { status: 'ACTIVE' } }),
    prisma.matrimonialProfile.count({ where: { isVisible: true } }),
    prisma.approval.count({ where: { status: 'SUBMITTED' } }),
    prisma.post.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
  ])

  return NextResponse.json({ families, members, matrimonial, pendingApprovals, posts })
}
