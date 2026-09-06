import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createPayment, quoteBookingPaise, reference } from '@/lib/payments'

/** Existing bookings + blackouts, so the UI can show what's taken. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const asset = await prisma.asset.findUnique({ where: { id: params.id } })
  if (!asset || asset.deletedAt) return NextResponse.json({ message: 'Asset not found' }, { status: 404 })

  const [bookings, blackouts] = await Promise.all([
    prisma.booking.findMany({
      where: { assetId: params.id, status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] }, endAt: { gte: new Date() } },
      select: { id: true, startAt: true, endAt: true, status: true },
      orderBy: { startAt: 'asc' },
    }),
    prisma.assetBlackout.findMany({
      where: { assetId: params.id, endAt: { gte: new Date() } },
      select: { startAt: true, endAt: true, reason: true },
    }),
  ])

  return NextResponse.json({
    asset: {
      id: asset.id, name: asset.name, bookingMode: asset.bookingMode,
      ratePerDay: asset.ratePerDay, ratePerHour: asset.ratePerHour,
      capacity: asset.capacity, status: asset.status,
    },
    bookings,
    blackouts,
  })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const memberId = (session.user as any).memberId as string | null
  if (!memberId) return NextResponse.json({ message: 'Complete your member profile first.' }, { status: 400 })

  const body = await req.json()
  const startAt = body.startAt ? new Date(body.startAt) : null
  const endAt = body.endAt ? new Date(body.endAt) : null
  if (!startAt || !endAt || isNaN(startAt.getTime()) || isNaN(endAt.getTime())) {
    return NextResponse.json({ message: 'Valid startAt and endAt are required' }, { status: 400 })
  }
  if (startAt < new Date()) {
    return NextResponse.json({ message: 'Bookings cannot start in the past' }, { status: 400 })
  }

  const asset = await prisma.asset.findUnique({ where: { id: params.id } })
  if (!asset || asset.deletedAt) return NextResponse.json({ message: 'Asset not found' }, { status: 404 })
  if (asset.status !== 'APPROVED' || !asset.isActive) {
    return NextResponse.json({ message: 'This asset is not available for booking.' }, { status: 409 })
  }

  if (asset.capacity && body.guestCount && parseInt(body.guestCount, 10) > asset.capacity) {
    return NextResponse.json({ message: `This asset holds at most ${asset.capacity} guests.` }, { status: 400 })
  }

  const quote = quoteBookingPaise(asset, startAt, endAt)
  if (!quote.ok) return NextResponse.json({ message: quote.reason }, { status: 400 })

  // Owner-declared unavailability isn't covered by the database constraint,
  // so it's checked here.
  const blackout = await prisma.assetBlackout.findFirst({
    where: { assetId: asset.id, startAt: { lt: endAt }, endAt: { gt: startAt } },
  })
  if (blackout) {
    return NextResponse.json({ message: 'The asset is unavailable for those dates.' }, { status: 409 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          reference: reference('BKG'),
          assetId: asset.id,
          memberId,
          bookedByUserId: session.user!.id as string,
          startAt,
          endAt,
          status: 'PENDING_PAYMENT',
          amountPaise: quote.amountPaise,
          guestCount: body.guestCount ? parseInt(body.guestCount, 10) : null,
          notes: body.notes || null,
        },
      })

      const payment = await createPayment(tx, {
        purpose: 'BOOKING',
        bookingId: booking.id,
        memberId,
        paidByUserId: session.user!.id as string,
        amountPaise: quote.amountPaise,
      })

      return { booking, payment }
    })

    return NextResponse.json(
      {
        message: 'Slot held. Complete payment to confirm the booking.',
        booking: result.booking,
        payment: {
          id: result.payment.id,
          reference: result.payment.reference,
          amountPaise: result.payment.amountPaise,
          gateway: result.payment.gateway,
          gatewayOrderId: result.payment.gatewayOrderId,
        },
        units: quote.units,
      },
      { status: 201 }
    )
  } catch (e: any) {
    // The database rejects overlapping active bookings for the same asset
    // (exclusion constraint `bookings_no_overlap`). Two people booking the
    // same slot at the same instant both reach here; only one insert wins.
    if (e?.code === 'P2010' || /bookings_no_overlap|exclusion constraint/i.test(String(e?.message))) {
      return NextResponse.json(
        { message: 'That slot has just been taken. Please choose a different time.' },
        { status: 409 }
      )
    }
    throw e
  }
}
