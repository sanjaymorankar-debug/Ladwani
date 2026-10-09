import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'
import { mergePersons } from '@/lib/merge'

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
 * (target). Target's own values win; claimant fills its blanks. See merge.ts.
 */
export async function mergeClaim(claimId: string, actorId: string) {
  const claim = await prisma.profileClaim.findUniqueOrThrow({ where: { id: claimId } })
  const C = claim.claimantMemberId
  const T = claim.targetMemberId
  const target = await prisma.member.findUniqueOrThrow({ where: { id: T }, select: { userId: true } })

  await prisma.$transaction(async (tx) => {
    // The Karta-created record (with its family links) is kept; the
    // registration record folds into it and its login moves across.
    await mergePersons(tx, T, C, actorId)
    // Account-less invitations for the target are moot now that it has a login.
    await tx.memberInvitation.updateMany({ where: { memberId: T, status: 'PENDING' }, data: { status: 'REVOKED', revokedAt: new Date(), revokedBy: actorId } })

    await tx.profileClaim.update({ where: { id: claim.id }, data: { status: 'CONFIRMED', decidedBy: actorId, decidedAt: new Date() } })
    await recordAudit({
      actorId, action: 'member.claim.merge', entityType: 'member', entityId: T,
      oldValue: { userId: target.userId, claimantMemberId: C },
      newValue: { userId: claim.userId, mergedFrom: C },
      metadata: { claimId: claim.id, familyId: claim.familyId },
    }, undefined, tx)
  })
  return { memberId: T }
}
