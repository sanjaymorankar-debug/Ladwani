import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'

/**
 * F17 — claim a non-login profile. A registered user finds a record a Karta
 * created for them (name + DOB, or mobile), says "This is me", the Karta of
 * that family confirms, and the two records merge: the Karta-created profile
 * (with all its family links) gets the login, and everything the user entered
 * at registration moves onto it. One person = one record (rule 1).
 */

/** Account-less profiles that look like the signed-in user. */
export async function claimMatches(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { mobile: true, member: { select: { id: true, firstName: true, lastName: true, dateOfBirth: true, mobilePrimary: true } } },
  })
  const me = user.member
  if (!me) return []
  const mobile = user.mobile ?? me.mobilePrimary
  const or: any[] = []
  if (me.firstName && me.lastName && me.dateOfBirth) {
    or.push({ firstName: me.firstName, lastName: me.lastName, dateOfBirth: me.dateOfBirth })
  }
  if (mobile) or.push({ mobilePrimary: mobile })
  if (!or.length) return []
  const rows = await prisma.member.findMany({
    where: {
      id: { not: me.id }, userId: null, deletedAt: null, status: 'ACTIVE', OR: or,
      families: { some: { leftAt: null } },
    },
    select: {
      id: true, firstName: true, lastName: true, dateOfBirth: true, nativeVillage: true,
      families: { where: { leftAt: null }, select: { family: { select: { id: true, name: true } } } },
    },
    take: 5,
  })
  // Limited view: name, birth year, Mul Gaon and family names only.
  return rows.map((r) => ({
    memberId: r.id,
    name: [r.firstName, r.lastName].filter(Boolean).join(' '),
    birthYear: r.dateOfBirth ? r.dateOfBirth.getFullYear() : null,
    mulGaon: r.nativeVillage,
    families: r.families.map((f) => f.family),
  }))
}

/**
 * Merges the registration record (claimant) into the Karta-created one
 * (target). Target's own values win; claimant fills its blanks. Every row that
 * points at the claimant is moved; the claimant is retired (soft-deleted).
 */
export async function mergeClaim(claimId: string, actorId: string) {
  const claim = await prisma.profileClaim.findUniqueOrThrow({ where: { id: claimId } })
  const [c, t] = await Promise.all([
    prisma.member.findUniqueOrThrow({ where: { id: claim.claimantMemberId } }),
    prisma.member.findUniqueOrThrow({ where: { id: claim.targetMemberId } }),
  ])
  const C = c.id
  const T = t.id

  await prisma.$transaction(async (tx) => {
    // The login moves first (members.userId is unique).
    await tx.member.update({ where: { id: C }, data: { userId: null, deletedAt: new Date(), status: 'INACTIVE', profilePhotoId: null } })

    const fill = <K extends keyof typeof t>(k: K, empty: unknown = null) =>
      (t[k] === null || t[k] === empty) && c[k] !== null && c[k] !== empty ? { [k]: c[k] } : {}
    await tx.member.update({
      where: { id: T },
      data: {
        userId: claim.userId,
        ...fill('gender', 'NOT_STATED'), ...fill('dateOfBirth'), ...fill('mobilePrimary'), ...fill('email'),
        ...fill('nativeVillage'), ...fill('nativeDistrict'), ...fill('nativeState'), ...fill('middleName'),
        ...fill('employmentStatus'), ...fill('currentCity'), ...fill('currentState'), ...fill('profilePhotoId'),
        updatedBy: actorId,
      },
    })

    // Mul Gaon / areas
    const tAreas = await tx.memberArea.findMany({ where: { memberId: T } })
    for (const a of await tx.memberArea.findMany({ where: { memberId: C } })) {
      await tx.memberArea.delete({ where: { memberId_areaId: { memberId: C, areaId: a.areaId } } })
      if (!tAreas.some((x) => x.areaId === a.areaId)) {
        await tx.memberArea.create({ data: { memberId: T, areaId: a.areaId, isPrimary: a.isPrimary && !tAreas.some((x) => x.isPrimary) } })
      }
    }
    // Addresses: one per type; the target keeps any it already has.
    const tTypes = new Set((await tx.address.findMany({ where: { memberId: T }, select: { addressType: true } })).map((a) => a.addressType))
    for (const a of await tx.address.findMany({ where: { memberId: C } })) {
      if (tTypes.has(a.addressType)) await tx.address.delete({ where: { id: a.id } })
      else await tx.address.update({ where: { id: a.id }, data: { memberId: T } })
    }
    // Profile details: one row per member.
    const tDetails = await tx.memberProfileDetail.findUnique({ where: { memberId: T } })
    if (tDetails) await tx.memberProfileDetail.deleteMany({ where: { memberId: C } })
    else await tx.memberProfileDetail.updateMany({ where: { memberId: C }, data: { memberId: T } })
    // Plain child rows move across.
    await tx.educationRecord.updateMany({ where: { memberId: C }, data: { memberId: T } })
    await tx.employmentRecord.updateMany({ where: { memberId: C }, data: { memberId: T } })
    await tx.business.updateMany({ where: { memberId: C }, data: { memberId: T } })
    await tx.idProof.updateMany({ where: { memberId: C }, data: { memberId: T } })
    await tx.photo.updateMany({ where: { memberId: C }, data: { memberId: T } })
    await tx.approvalTask.updateMany({ where: { subjectMemberId: C }, data: { subjectMemberId: T } })
    await tx.profileChangeRequest.updateMany({ where: { memberId: C }, data: { memberId: T } })
    await tx.memberFieldVisibility.deleteMany({ where: { memberId: C } })
    const tSkills = new Set((await tx.memberSkill.findMany({ where: { memberId: T }, select: { skillId: true } })).map((s) => s.skillId))
    for (const s of await tx.memberSkill.findMany({ where: { memberId: C } })) {
      await tx.memberSkill.delete({ where: { memberId_skillId: { memberId: C, skillId: s.skillId } } })
      if (!tSkills.has(s.skillId)) await tx.memberSkill.create({ data: { memberId: T, skillId: s.skillId, level: s.level } })
    }
    // Family memberships the claimant gained after registering.
    const tFamilies = new Set((await tx.familyMember.findMany({ where: { memberId: T }, select: { familyId: true } })).map((f) => f.familyId))
    for (const fm of await tx.familyMember.findMany({ where: { memberId: C } })) {
      if (tFamilies.has(fm.familyId)) await tx.familyMember.update({ where: { id: fm.id }, data: { leftAt: new Date(), leftReason: 'MERGED', status: 'ENDED', isKarta: false } })
      else await tx.familyMember.update({ where: { id: fm.id }, data: { memberId: T } })
    }
    await tx.familyJoinRequest.updateMany({ where: { memberId: C }, data: { memberId: T } })
    // Account-less invitations for the target are moot now that it has a login.
    await tx.memberInvitation.updateMany({ where: { memberId: T, status: 'PENDING' }, data: { status: 'REVOKED', revokedAt: new Date(), revokedBy: actorId } })

    await tx.profileClaim.update({ where: { id: claim.id }, data: { status: 'CONFIRMED', decidedBy: actorId, decidedAt: new Date() } })
    await recordAudit({
      actorId, action: 'member.claim.merge', entityType: 'member', entityId: T,
      oldValue: { userId: t.userId, claimantMemberId: C },
      newValue: { userId: claim.userId, mergedFrom: C },
      metadata: { claimId: claim.id, familyId: claim.familyId },
    }, undefined, tx)
  })
  return { memberId: T }
}
