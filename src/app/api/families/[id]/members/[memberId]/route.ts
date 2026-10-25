import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { genderedCode } from '@/lib/relations'
import { getFamilyAccess } from '@/lib/family-auth'
import { recordAudit } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'
import { roleGenderError, operatorCoversFamily, kartaUserIdOf } from '@/lib/family-rules'

/**
 * F11 DELETE — Karta removes a member. Only that membership ends (status
 * REMOVED, reason kept); the person record and their other families stay.
 * A Karta cannot remove themself without first handing over (F16).
 *
 * F18 PATCH — change a member's role in this family (or set it). Allowed for
 * the Karta, an Admin, or an Operator mapped to the family's district, who
 * must give a remark. Audited; the Karta and the member are told.
 */
const REASONS = ['WRONGLY_ADDED', 'MOVED_OUT', 'DUPLICATE']

export async function DELETE(req: Request, props: { params: Promise<{ id: string; memberId: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const access = await getFamilyAccess(session, params.id)
  if (!access.isKarta && !access.isStaff) return NextResponse.json({ message: "Only this family's Karta can remove a member" }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  if (!REASONS.includes(body.reason)) {
    return NextResponse.json({ message: 'Choose a reason: wrongly added, moved out or duplicate' }, { status: 400 })
  }
  const membership = await prisma.familyMember.findUnique({
    where: { familyId_memberId: { familyId: params.id, memberId: params.memberId } },
    include: { member: { select: { userId: true, firstName: true } }, family: { select: { name: true } } },
  })
  if (!membership || membership.leftAt) return NextResponse.json({ message: 'That person is not a member of this family' }, { status: 404 })
  if (membership.isKarta) {
    return NextResponse.json({ message: 'The Karta cannot be removed. Hand the Karta role to another member first.' }, { status: 409 })
  }

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.familyMember.update({
      where: { id: membership.id },
      data: { leftAt: now, leftReason: body.reason, status: 'REMOVED' },
    })
    // History is kept: this family's relationship rows for the person are
    // deactivated, not deleted.
    await tx.memberRelationship.updateMany({
      where: { familyId: params.id, OR: [{ fromMemberId: params.memberId }, { toMemberId: params.memberId }] },
      data: { isActive: false },
    })
    await recordAudit({
      actorId: session.user.id, actorRole: access.isStaff ? 'ADMIN' : 'KARTA', action: 'family.member.remove',
      entityType: 'family_member', entityId: membership.id,
      oldValue: { status: membership.status, leftAt: null }, newValue: { status: 'REMOVED', leftAt: now, leftReason: body.reason },
      metadata: { familyId: params.id, memberId: params.memberId },
    }, req, tx)
  })

  if (membership.member.userId) {
    await notifyUser({
      userId: membership.member.userId, type: 'FAMILY_MEMBERSHIP', title: `You were removed from the ${membership.family.name} family`,
      body: 'Your other family memberships and your profile are unchanged.', data: { familyId: params.id },
    })
  }
  return NextResponse.json({ message: 'Member removed from this family' })
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string; memberId: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const roles = ((session.user as any).roles ?? []) as string[]
  const access = await getFamilyAccess(session, params.id)
  const isOperator = !access.isKarta && !access.isStaff && (await operatorCoversFamily(session.user.id, roles, params.id))
  if (!access.isKarta && !access.isStaff && !isOperator) {
    return NextResponse.json({ message: 'Only the Karta, an Admin or an Operator of this district can change a role' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const remark = typeof body.remark === 'string' ? body.remark.trim() : ''
  if (isOperator && remark.length < 5) return NextResponse.json({ message: 'A remark is required (at least 5 characters)' }, { status: 400 })

  const membership = await prisma.familyMember.findUnique({
    where: { familyId_memberId: { familyId: params.id, memberId: params.memberId } },
    include: { member: { select: { userId: true, gender: true, firstName: true } }, family: { select: { name: true } } },
  })
  if (!membership || membership.leftAt) return NextResponse.json({ message: 'That person is not a member of this family' }, { status: 404 })
  if (membership.isKarta) return NextResponse.json({ message: "The Karta's role is changed by handing over the Karta role (F16)" }, { status: 409 })

  const role = String(body.relationshipRole ?? '')
  const genderError = await roleGenderError(role, membership.member.gender)
  if (!role || genderError) return NextResponse.json({ message: genderError ?? 'Choose a relationship role' }, { status: 400 })
  const relativeTo = String(body.relativeToMemberId ?? '')
  const relative = relativeTo ? await prisma.familyMember.findFirst({ where: { familyId: params.id, memberId: relativeTo, leftAt: null } }) : null
  if (!relative || relativeTo === params.memberId) return NextResponse.json({ message: 'Choose who in this family the role is relative to' }, { status: 400 })

  const type = (await prisma.relationshipType.findUnique({ where: { code: role } }))!
  const relativeGender = (await prisma.member.findUnique({ where: { id: relativeTo }, select: { gender: true } }))?.gender
  const inverse = type.inverseCode ? await prisma.relationshipType.findUnique({ where: { code: genderedCode(type.inverseCode, relativeGender) } }) : null
  const old = { relationshipRole: membership.relationshipRole, relativeToMemberId: membership.relativeToMemberId }

  await prisma.$transaction(async (tx) => {
    await tx.familyMember.update({ where: { id: membership.id }, data: { relationshipRole: role, relativeToMemberId: relativeTo } })
    // "Change or add a role": the new relationship is recorded; when it
    // replaces the old one, the old link in this family is deactivated.
    if (body.addRole !== true && old.relativeToMemberId) {
      await tx.memberRelationship.updateMany({
        where: { familyId: params.id, OR: [
          { fromMemberId: params.memberId, toMemberId: old.relativeToMemberId },
          { fromMemberId: old.relativeToMemberId, toMemberId: params.memberId },
        ] },
        data: { isActive: false },
      })
    }
    const link = async (from: string, to: string, typeId: string) => tx.memberRelationship.upsert({
      where: { fromMemberId_toMemberId_relationshipTypeId: { fromMemberId: from, toMemberId: to, relationshipTypeId: typeId } },
      update: { isActive: true, familyId: params.id },
      create: { fromMemberId: from, toMemberId: to, relationshipTypeId: typeId, familyId: params.id, createdBy: session.user!.id as string },
    })
    await link(params.memberId, relativeTo, type.id)
    if (inverse) await link(relativeTo, params.memberId, inverse.id)
    await recordAudit({
      actorId: session.user!.id as string, actorRole: isOperator ? 'OPERATOR' : access.isStaff ? 'ADMIN' : 'KARTA',
      action: 'family.member.role_change', entityType: 'family_member', entityId: membership.id,
      oldValue: old, newValue: { relationshipRole: role, relativeToMemberId: relativeTo },
      metadata: { familyId: params.id, memberId: params.memberId, remark: remark || null, addRole: body.addRole === true },
    }, req, tx)
  })

  // F18 alert: the Karta and the member.
  const recipients = new Set([await kartaUserIdOf(params.id), membership.member.userId].filter((id): id is string => !!id && id !== session.user!.id))
  for (const userId of recipients) {
    await notifyUser({
      userId, type: 'FAMILY_ROLE', title: `Role updated in the ${membership.family.name} family`,
      body: `${membership.member.firstName} is now recorded as "${type.label}".${remark ? ` Remark: ${remark}` : ''}`,
      data: { familyId: params.id, memberId: params.memberId },
    })
  }
  return NextResponse.json({ message: 'Role updated' })
}
