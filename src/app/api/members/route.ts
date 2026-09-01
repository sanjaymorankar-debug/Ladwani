import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
        education: { where: { isHighest: true }, take: 1 },
        families: { include: { family: { select: { name: true } } }, take: 1 },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { firstName: 'asc' },
    }),
    prisma.member.count({ where }),
  ])

  return NextResponse.json({ members, total, page, limit })
}
