import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redactMembersForViewer } from '@/lib/visibility'
import { EDUCATION_CORE_SELECT } from '@/lib/additional-details/core-selects'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
  const limit = Math.min(50, parseInt(url.searchParams.get('limit') ?? '20'))
  const q = url.searchParams.get('q')
  const gender = url.searchParams.get('gender')
  const maritalStatus = url.searchParams.get('maritalStatus')

  const where: any = { status: 'ACTIVE', deletedAt: null }
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (gender) where.gender = gender
  if (maritalStatus) where.maritalStatus = maritalStatus

  const [members, total] = await Promise.all([
    prisma.member.findMany({
      where,
      include: {
        education: { where: { isHighest: true }, take: 1, select: EDUCATION_CORE_SELECT },
        families: { include: { family: { select: { name: true } } }, take: 1 },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { firstName: 'asc' },
    }),
    prisma.member.count({ where }),
  ])

  // Same per-member privacy settings as GET /api/members/[id] (security
  // finding 2: the list used to return contact details and DOB unredacted).
  return NextResponse.json({ members: await redactMembersForViewer(session, members), total, page, limit })
}
