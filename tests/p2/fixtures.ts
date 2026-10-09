import { prisma } from '@/lib/prisma'
import { p1Fixtures, type Person } from '../p1/fixtures'

export { actAs, json } from '../p1/fixtures'
export type { Person }

/** P1 fixtures plus families with a Karta, members and their roles. */
export function p2Fixtures(prefix: string) {
  const base = p1Fixtures(prefix)
  const familyIds: string[] = []

  /** ACTIVE adult with a login (default DOB 1990-01-15, from the P0 fixture). */
  async function adult(tag: string, opts: { gender?: 'MALE' | 'FEMALE'; dob?: string; villageId?: string; roles?: { code: string; areaId?: string | null }[] } = {}) {
    const p = await base.person(tag, { roles: opts.roles })
    await prisma.member.update({
      where: { id: p.memberId },
      data: { gender: opts.gender ?? 'MALE', ...(opts.dob ? { dateOfBirth: new Date(opts.dob) } : {}) },
    })
    if (opts.villageId) await prisma.memberArea.create({ data: { memberId: p.memberId, areaId: opts.villageId, isPrimary: true } })
    return p
  }

  /** A non-login member (child, elder) created by a Karta. */
  async function profile(tag: string, opts: { gender?: 'MALE' | 'FEMALE'; dob?: string; mobile?: string } = {}) {
    const p = await base.person(tag, { login: false })
    await prisma.member.update({
      where: { id: p.memberId },
      data: { gender: opts.gender ?? 'MALE', mobilePrimary: opts.mobile ?? null, ...(opts.dob ? { dateOfBirth: new Date(opts.dob) } : {}) },
    })
    return p
  }

  async function family(name: string, karta: Person, members: { p: Person; role: string; relativeTo?: Person }[] = [], opts: { villageId?: string; gotra?: string; nativeVillage?: string } = {}) {
    const fam = await prisma.family.create({
      data: {
        registrationNumber: `${prefix}-${name}`.toUpperCase(), name, surname: name, status: 'ACTIVE',
        kartaMemberId: karta.memberId, gotra: opts.gotra ?? null, nativeVillage: opts.nativeVillage ?? null,
      },
    })
    familyIds.push(fam.id)
    await prisma.familyMember.create({ data: { familyId: fam.id, memberId: karta.memberId, isKarta: true, relationshipRole: 'karta' } })
    const kartaRole = await prisma.role.findUniqueOrThrow({ where: { code: 'KARTA' } })
    if (karta.userId) await prisma.userRole.create({ data: { userId: karta.userId, roleId: kartaRole.id, familyId: fam.id } })
    for (const m of members) {
      await prisma.familyMember.create({
        data: { familyId: fam.id, memberId: m.p.memberId, relationshipRole: m.role, relativeToMemberId: (m.relativeTo ?? karta).memberId },
      })
    }
    if (opts.villageId) await prisma.familyArea.create({ data: { familyId: fam.id, areaId: opts.villageId, isPrimary: true } })
    return fam.id
  }

  async function cleanup() {
    const allFamilies = Array.from(new Set([
      ...familyIds,
      ...(await prisma.familyMember.findMany({ where: { memberId: { in: base.memberIds } }, select: { familyId: true } })).map((f) => f.familyId),
    ]))
    const famMemberIds = (await prisma.familyMember.findMany({ where: { familyId: { in: allFamilies } }, select: { memberId: true } })).map((f) => f.memberId)
    const extraMembers = famMemberIds.filter((id) => !base.memberIds.includes(id))
    base.memberIds.push(...extraMembers) // new-borns and members added through the API
    await prisma.profileClaim.deleteMany({ where: { OR: [{ familyId: { in: allFamilies } }, { userId: { in: base.userIds } }] } })
    await prisma.kartaTransfer.deleteMany({ where: { familyId: { in: allFamilies } } })
    await prisma.approval.deleteMany({ where: { entityId: { in: [...allFamilies, ...base.memberIds] } } })
    await prisma.familyJoinRequest.deleteMany({ where: { familyId: { in: allFamilies } } })
    await prisma.memberRelationship.deleteMany({ where: { OR: [{ fromMemberId: { in: base.memberIds } }, { toMemberId: { in: base.memberIds } }] } })
    await prisma.maritalStatusHistory.deleteMany({ where: { memberId: { in: base.memberIds } } })
    await prisma.marriageRecord.deleteMany({ where: { OR: [{ memberId1: { in: base.memberIds } }, { memberId2: { in: base.memberIds } }] } })
    await prisma.familyArea.deleteMany({ where: { familyId: { in: allFamilies } } })
    await prisma.familyMember.deleteMany({ where: { OR: [{ familyId: { in: allFamilies } }, { memberId: { in: base.memberIds } }] } })
    await prisma.userRole.deleteMany({ where: { familyId: { in: allFamilies } } })
    await prisma.feeInvoice.deleteMany({ where: { familyId: { in: allFamilies } } })
    await prisma.auditLog.deleteMany({ where: { entityId: { in: [...allFamilies, ...base.memberIds] } } })
    await prisma.family.deleteMany({ where: { id: { in: allFamilies } } })
    await prisma.consentRecord.deleteMany({ where: { userId: { in: base.userIds } } })
    await base.cleanup()
  }

  return { ...base, adult, profile, family, cleanup, familyIds }
}
