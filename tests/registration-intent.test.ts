import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { mockSessionAs } from './helpers/session'
import { POST as postRegister } from '@/app/api/auth/register/route'
import { POST as postFamilies } from '@/app/api/families/route'
import { validateLogin } from '@/lib/auth'

const EMAIL_KARTA = 'intent.karta@example.test'
const EMAIL_JOINER = 'intent.joiner@example.test'
const MOBILE_KARTA = '9990000001'
const MOBILE_JOINER = '9990000002'

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { in: [EMAIL_KARTA, EMAIL_JOINER, 'nomobile@example.test'] } },
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
    const res = await postRegister(req({ ...baseBody, email: EMAIL_KARTA, mobile: MOBILE_KARTA }))
    expect(res.status).toBe(400)
  })

  it('requires an email address (email is now the primary identifier)', async () => {
    const res = await postRegister(req({ ...baseBody, mobile: MOBILE_KARTA, joinIntent: 'KARTA' }))
    expect(res.status).toBe(400)
  })

  it('accepts a signup with no mobile number (mobile is optional)', async () => {
    const res = await postRegister(req({
      ...baseBody, email: 'nomobile@example.test', joinIntent: 'JOIN_EXISTING',
    }))
    expect(res.status).toBe(201)
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'nomobile@example.test' } })
    expect(user.mobile).toBeNull()
    // ...and can sign in with just the email.
    expect((await validateLogin('nomobile@example.test', baseBody.password)).ok).toBe(true)
  })

  it('rejects an unrecognised join choice', async () => {
    const res = await postRegister(req({ ...baseBody, email: EMAIL_KARTA, mobile: MOBILE_KARTA, joinIntent: 'SUPERUSER' }))
    expect(res.status).toBe(400)
  })

  it('stores the KARTA choice but does NOT grant the KARTA role at signup', async () => {
    const res = await postRegister(req({ ...baseBody, email: EMAIL_KARTA, mobile: MOBILE_KARTA, joinIntent: 'KARTA' }))
    expect(res.status).toBe(201)

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: EMAIL_KARTA },
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
    // Verification is currently switched off, so the account is usable right
    // away — no OTP step. (Set NEXT_PUBLIC_AUTH_REQUIRE_VERIFICATION=true to
    // go back to PENDING-until-verified.)
    expect(user.status).toBe('ACTIVE')
  })

  it('lets a brand-new account sign in immediately with no OTP', async () => {
    const result = await validateLogin(EMAIL_KARTA, baseBody.password)
    expect(result.ok).toBe(true)
  })

  it('still rejects a wrong password for a new account', async () => {
    const result = await validateLogin(EMAIL_KARTA, 'WrongPass123')
    expect(result).toEqual({ ok: false, code: 'INVALID_CREDENTIALS' })
  })

  it('stores the JOIN_EXISTING choice with the same MEMBER-only role', async () => {
    const res = await postRegister(req({ ...baseBody, email: EMAIL_JOINER, joinIntent: 'JOIN_EXISTING' }))
    expect(res.status).toBe(201)

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: EMAIL_JOINER },
      include: { userRoles: { include: { role: true } } },
    })
    expect(user.joinIntent).toBe('JOIN_EXISTING')
    expect(user.userRoles.map((ur) => ur.role.code)).toEqual(['MEMBER'])
  })

  it('grants the KARTA role only once a family is actually created', async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: EMAIL_KARTA },
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
