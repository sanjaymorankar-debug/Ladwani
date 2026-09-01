import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const memberId = (session.user as any).memberId as string | null
  const interest = await prisma.matrimonialInterest.findUnique({ where: { id: params.id } })
  if (!interest) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  const body = await req.json()
  const action = body.action as 'accept' | 'decline' | 'withdraw'

  // Only the recipient can accept/decline; only the sender can withdraw.
  const canAct =
    (memberId === interest.toMemberId && (action === 'accept' || action === 'decline')) ||
    (memberId === interest.fromMemberId && action === 'withdraw')
  if (!canAct) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  if (interest.status !== 'PENDING') {
    return NextResponse.json({ message: 'This interest has already been responded to.' }, { status: 409 })
  }

  const statusMap = { accept: 'ACCEPTED', decline: 'DECLINED', withdraw: 'WITHDRAWN' } as const

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.matrimonialInterest.update({
      where: { id: params.id },
      data: { status: statusMap[action], statusChangedAt: new Date(), statusNote: body.note ?? null },
    })

    if (action === 'accept' || action === 'decline') {
      const fromMember = await tx.member.findUnique({ where: { id: interest.fromMemberId }, select: { userId: true } })
      if (fromMember?.userId) {
        await tx.notification.create({
          data: {
            recipientId: fromMember.userId,
            senderId: session.user!.id as string,
            type: 'MATRIMONIAL_INTEREST',
            title: action === 'accept' ? 'Your interest was accepted' : 'Your interest was declined',
            body: null,
            data: { interestId: interest.id },
          },
        })
      }
    }

    return result
  })

  return NextResponse.json({ message: 'Updated', interest: updated })
}
