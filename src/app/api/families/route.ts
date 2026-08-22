import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20')))
  const q = url.searchParams.get('q')

  const where: any = { status: 'ACTIVE', deletedAt: null }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { surname: { contains: q, mode: 'insensitive' } },
      { nativeVillage: { contains: q, mode: 'insensitive' } },
    ]
  }

  const [families, total] = await Promise.all([
    prisma.family.findMany({
      where,
      include: {
        addresses: { where: { isPrimary: true }, take: 1 },
        _count: { select: { members: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: 'asc' },
    }),
    prisma.family.count({ where }),
  ])

  return NextResponse.json({ families, total, page, limit })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.name) return NextResponse.json({ error: 'Family name is required' }, { status: 400 })

  const family = await prisma.family.create({
    data: {
      registrationNumber: `FAM-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000 + 10000)}`,
      name: body.name,
      surname: body.surname ?? null,
      description: body.description ?? null,
      kuladevata: body.kuladevata ?? null,
      gotra: body.gotra ?? null,
      nativeVillage: body.nativeVillage ?? null,
      nativeDistrict: body.nativeDistrict ?? null,
      nativeState: body.nativeState ?? null,
      nativeCountry: body.nativeCountry ?? 'India',
      status: 'PENDING',
      createdBy: session.user.id,
    },
  })

  return NextResponse.json({ message: 'Family created', familyId: family.id }, { status: 201 })
}
