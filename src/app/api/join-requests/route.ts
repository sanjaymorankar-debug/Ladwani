import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  const myMemberId = session?.user?.memberId
  if (!myMemberId) return NextResponse.json({ requests: [] })

  const requests = await prisma.familyJoinRequest.findMany({
    where: { memberId: myMemberId, status: 'PENDING' },
    include: { family: { select: { id: true, name: true, registrationNumber: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ requests })
}
