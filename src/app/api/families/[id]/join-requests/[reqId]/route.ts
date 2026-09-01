import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageFamily } from '@/lib/family-auth'

export async function PATCH(req: Request, { params }: { params: { id: string; reqId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  if (!(await canManageFamily(session, params.id))) {
    return NextResponse.json({ message: "Only this family's Karta can respond to join requests" }, { status: 403 })
  }

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
        action: `family.join_request.${decision.toLowerCase()}`,
        entityType: 'family_join_request',
        entityId: joinRequest.id,
      },
    })
  })

  return NextResponse.json({
    message: decision === 'APPROVE' ? 'Member added to family' : 'Request rejected',
  })
}
