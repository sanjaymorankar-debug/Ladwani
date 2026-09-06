import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { validateLogin } from '@/lib/auth'
import { POST as postRegister } from '@/app/api/auth/register/route'
import { POST as postLoginCheck } from '@/app/api/auth/login-check/route'
import { jsonReq, UAT_PASSWORD, account } from './helpers'

const NEW = 'tc.auth.new@uat.test'
const DUP_MOBILE = '9800000003' // KARTA-01's mobile

async function cleanupNew() {
  const u = await prisma.user.findFirst({ where: { email: NEW }, include: { member: true } })
  if (!u) return
  await prisma.verificationToken.deleteMany({ where: { userId: u.id } })
  await prisma.consentRecord.deleteMany({ where: { userId: u.id } })
  await prisma.userRole.deleteMany({ where: { userId: u.id } })
  if (u.member) await prisma.member.delete({ where: { id: u.member.id } })
  await prisma.user.delete({ where: { id: u.id } })
}
beforeAll(cleanupNew)
afterAll(cleanupNew)

const base = { firstName: 'New', lastName: 'Signup', password: 'ValidPass123', joinIntent: 'JOIN_EXISTING' }
const register = (body: any) => postRegister(jsonReq('http://x/api/auth/register', 'POST', body))

describe('TC-AUTH — registration', () => {
  it('TC-AUTH-001 new user registration succeeds', async () => {
    const res = await register({ ...base, email: NEW, mobile: '9811110001' })
    expect(res.status).toBe(201)
    const u = await prisma.user.findUniqueOrThrow({ where: { email: NEW }, include: { member: true } })
    expect(u.member).not.toBeNull() // User -> Member created together (spec §9/§32)
  })

  it('TC-AUTH-002 duplicate mobile is rejected', async () => {
    const res = await register({ ...base, email: 'tc.auth.dupmob@uat.test', mobile: DUP_MOBILE })
    expect(res.status).toBe(409)
  })

  it('TC-AUTH-003 duplicate email is rejected', async () => {
    const res = await register({ ...base, email: NEW, mobile: '9811110002' })
    expect(res.status).toBe(409)
  })

  it('TC-AUTH-004 invalid email is rejected', async () => {
    const res = await register({ ...base, email: 'not-an-email', mobile: '9811110003' })
    expect(res.status).toBe(400)
  })

  it('TC-AUTH-005 invalid mobile is rejected', async () => {
    const res = await register({ ...base, email: 'tc.auth.badmob@uat.test', mobile: '12345' })
    expect(res.status).toBe(400)
  })

  it('TC-AUTH-006 weak password is rejected', async () => {
    const res = await register({ ...base, password: 'weak', email: 'tc.auth.weak@uat.test', mobile: '9811110004' })
    expect(res.status).toBe(400)
  })

  it('TC-AUTH-007 password confirmation mismatch is rejected', async () => {
    // The route derives confirmPassword from password, so mismatch is tested
    // at the schema level where the UI enforces it.
    const { registerSchema } = await import('@/lib/validators')
    const parsed = registerSchema.safeParse({
      ...base, email: 'x@uat.test', mobile: '9811110005',
      confirmPassword: 'DifferentPass123', consentAccepted: true,
    })
    expect(parsed.success).toBe(false)
  })

  it('TC-AUTH-008 terms must be accepted', async () => {
    const { registerSchema } = await import('@/lib/validators')
    const parsed = registerSchema.safeParse({
      ...base, email: 'y@uat.test', mobile: '9811110006',
      confirmPassword: base.password, consentAccepted: false,
    })
    expect(parsed.success).toBe(false)
  })
})

describe('TC-LOGIN — authentication', () => {
  it('TC-LOGIN-001 valid credentials succeed', async () => {
    const karta = await account('KARTA-01')
    const res = await validateLogin(karta.email, UAT_PASSWORD)
    expect(res.ok).toBe(true)
  })

  it('TC-LOGIN-002 incorrect password is refused', async () => {
    const karta = await account('KARTA-01')
    expect(await validateLogin(karta.email, 'WrongPass123')).toEqual({ ok: false, code: 'INVALID_CREDENTIALS' })
  })

  it('TC-LOGIN-002b unknown account gives the same generic error (no enumeration)', async () => {
    expect(await validateLogin('nobody@uat.test', 'WrongPass123')).toEqual({ ok: false, code: 'INVALID_CREDENTIALS' })
  })

  it('TC-LOGIN-004 suspended account is refused with a distinct reason', async () => {
    const m = await account('MEMBER-02')
    await prisma.user.update({ where: { id: m.userId }, data: { status: 'SUSPENDED' } })
    const res = await validateLogin(m.email, UAT_PASSWORD)
    await prisma.user.update({ where: { id: m.userId }, data: { status: 'ACTIVE' } })
    expect(res).toEqual({ ok: false, code: 'ACCOUNT_SUSPENDED' })
  })

  it('TC-LOGIN-004b account status is only revealed after a correct password', async () => {
    const m = await account('MEMBER-02')
    await prisma.user.update({ where: { id: m.userId }, data: { status: 'SUSPENDED' } })
    const res = await validateLogin(m.email, 'WrongPass123')
    await prisma.user.update({ where: { id: m.userId }, data: { status: 'ACTIVE', failedAttempts: 0 } })
    expect(res).toEqual({ ok: false, code: 'INVALID_CREDENTIALS' })
  })

  it('TC-LOGIN-003 login-check surfaces a friendly message, not a raw error', async () => {
    const karta = await account('KARTA-01')
    const res = await postLoginCheck(jsonReq('http://x/api/auth/login-check', 'POST', {
      identifier: karta.email, password: 'WrongPass123',
    }) as any)
    expect(res.status).toBe(401)
    expect((await res.json()).message).toMatch(/Incorrect login details/i)
  })

  it('TC-LOGIN-012 brute force locks the account after repeated failures', async () => {
    const m = await account('MEMBER-02')
    await prisma.user.update({ where: { id: m.userId }, data: { failedAttempts: 0, lockedUntil: null } })
    for (let i = 0; i < 5; i++) await validateLogin(m.email, 'WrongPass123')
    const locked = await validateLogin(m.email, UAT_PASSWORD) // correct password, but locked
    await prisma.user.update({ where: { id: m.userId }, data: { failedAttempts: 0, lockedUntil: null } })
    expect(locked).toEqual({ ok: false, code: 'ACCOUNT_LOCKED' })
  })

  it('TC-LOGIN-013 passwords are never stored in plain text', async () => {
    const karta = await account('KARTA-01')
    const u = await prisma.user.findUniqueOrThrow({ where: { id: karta.userId } })
    expect(u.passwordHash).not.toBe(UAT_PASSWORD)
    expect(u.passwordHash.startsWith('$2')).toBe(true) // bcrypt
  })
})
