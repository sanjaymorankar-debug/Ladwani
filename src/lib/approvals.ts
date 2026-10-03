import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withdrawMatrimonyOnMarriage } from '@/lib/matrimony'
import { UNMARRIED_FLOW_RESET } from '@/lib/profile-details'

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

  // The Unmarried-only profile answers (earning / studying / looking for
  // marriage) no longer apply once married.
  await tx.memberProfileDetail.updateMany({
    where: { memberId: { in: [memberId, payload.spouseMemberId ?? ''] } },
    data: UNMARRIED_FLOW_RESET,
  })
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

// ─────────────────────────────────────────────────────────────────
// §28 gates: deceased status, Karta change, address change.
// Each apply* function is shared by the direct path (no approval needed) and
// by the approvals PATCH route when a queued request is approved, so the two
// always produce identical results.
// ─────────────────────────────────────────────────────────────────

export interface DeceasedPayload {
  deceasedAt: string
  deceasedPlace?: string | null
  deceasedNotes?: string | null
}

export async function applyMarkDeceased(tx: Prisma.TransactionClient, memberId: string, payload: DeceasedPayload, actorId: string) {
  const member = await tx.member.update({
    where: { id: memberId },
    data: {
      status: 'DECEASED',
      deceasedAt: new Date(payload.deceasedAt),
      deceasedPlace: payload.deceasedPlace || null,
      deceasedNotes: payload.deceasedNotes || null,
    },
  })

  // The tree keeps them (history matters); but a deceased person must not
  // stay listed for matrimony, and a login for them must stop working.
  await tx.matrimonialProfile.updateMany({ where: { memberId, isVisible: true }, data: { isVisible: false } })
  if (member.userId) {
    await tx.user.update({ where: { id: member.userId }, data: { status: 'DEACTIVATED' } })
  }

  // A surviving, currently-married spouse becomes WIDOWED.
  const marriages = await tx.marriageRecord.findMany({
    where: { status: 'MARRIED', OR: [{ memberId1: memberId }, { memberId2: memberId }] },
  })
  for (const m of marriages) {
    await tx.marriageRecord.update({ where: { id: m.id }, data: { status: 'WIDOWED' } })
    const spouseId = m.memberId1 === memberId ? m.memberId2 : m.memberId1
    if (spouseId) {
      await tx.member.update({ where: { id: spouseId }, data: { maritalStatus: 'WIDOWED' } })
      await tx.maritalStatusHistory.create({ data: { memberId: spouseId, status: 'WIDOWED', changedBy: actorId } })
    }
  }
}

export interface KartaChangePayload {
  familyId: string
  newKartaMemberId: string
}

export async function applyKartaChange(tx: Prisma.TransactionClient, payload: KartaChangePayload, actorId: string) {
  const family = await tx.family.findUnique({ where: { id: payload.familyId } })
  if (!family) throw new Error('Family not found')

  const target = await tx.familyMember.findUnique({
    where: { familyId_memberId: { familyId: payload.familyId, memberId: payload.newKartaMemberId } },
    include: { member: true },
  })
  if (!target || target.leftAt) throw new Error('The new Karta must be an active member of this family')
  if (!target.member.userId) throw new Error('The new Karta must have their own login account')

  const kartaRole = await tx.role.findUnique({ where: { code: 'KARTA' } })

  // Previous Karta(s): drop the flag and their family-scoped Karta role.
  const previous = await tx.familyMember.findMany({
    where: { familyId: payload.familyId, isKarta: true, memberId: { not: payload.newKartaMemberId } },
    include: { member: { select: { userId: true } } },
  })
  for (const p of previous) {
    await tx.familyMember.update({ where: { id: p.id }, data: { isKarta: false } })
    if (kartaRole && p.member.userId) {
      await tx.userRole.deleteMany({ where: { userId: p.member.userId, roleId: kartaRole.id, familyId: payload.familyId } })
    }
  }

  await tx.familyMember.update({ where: { id: target.id }, data: { isKarta: true } })
  await tx.family.update({ where: { id: payload.familyId }, data: { kartaMemberId: payload.newKartaMemberId, updatedBy: actorId } })
  if (kartaRole) {
    const exists = await tx.userRole.findFirst({
      where: { userId: target.member.userId!, roleId: kartaRole.id, familyId: payload.familyId },
    })
    if (!exists) {
      await tx.userRole.create({
        data: { userId: target.member.userId!, roleId: kartaRole.id, familyId: payload.familyId, grantedBy: actorId },
      })
    }
  }
}

