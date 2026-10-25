import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { genderedCode } from '@/lib/relations'
import { canManageFamily } from '@/lib/family-auth'
import { roleGenderError, joinRequestExpired } from '@/lib/family-rules'
import { recordAudit } from '@/lib/audit'

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
  // F15: an unanswered request lapses after the expiry window (default 30 days).
  if (await joinRequestExpired(joinRequest.createdAt)) {
    await prisma.familyJoinRequest.update({ where: { id: joinRequest.id }, data: { status: 'EXPIRED' } })
    return NextResponse.json({ message: 'This request has expired. Ask the person to send a new one.' }, { status: 409 })
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

  // F15 (owner's decision): turning down a request to join gives a reason.
  // Someone declining an invitation they received need not explain.
  if (decision === 'REJECT' && joinRequest.direction !== 'KARTA_INVITE' && !String(body.note ?? '').trim()) {
    return NextResponse.json({ message: 'Give a reason for rejecting the request' }, { status: 400 })
  }

  // F15: on accept the Karta may correct the claimed relationship role.
  let roleCode = joinRequest.relationshipTypeCode
  let relativeTo = joinRequest.relatedToMemberId
  if (decision === 'APPROVE' && joinRequest.direction === 'MEMBER_REQUEST' && (body.relationshipTypeCode || body.relatedToMemberId)) {
    roleCode = body.relationshipTypeCode ?? roleCode
    relativeTo = body.relatedToMemberId ?? relativeTo
    const person = await prisma.member.findUnique({ where: { id: joinRequest.memberId }, select: { gender: true } })
    const genderError = await roleGenderError(roleCode, person?.gender)
    if (genderError) return NextResponse.json({ message: genderError }, { status: 400 })
    if (relativeTo && !(await prisma.familyMember.findFirst({ where: { familyId: params.id, memberId: relativeTo, leftAt: null } }))) {
      return NextResponse.json({ message: 'The person this relationship is relative to is not in this family' }, { status: 400 })
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.familyJoinRequest.update({
      where: { id: joinRequest.id },
      data: {
        status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        respondedBy: session.user.id,
        respondedAt: new Date(),
        responseNote: body.note ?? null,
        relationshipTypeCode: roleCode,
        relatedToMemberId: relativeTo,
      },
    })

    if (decision === 'APPROVE') {
      // Rule 1: membership of other families is fine. A row from an earlier
      // stay in this family (removed / ended) is re-activated.
      const previous = await tx.familyMember.findUnique({
        where: { familyId_memberId: { familyId: params.id, memberId: joinRequest.memberId } },
      })

      if (!previous || previous.leftAt) {
        const data = {
          joinedBy: session.user.id, joinedAt: new Date(), leftAt: null, leftReason: null, status: 'ACTIVE',
          relationshipRole: roleCode, relativeToMemberId: relativeTo,
        }
        if (previous) await tx.familyMember.update({ where: { id: previous.id }, data })
        else await tx.familyMember.create({ data: { familyId: params.id, memberId: joinRequest.memberId, ...data } })

        if (relativeTo && roleCode) {
          const relType = await tx.relationshipType.findUnique({ where: { code: roleCode } })
          if (relType) {
            await tx.memberRelationship.upsert({
              where: { fromMemberId_toMemberId_relationshipTypeId: { fromMemberId: joinRequest.memberId, toMemberId: relativeTo, relationshipTypeId: relType.id } },
              update: { isActive: true, familyId: params.id },
              create: {
                fromMemberId: joinRequest.memberId,
                toMemberId: relativeTo,
                relationshipTypeId: relType.id,
                familyId: params.id,
                createdBy: session.user.id,
              },
            })
            if (relType.inverseCode) {
              const relativeGender = (await tx.member.findUnique({ where: { id: relativeTo }, select: { gender: true } }))?.gender
              const inverseType = await tx.relationshipType.findUnique({ where: { code: genderedCode(relType.inverseCode, relativeGender) } })
              if (inverseType) {
                await tx.memberRelationship.upsert({
                  where: { fromMemberId_toMemberId_relationshipTypeId: { fromMemberId: relativeTo, toMemberId: joinRequest.memberId, relationshipTypeId: inverseType.id } },
                  update: { isActive: true, familyId: params.id },
                  create: {
                    fromMemberId: relativeTo,
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

    await recordAudit({
      actorId: session.user.id,
      action: joinRequest.direction === 'KARTA_INVITE'
        ? `family.invite.${decision === 'APPROVE' ? 'accept' : 'decline'}`
        : `family.join_request.${decision.toLowerCase()}`,
      entityType: 'family_join_request', entityId: joinRequest.id,
      oldValue: { status: 'PENDING', relationshipTypeCode: joinRequest.relationshipTypeCode, relatedToMemberId: joinRequest.relatedToMemberId },
      newValue: { status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', direction: joinRequest.direction, relationshipTypeCode: roleCode, relatedToMemberId: relativeTo, note: body.note ?? null },
    }, req, tx)

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
