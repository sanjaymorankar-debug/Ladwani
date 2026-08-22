import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const roles: string[] = (session.user as any)?.roles ?? []
  const url = new URL(req.url)
  const mine = url.searchParams.get('mine') === 'true'
  const status = url.searchParams.get('status')

  const where: any = {}
  if (mine) where.submittedBy = session.user?.id
  else if (!roles.includes('ADMIN') && !roles.includes('OPERATOR')) {
    where.submittedBy = session.user?.id
  }
  if (status) where.status = status
  else if (!mine) where.status = { in: ['SUBMITTED', 'UNDER_REVIEW', 'ESCALATED'] }

  const approvals = await prisma.approval.findMany({
    where,
    include: {
      submitter: { select: { member: { select: { firstName: true, lastName: true } } } },
      reviewer: { select: { member: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { submittedAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({ approvals })
}
