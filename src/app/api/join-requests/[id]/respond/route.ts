import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isFamilyKartaOrAdmin } from '@/lib/family-auth'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const myMemberId = session?.user?.memberId
  if (!session?.user?.id || !myMemberId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { action } = await req.json()
  if (action !== 'APPROVE' && action !== 'DECLINE') {
    return NextResponse.json({ message: 'action must be APPROVE or DECLINE' }, { status: 400 })
  }

  const joinRequest = await prisma.familyJoinRequest.findUnique({
    where: { id: params.id },
    include: { family: { select: { id: true, name: true } } },
  })
  if (!joinRequest) return NextResponse.json({ message: 'Join request not found' }, { status: 404 })

  // Either the invited member responds to a Karta-initiated invite, or the
  // family's Karta responds to a member-initiated self-service request.
  const isInvitedMember = joinRequest.memberId === myMemberId
  const isKarta = joinRequest.requestedBy !== session.user.id && (await isFamilyKartaOrAdmin(joinRequest.familyId, session))
  if (!isInvitedMember && !isKarta) {
    return NextResponse.json({ message: 'You are not authorized to respond to this request' }, { status: 403 })
  }
  if (joinRequest.status !== 'PENDING') {
    return NextResponse.json({ message: 'This request has already been responded to' }, { status: 409 })
  }

  if (action === 'DECLINE') {
    await prisma.familyJoinRequest.update({
      where: { id: params.id },
      data: { status: 'DECLINED', respondedAt: new Date() },
    })
    return NextResponse.json({ message: 'Request declined' })
  }

  await prisma.$transaction(async (tx: any) => {
    await tx.familyJoinRequest.update({
      where: { id: params.id },
      data: { status: 'APPROVED', respondedAt: new Date() },
    })

    await tx.familyMember.create({
      data: { familyId: joinRequest.familyId, memberId: joinRequest.memberId, joinedBy: joinRequest.requestedBy },
    })

    if (joinRequest.relatedToMemberId) {
      const relType = await tx.relationshipType.findUnique({ where: { code: joinRequest.relationshipTypeCode } })
      if (relType) {
        await tx.memberRelationship.create({
          data: {
            fromMemberId: joinRequest.memberId,
            toMemberId: joinRequest.relatedToMemberId,
            relationshipTypeId: relType.id,
            familyId: joinRequest.familyId,
            createdBy: joinRequest.requestedBy,
          },
        })
        if (relType.inverseCode) {
          const inverseType = await tx.relationshipType.findUnique({ where: { code: relType.inverseCode } })
          if (inverseType) {
            await tx.memberRelationship.create({
              data: {
                fromMemberId: joinRequest.relatedToMemberId,
                toMemberId: joinRequest.memberId,
                relationshipTypeId: inverseType.id,
                familyId: joinRequest.familyId,
                createdBy: joinRequest.requestedBy,
              },
            })
          }
        }
      }
    }

    await tx.notification.create({
      data: {
        recipientId: joinRequest.requestedBy,
        type: 'FAMILY_JOIN_REQUEST',
        title: 'Join request approved',
        body: `Your invitation to join ${joinRequest.family.name} family was accepted.`,
        data: { familyId: joinRequest.familyId },
      },
    })
  })

  return NextResponse.json({ message: 'Joined family successfully' })
}
