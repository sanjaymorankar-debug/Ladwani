import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageFamily } from '@/lib/family-auth'

export async function PATCH(req: Request, { params }: { params: { id: string; reqId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const decision = body.decision as 'APPROVE' | 'REJECT'
  if (decision !== 'APPROVE' && decision !== 'REJECT') {
    return NextResponse.json({ message: 'decision must be APPROVE or REJECT' }, { status: 400 })
  }

  const joinRequest = await prisma.familyJoinRequest.findUnique({ where: { id: params.reqId } })
  if (!joinRequest || joinRequest.familyId !== params.id) {
    return NextResponse.json({ message: 'Request not found' }, { status: 404 })
  }
  if (joinRequest.status !== 'PENDING') {
    return NextResponse.json({ message: 'This request has already been resolved' }, { status: 409 })
  }

  // Who gets to answer depends on who asked. A Karta approving a request to
  // join their family is not the same act as a person accepting an invitation
  // into someone else's — letting the Karta do both would let them add an
  // existing account-holder to their family without consent.
  if (joinRequest.direction === 'KARTA_INVITE') {
    const viewerMemberId = (session.user as any).memberId as string | null
    if (!viewerMemberId || viewerMemberId !== joinRequest.memberId) {
      return NextResponse.json(
        { message: 'Only the person who was invited can respond to this invitation' },
        { status: 403 }
      )
    }
  } else if (!(await canManageFamily(session, params.id))) {
    return NextResponse.json({ message: "Only this family's Karta can respond to join requests" }, { status: 403 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.familyJoinRequest.update({
      where: { id: joinRequest.id },
      data: {
        status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        respondedBy: session.user.id,
        respondedAt: new Date(),
        responseNote: body.note ?? null,
      },
    })

    if (decision === 'APPROVE') {
      // Guard a race: the member could have joined a different family
      // between requesting and this approval landing.
      const alreadyLinked = await tx.familyMember.findFirst({
        where: { memberId: joinRequest.memberId, leftAt: null },
      })

      if (!alreadyLinked) {
        await tx.familyMember.create({
          data: { familyId: params.id, memberId: joinRequest.memberId, joinedBy: session.user.id },
        })

        if (joinRequest.relatedToMemberId && joinRequest.relationshipTypeCode) {
          const relType = await tx.relationshipType.findUnique({ where: { code: joinRequest.relationshipTypeCode } })
          if (relType) {
            await tx.memberRelationship.create({
              data: {
                fromMemberId: joinRequest.memberId,
                toMemberId: joinRequest.relatedToMemberId,
                relationshipTypeId: relType.id,
                familyId: params.id,
                createdBy: session.user.id,
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
                    familyId: params.id,
                    createdBy: session.user.id,
                  },
                })
              }
            }
          }
        }
      }
    }

    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        action: joinRequest.direction === 'KARTA_INVITE'
          ? `family.invite.${decision === 'APPROVE' ? 'accept' : 'decline'}`
          : `family.join_request.${decision.toLowerCase()}`,
        entityType: 'family_join_request',
        entityId: joinRequest.id,
        newValue: { direction: joinRequest.direction },
      },
    })

    // Close the loop for whoever is waiting on the answer.
    const notifyUserId =
      joinRequest.direction === 'KARTA_INVITE'
        ? (await tx.user.findUnique({ where: { id: joinRequest.requestedBy }, select: { id: true } }))?.id
        : (await tx.member.findUnique({ where: { id: joinRequest.memberId }, select: { userId: true } }))?.userId

    if (notifyUserId) {
      await tx.notification.create({
        data: {
          recipientId: notifyUserId,
          senderId: session.user!.id as string,
          type: 'APPROVAL_STATUS',
          title: decision === 'APPROVE' ? 'Family request accepted' : 'Family request declined',
          body: joinRequest.direction === 'KARTA_INVITE'
            ? `Your invitation was ${decision === 'APPROVE' ? 'accepted' : 'declined'}.`
            : `Your request to join the family was ${decision === 'APPROVE' ? 'approved' : 'declined'}.`,
          data: { familyId: params.id, joinRequestId: joinRequest.id },
        },
      })
    }
  })

  const approved = decision === 'APPROVE'
  return NextResponse.json({
    message: joinRequest.direction === 'KARTA_INVITE'
      ? approved ? 'You have joined the family' : 'Invitation declined'
      : approved ? 'Member added to family' : 'Request rejected',
  })
}
