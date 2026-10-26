import { vi } from 'vitest'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

export const UAT_PASSWORD = 'TestPass@123'

/** Loads a seeded UAT account by its label, with everything the tests need. */
export async function account(label: string) {
  const member = await prisma.member.findUniqueOrThrow({
    where: { memberNumber: `UAT-${label}` },
    include: {
      user: { include: { userRoles: { include: { role: true } } } },
      families: true,
    },
  })
  return {
    memberId: member.id,
    userId: member.user!.id,
    email: member.user!.email!,
    roles: member.user!.userRoles.map((ur) => ur.role.code),
    familyId: member.families[0]?.familyId ?? null,
    isKarta: member.families[0]?.isKarta ?? false,
  }
}

export async function bareMember(label: string) {
  return prisma.member.findUniqueOrThrow({ where: { memberNumber: `UAT-${label}` } })
}

export async function familyByReg(regNo: string) {
  return prisma.family.findUniqueOrThrow({ where: { registrationNumber: regNo } })
}

/** Simulates being signed in as the given seeded account. */
export function actAs(acc: { userId: string; roles: string[]; memberId: string | null }) {
  ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: acc.userId, roles: acc.roles, memberId: acc.memberId, status: 'ACTIVE', email: null },
    expires: new Date(Date.now() + 86400000).toISOString(),
  })
}

export function anonymous() {
  ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null)
}

export function jsonReq(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

/**
 * Marriage bureau (workbook rules, F37/F38): make a seeded member eligible —
 * earning (Working + an income band) and, unless `listed: false`, listed.
 * Returns a function that puts back exactly what was there before, so other
 * test files see the seed state unchanged.
 */
export async function bureauReady(memberId: string, opts: { listed?: boolean } = {}) {
  const before = await prisma.member.findUniqueOrThrow({
    where: { id: memberId },
    select: { employmentStatus: true, profileDetails: { select: { annualIncomeRange: true } }, matrimonialProfile: { select: { id: true, isVisible: true } } },
  })
  await prisma.member.update({ where: { id: memberId }, data: { employmentStatus: 'WORKING' } })
  await prisma.memberProfileDetail.upsert({
    where: { memberId }, update: { annualIncomeRange: '5L_10L' }, create: { memberId, annualIncomeRange: '5L_10L' },
  })
  if (opts.listed !== false) {
    await prisma.matrimonialProfile.upsert({ where: { memberId }, update: { isVisible: true }, create: { memberId, isVisible: true, about: 'UAT profile' } })
  }
  return async () => {
    await prisma.member.update({ where: { id: memberId }, data: { employmentStatus: before.employmentStatus } })
    if (before.profileDetails) await prisma.memberProfileDetail.update({ where: { memberId }, data: { annualIncomeRange: before.profileDetails.annualIncomeRange } })
    else await prisma.memberProfileDetail.deleteMany({ where: { memberId } })
    if (before.matrimonialProfile) await prisma.matrimonialProfile.update({ where: { memberId }, data: { isVisible: before.matrimonialProfile.isVisible } })
    else {
      const p = await prisma.matrimonialProfile.findUnique({ where: { memberId } })
      if (p) {
        await prisma.matrimonialInterest.deleteMany({ where: { OR: [{ fromMemberId: memberId }, { toMemberId: memberId }] } })
        await prisma.matrimonialPreference.deleteMany({ where: { matrimonialProfileId: p.id } })
        await prisma.matrimonialProfile.delete({ where: { id: p.id } })
      }
    }
  }
}
