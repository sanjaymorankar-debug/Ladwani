import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const memberId = (session.user as any).memberId as string | null
  if (!memberId) return NextResponse.json({ sent: [], received: [] })

  const { searchParams } = new URL(req.url)
  const box = searchParams.get('box') // 'sent' | 'received' | omitted = both

  const [sent, received] = await Promise.all([
    box === 'received' ? [] : prisma.matrimonialInterest.findMany({
      where: { fromMemberId: memberId },
      include: { toMember: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    box === 'sent' ? [] : prisma.matrimonialInterest.findMany({
      where: { toMemberId: memberId },
      include: { fromMember: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return NextResponse.json({ sent, received })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const memberId = (session.user as any).memberId as string | null
  if (!memberId) return NextResponse.json({ message: 'Complete your member profile first.' }, { status: 400 })

  const body = await req.json()
  const toMemberId = body.toMemberId as string
  if (!toMemberId) return NextResponse.json({ message: 'toMemberId is required' }, { status: 400 })
  if (toMemberId === memberId) return NextResponse.json({ message: 'You cannot send interest to yourself' }, { status: 400 })

  const targetProfile = await prisma.matrimonialProfile.findUnique({ where: { memberId: toMemberId } })
  if (!targetProfile || !targetProfile.isVisible) {
    return NextResponse.json({ message: 'This matrimonial profile is not available.' }, { status: 404 })
  }

  const existing = await prisma.matrimonialInterest.findFirst({
    where: { fromMemberId: memberId, toMemberId, status: 'PENDING' },
  })
  if (existing) {
    return NextResponse.json({ message: 'You already sent an interest to this profile.' }, { status: 409 })
  }

  const interest = await prisma.$transaction(async (tx) => {
    const created = await tx.matrimonialInterest.create({
      data: { fromMemberId: memberId, toMemberId, message: body.message ?? null },
    })

    const toMember = await tx.member.findUnique({ where: { id: toMemberId }, select: { userId: true } })
    if (toMember?.userId) {
      await tx.notification.create({
        data: {
          recipientId: toMember.userId,
          senderId: session.user!.id as string,
          type: 'MATRIMONIAL_INTEREST',
          title: 'New matrimonial interest',
          body: 'Someone has expressed interest in your matrimonial profile.',
          data: { interestId: created.id },
        },
      })
    }

    return created
  })

  return NextResponse.json({ message: 'Interest sent', interest }, { status: 201 })
}
