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
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberId = (session.user as any).memberId as string | null
  if (!memberId) {
    return NextResponse.json({ error: 'Your member profile could not be found. Please contact support.' }, { status: 400 })
  }

  const body = await req.json()
  if (!body.name) return NextResponse.json({ error: 'Family name is required' }, { status: 400 })

  // A member can only actively belong to one family at a time — registering
  // a second one while already linked would silently orphan the first.
  const existingMembership = await prisma.familyMember.findFirst({
    where: { memberId, leftAt: null },
  })
  if (existingMembership) {
    return NextResponse.json({ error: 'You are already linked to a family.' }, { status: 409 })
  }

  const family = await prisma.$transaction(async (tx) => {
    const created = await tx.family.create({
      data: {
        registrationNumber: `FAM-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000 + 10000)}`,
        name: body.name,
        surname: body.surname ?? null,
        description: body.description ?? null,
        kuladevata: body.kuladevata ?? null,
        kuladevi: body.kuladevi ?? null,
        gotra: body.gotra ?? null,
        traditionalOccupation: body.traditionalOccupation ?? null,
        nativeVillage: body.nativeVillage ?? null,
        nativeDistrict: body.nativeDistrict ?? null,
        nativeState: body.nativeState ?? null,
        nativeCountry: body.nativeCountry ?? 'India',
        status: 'PENDING',
        kartaMemberId: memberId,
        createdBy: session.user.id,
      },
    })

    await tx.familyMember.create({
      data: { familyId: created.id, memberId, isKarta: true, joinedBy: session.user.id },
    })

    let kartaRole = await tx.role.findUnique({ where: { code: 'KARTA' } })
    if (!kartaRole) {
      kartaRole = await tx.role.create({ data: { code: 'KARTA', label: 'Karta', isSystem: true } })
    }
    await tx.userRole.create({
      data: {
        userId: session.user.id,
        roleId: kartaRole.id,
        familyId: created.id,
        grantedBy: session.user.id,
      },
    })

    await tx.approval.create({
      data: {
        actionCode: 'family.create',
        entityType: 'family',
        entityId: created.id,
        newValue: { name: created.name, registrationNumber: created.registrationNumber },
        status: 'SUBMITTED',
        submittedBy: session.user.id,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        actorRole: 'KARTA',
        action: 'family.create',
        entityType: 'family',
        entityId: created.id,
        newValue: { name: created.name },
      },
    })

    return created
  })

  return NextResponse.json(
    { message: 'Family created — you are now its Karta. Submitted for verification.', familyId: family.id },
    { status: 201 }
  )
}