export interface AddressChangePayload {
  addressType: 'CURRENT' | 'NATIVE'
  line1?: string | null
  line2?: string | null
  city?: string | null
  district?: string | null
  state?: string | null
  country?: string | null
  pincode?: string | null
  // Only touched when present, so the older address editor (which doesn't
  // send them) never wipes a geo-tag.
  taluka?: string | null
  latitude?: number | null
  longitude?: number | null
}

/** Upserts the member's CURRENT or NATIVE address and syncs the flat Member fields. */
export async function applyAddressChange(tx: Prisma.TransactionClient, memberId: string, p: AddressChangePayload) {
  const data = {
    line1: p.line1 || null,
    line2: p.line2 || null,
    city: p.city || null,
    district: p.district || null,
    state: p.state || null,
    country: p.country || 'India',
    pincode: p.pincode || null,
    ...(p.taluka !== undefined ? { taluka: p.taluka || null } : {}),
    ...(p.latitude !== undefined ? { latitude: p.latitude ?? null } : {}),
    ...(p.longitude !== undefined ? { longitude: p.longitude ?? null } : {}),
    isPrimary: p.addressType === 'CURRENT',
  }
  const existing = await tx.address.findFirst({ where: { memberId, addressType: p.addressType } })
  const address = existing
    ? await tx.address.update({ where: { id: existing.id }, data })
    : await tx.address.create({ data: { ...data, addressableType: 'member', memberId, addressType: p.addressType } })

  await tx.member.update({
    where: { id: memberId },
    data: p.addressType === 'CURRENT'
      ? { currentCity: data.city, currentState: data.state, currentCountry: data.country }
      : { nativeVillage: data.city, nativeDistrict: data.district, nativeState: data.state },
  })
  return address
}

export type AddressChangeResult =
  | { status: 'applied'; address: Awaited<ReturnType<typeof applyAddressChange>> }
  | { status: 'pending' }
  | { status: 'already_pending' }

/**
 * Saves a member's CURRENT or NATIVE address the way §28 requires: first-time
 * entry is direct; changing an address already on record is queued for
 * review unless staff make the change; a pending request blocks a second.
 * Shared by the address editor and the Edit Profile form.
 */
export async function submitAddressChange(
  tx: Prisma.TransactionClient,
  opts: { memberId: string; payload: AddressChangePayload; isStaff: boolean; submittedBy: string }
): Promise<AddressChangeResult> {
  const { memberId, payload, isStaff, submittedBy } = opts
  const existing = await tx.address.findFirst({ where: { memberId, addressType: payload.addressType } })

  if (existing && !isStaff && (await requiresApproval('member.address.change'))) {
    const pending = await tx.approval.findFirst({
      where: { actionCode: 'member.address.change', entityId: memberId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
    })
    if (pending) return { status: 'already_pending' }
    await createApprovalRecord(tx, {
      actionCode: 'member.address.change', entityType: 'member', entityId: memberId,
      fieldName: payload.addressType,
      oldValue: {
        line1: existing.line1, line2: existing.line2, city: existing.city, taluka: existing.taluka,
        state: existing.state, pincode: existing.pincode, latitude: existing.latitude, longitude: existing.longitude,
      },
      newValue: payload, submittedBy,
    })
    return { status: 'pending' }
  }

  return { status: 'applied', address: await applyAddressChange(tx, memberId, payload) }
}
