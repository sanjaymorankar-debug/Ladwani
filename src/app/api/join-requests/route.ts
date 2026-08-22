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

// Self-service: a logged-in member requests to join the family of an
// existing member they're related to. Goes to that family's Karta for approval.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const myMemberId = session?.user?.memberId
  if (!session?.user?.id || !myMemberId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { relatedToMemberId, relationshipTypeCode } = await req.json()
  if (!relatedToMemberId || !relationshipTypeCode) {
    return NextResponse.json({ message: 'relatedToMemberId and relationshipTypeCode are required' }, { status: 400 })
  }
  if (relatedToMemberId === myMemberId) {
    return NextResponse.json({ message: 'You cannot connect to yourself' }, { status: 400 })
  }

  const relatedMembership = await prisma.familyMember.findFirst({
    where: { memberId: relatedToMemberId, leftAt: null },
    include: { family: { select: { id: true, name: true } } },
    orderBy: { joinedAt: 'asc' },
  })
  if (!relatedMembership) {
    return NextResponse.json({ message: 'That member is not currently part of any family' }, { status: 400 })
  }
  const familyId = relatedMembership.familyId

  const alreadyInFamily = await prisma.familyMember.findFirst({
    where: { familyId, memberId: myMemberId, leftAt: null },
  })
  if (alreadyInFamily) {
    return NextResponse.json({ message: 'You are already part of this family' }, { status: 409 })
  }

  const existingPending = await prisma.familyJoinRequest.findFirst({
    where: { familyId, memberId: myMemberId, status: 'PENDING' },
  })
  if (existingPending) {
    return NextResponse.json({ message: 'You already have a pending request for this family' }, { status: 409 })
  }

  const karta = await prisma.familyMember.findFirst({
    where: { familyId, isKarta: true, leftAt: null },
    include: { member: { select: { userId: true } } },
  })

  const joinRequest = await prisma.familyJoinRequest.create({
    data: {
      familyId,
      memberId: myMemberId,
      relatedToMemberId,
      relationshipTypeCode,
      requestedBy: session.user.id,
    },
  })

  if (karta?.member.userId) {
    await prisma.notification.create({
      data: {
        recipientId: karta.member.userId,
        senderId: session.user.id,
        type: 'FAMILY_JOIN_REQUEST',
        title: 'Someone wants to join your family',
        body: `A member has requested to join ${relatedMembership.family.name} family.`,
        data: { joinRequestId: joinRequest.id, familyId, familyName: relatedMembership.family.name },
      },
    })
  }

  return NextResponse.json({ joinRequest }, { status: 201 })
}
