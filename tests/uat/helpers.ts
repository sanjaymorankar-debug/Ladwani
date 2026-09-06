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
