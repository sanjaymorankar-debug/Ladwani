import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const q = url.searchParams.get('q')
  const gender = url.searchParams.get('gender')
  const maritalStatus = url.searchParams.get('maritalStatus')
  const city = url.searchParams.get('city')
  const minAge = url.searchParams.get('minAge')
  const maxAge = url.searchParams.get('maxAge')
  const education = url.searchParams.get('education')

  const where: any = { status: 'ACTIVE', deletedAt: null }

  if (q) {
    where.OR = [
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { currentCity: { contains: q } },
      { nativeVillage: { contains: q } },
      { occupationCategory: { contains: q } },
    ]
  }

  if (gender) where.gender = gender
  if (maritalStatus) where.maritalStatus = maritalStatus
  if (city) where.currentCity = { contains: city }

  if (minAge || maxAge) {
    const now = new Date()
    where.dateOfBirth = {}
    if (maxAge) where.dateOfBirth.gte = new Date(now.getFullYear() - parseInt(maxAge), now.getMonth(), now.getDate())
    if (minAge) where.dateOfBirth.lte = new Date(now.getFullYear() - parseInt(minAge), now.getMonth(), now.getDate())
  }

  if (education) {
    where.education = { some: { level: education } }
  }

  const [members, total] = await Promise.all([
    prisma.member.findMany({
      where,
      include: {
        education: { where: { isHighest: true }, take: 1 },
        families: { include: { family: { select: { name: true } } }, take: 1 },
      },
      take: 30,
      orderBy: { firstName: 'asc' },
    }),
    prisma.member.count({ where }),
  ])

  return NextResponse.json({ members, total })
}
