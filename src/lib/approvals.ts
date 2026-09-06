import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withdrawMatrimonyOnMarriage } from '@/lib/matrimony'

/**
 * Whether an action needs Operator/Admin review before it takes effect.
 * Conservative default: if nobody has configured an ApprovalRule for this
 * actionCode (or it's inactive), require approval — sensitive changes should
 * never silently bypass review just because an admin hasn't gotten around to
 * configuring the rule yet.
 */
export async function requiresApproval(actionCode: string): Promise<boolean> {
  const rule = await prisma.approvalRule.findUnique({ where: { actionCode } })
  if (!rule || !rule.isActive) return true
  return rule.requiresApproval
}

export interface SpouseLinkPayload {
  spouseMemberId?: string | null
  externalSpouseName?: string | null
}

/**
 * Applies a marital-status-to-MARRIED change plus spouse relationship
 * linking. Shared by the direct (approval-not-required) path and by the
 * approvals PATCH route when a queued 'member.marital_status.change' gets
 * approved — the two must produce identical results.
 */
export async function applySpouseLink(
  tx: Prisma.TransactionClient,
  memberId: string,
  payload: SpouseLinkPayload,
  actorId: string,
  approvalId?: string
) {
  const member = await tx.member.findUnique({ where: { id: memberId } })
  if (!member) throw new Error('Member not found')

  await tx.marriageRecord.create({
    data: {
      memberId1: memberId,
      memberId2: payload.spouseMemberId ?? null,
      externalSpouseName: payload.spouseMemberId ? null : payload.externalSpouseName ?? null,
      status: 'MARRIED',
      createdBy: actorId,
    },
  })

  if (payload.spouseMemberId && (member.gender === 'MALE' || member.gender === 'FEMALE')) {
    const ownCode = member.gender === 'MALE' ? 'husband' : 'wife'
    const relType = await tx.relationshipType.findUnique({ where: { code: ownCode } })
    if (relType) {
      await tx.memberRelationship.upsert({
        where: {
          fromMemberId_toMemberId_relationshipTypeId: {
            fromMemberId: memberId,
            toMemberId: payload.spouseMemberId,
            relationshipTypeId: relType.id,
          },
        },
        update: {},
        create: {
          fromMemberId: memberId,
          toMemberId: payload.spouseMemberId,
          relationshipTypeId: relType.id,
          createdBy: actorId,
        },
      })
      if (relType.inverseCode) {
        const inverseType = await tx.relationshipType.findUnique({ where: { code: relType.inverseCode } })
        if (inverseType) {
          await tx.memberRelationship.upsert({
            where: {
              fromMemberId_toMemberId_relationshipTypeId: {
                fromMemberId: payload.spouseMemberId,
                toMemberId: memberId,
                relationshipTypeId: inverseType.id,
              },
            },
            update: {},
            create: {
              fromMemberId: payload.spouseMemberId,
              toMemberId: memberId,
              relationshipTypeId: inverseType.id,
              createdBy: actorId,
            },
          })
        }
      }
    }
  }

  await tx.member.update({ where: { id: memberId }, data: { maritalStatus: 'MARRIED' } })
  await tx.maritalStatusHistory.create({
    data: { memberId, status: 'MARRIED', changedBy: actorId, approvalId: approvalId ?? null },
  })

  if (payload.spouseMemberId) {
    await tx.member.update({ where: { id: payload.spouseMemberId }, data: { maritalStatus: 'MARRIED' } })
    await tx.maritalStatusHistory.create({
      data: { memberId: payload.spouseMemberId, status: 'MARRIED', changedBy: actorId, approvalId: approvalId ?? null },
    })
  }

  // Now married — withdraw them from matrimony rather than relying on anyone
  // remembering to opt out.
  await withdrawMatrimonyOnMarriage(tx, [memberId, payload.spouseMemberId ?? ''])
}

export async function createApprovalRecord(
  tx: Prisma.TransactionClient,
  params: {
    actionCode: string
    entityType: string
    entityId: string
    fieldName?: string
    oldValue?: unknown
    newValue?: unknown
    submittedBy: string
    reason?: string
  }
) {
  return tx.approval.create({
    data: {
      actionCode: params.actionCode,
      entityType: params.entityType,
      entityId: params.entityId,
      fieldName: params.fieldName ?? null,
      oldValue: params.oldValue as any,
      newValue: params.newValue as any,
      status: 'SUBMITTED',
      submittedBy: params.submittedBy,
      reason: params.reason ?? null,
    },
  })
}
