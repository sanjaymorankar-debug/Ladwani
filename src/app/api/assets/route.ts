import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Community assets — halls, guesthouses, equipment members can book.
 *
 * Only APPROVED assets are visible to members; owners and staff also see
 * their own drafts and pending submissions.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const roles = ((session.user as any).roles ?? []) as string[]
  const isStaff = roles.includes('ADMIN') || roles.includes('OPERATOR')
  const memberId = (session.user as any).memberId as string | null

  const url = new URL(req.url)
  const mine = url.searchParams.get('mine') === 'true'
  const city = url.searchParams.get('city')
  const assetType = url.searchParams.get('type')

  const where: any = { deletedAt: null }
  if (mine) {
    if (!memberId) return NextResponse.json({ assets: [] })
    where.ownerMemberId = memberId
  } else if (!isStaff) {
    where.status = 'APPROVED'
    where.isActive = true
  }
  if (city) where.city = { contains: city, mode: 'insensitive' }
  if (assetType) where.assetType = assetType

  const assets = await prisma.asset.findMany({
    where,
    include: {
      owner: { select: { id: true, firstName: true, lastName: true } },
      // Upcoming bookings are shown so members can see what's already taken.
      bookings: {
        where: { status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] }, endAt: { gte: new Date() } },
        select: { id: true, startAt: true, endAt: true, status: true },
        orderBy: { startAt: 'asc' },
      },
      blackouts: {
        where: { endAt: { gte: new Date() } },
        select: { startAt: true, endAt: true, reason: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 60,
  })

  return NextResponse.json({ assets })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const memberId = (session.user as any).memberId as string | null
  if (!memberId) return NextResponse.json({ message: 'Complete your member profile first.' }, { status: 400 })

  const body = await req.json()
  if (!body.name || !body.assetType) {
    return NextResponse.json({ message: 'Asset name and type are required' }, { status: 400 })
  }

  const bookingMode = body.bookingMode === 'HOURLY' ? 'HOURLY' : 'DAILY'
  const ratePerDay = body.ratePerDay ? Math.round(Number(body.ratePerDay) * 100) : null
  const ratePerHour = body.ratePerHour ? Math.round(Number(body.ratePerHour) * 100) : null

  if (bookingMode === 'DAILY' && !ratePerDay) {
    return NextResponse.json({ message: 'A daily rate is required for daily bookings' }, { status: 400 })
  }
  if (bookingMode === 'HOURLY' && !ratePerHour) {
    return NextResponse.json({ message: 'An hourly rate is required for hourly bookings' }, { status: 400 })
  }

  const asset = await prisma.$transaction(async (tx) => {
    const created = await tx.asset.create({
      data: {
        ownerMemberId: memberId,
        name: body.name,
        assetType: body.assetType,
        description: body.description || null,
        addressLine: body.addressLine || null,
        city: body.city || null,
        district: body.district || null,
        state: body.state || null,
        pincode: body.pincode || null,
        capacity: body.capacity ? parseInt(body.capacity, 10) : null,
        facilities: Array.isArray(body.facilities) ? body.facilities : [],
        bookingMode,
        ratePerDay,
        ratePerHour,
        // Submitted straight for review — an asset is never bookable until
        // an Operator or Admin approves it.
        status: 'PENDING_APPROVAL',
      },
    })

    await tx.approval.create({
      data: {
        actionCode: 'asset.create',
        entityType: 'asset',
        entityId: created.id,
        newValue: { name: created.name, assetType: created.assetType },
        status: 'SUBMITTED',
        submittedBy: session.user!.id as string,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId: session.user!.id as string,
        action: 'asset.create',
        entityType: 'asset',
        entityId: created.id,
        newValue: { name: created.name },
      },
    })

    return created
  })

  return NextResponse.json(
    { message: 'Asset submitted for approval. It becomes bookable once approved.', assetId: asset.id },
    { status: 201 }
  )
}
