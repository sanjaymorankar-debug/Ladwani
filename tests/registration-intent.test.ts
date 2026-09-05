import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { mockSessionAs } from './helpers/session'
import { POST as postRegister } from '@/app/api/auth/register/route'
import { POST as postFamilies } from '@/app/api/families/route'

const MOBILE_KARTA = '9990000001'
const MOBILE_JOINER = '9990000002'

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { mobile: { in: [MOBILE_KARTA, MOBILE_JOINER] } },
    include: { member: { include: { families: true } } },
  })
  for (const u of users) {
    const familyIds = u.member?.families.map((f) => f.familyId) ?? []
    await prisma.familyMember.deleteMany({ where: { memberId: u.member?.id } })
    await prisma.userRole.deleteMany({ where: { userId: u.id } })
    await prisma.approval.deleteMany({ where: { submittedBy: u.id } })
    await prisma.auditLog.deleteMany({ where: { actorId: u.id } })
    await prisma.verificationToken.deleteMany({ where: { userId: u.id } })
    await prisma.consentRecord.deleteMany({ where: { userId: u.id } })
    if (familyIds.length) await prisma.family.deleteMany({ where: { id: { in: familyIds } } })
    if (u.member) await prisma.member.delete({ where: { id: u.member.id } })
    await prisma.user.delete({ where: { id: u.id } })
  }
}

beforeAll(cleanup)
afterAll(cleanup)

function req(body: unknown) {
  return new Request('http://x/api/auth/register', { method: 'POST', body: JSON.stringify(body) })
}

const baseBody = {
  firstName: 'Intent',
  lastName: 'Tester',
  password: 'TestPass123',
}

describe('Registration join-intent (spec §2, §7)', () => {
  it('rejects registration with no join choice', async () => {
    const res = await postRegister(req({ ...baseBody, mobile: MOBILE_KARTA }))
    expect(res.status).toBe(400)
  })

  it('rejects an unrecognised join choice', async () => {
    const res = await postRegister(req({ ...baseBody, mobile: MOBILE_KARTA, joinIntent: 'SUPERUSER' }))
    expect(res.status).toBe(400)
  })

  it('stores the KARTA choice but does NOT grant the KARTA role at signup', async () => {
    const res = await postRegister(req({ ...baseBody, mobile: MOBILE_KARTA, joinIntent: 'KARTA' }))
    expect(res.status).toBe(201)

    const user = await prisma.user.findUniqueOrThrow({
      where: { mobile: MOBILE_KARTA },
      include: { userRoles: { include: { role: true } }, member: true },
    })

    // Intent recorded...
    expect(user.joinIntent).toBe('KARTA')
    // ...but the only role granted is MEMBER. Choosing "I am the Karta" in a
    // client-side form must never self-assign a privileged role (spec §37:
    // never trust client-provided roles).
    expect(user.userRoles.map((ur) => ur.role.code)).toEqual(['MEMBER'])
    // And a Member profile exists for them (spec §9, §32).
    expect(user.member).not.toBeNull()
    // Account still needs verification before it can be used (spec §2).
    expect(user.status).toBe('PENDING')
  })

  it('stores the JOIN_EXISTING choice with the same MEMBER-only role', async () => {
    const res = await postRegister(req({ ...baseBody, mobile: MOBILE_JOINER, joinIntent: 'JOIN_EXISTING' }))
    expect(res.status).toBe(201)

    const user = await prisma.user.findUniqueOrThrow({
      where: { mobile: MOBILE_JOINER },
      include: { userRoles: { include: { role: true } } },
    })
    expect(user.joinIntent).toBe('JOIN_EXISTING')
    expect(user.userRoles.map((ur) => ur.role.code)).toEqual(['MEMBER'])
  })

  it('grants the KARTA role only once a family is actually created', async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { mobile: MOBILE_KARTA },
      include: { member: true },
    })

    mockSessionAs({ id: user.id, roles: ['MEMBER'], memberId: user.member!.id, status: 'ACTIVE' })
    const res = await postFamilies(
      new Request('http://x/api/families', {
        method: 'POST',
        body: JSON.stringify({ name: 'IntentTest' }),
      }) as any,
      // route reads only the body/session, params unused for the collection route
    )
    expect(res.status).toBe(201)

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { userRoles: { include: { role: true } }, member: { include: { families: true } } },
    })
    const roleCodes = after.userRoles.map((ur) => ur.role.code).sort()
    expect(roleCodes).toContain('KARTA')
    // The Karta grant is scoped to the family they created, not global.
    const kartaGrant = after.userRoles.find((ur) => ur.role.code === 'KARTA')!
    expect(kartaGrant.familyId).toBe(after.member!.families[0].familyId)
    expect(after.member!.families[0].isKarta).toBe(true)
  })
})
