import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

const sendEmail = vi.fn().mockResolvedValue({ messageId: 'test' })
vi.mock('@/lib/email', () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }))

import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { POST as loginCheck } from '@/app/api/auth/login-check/route'
import { verifyOtp, issueOtp, OTP_MAX_ATTEMPTS } from '@/lib/otp'
import { p0Fixtures } from './fixtures'

const fx = p0Fixtures('p0dec')
const PASSWORD = 'Decision@123'
let admin: Awaited<ReturnType<typeof fx.person>>
let member: Awaited<ReturnType<typeof fx.person>>

const authorize = (creds: Record<string, string>) => (authOptions.providers[0] as any).options.authorize(creds)
const jwt = (token: Record<string, unknown>) => authOptions.callbacks!.jwt!({ token, user: undefined } as any)
const check = (identifier: string, password: string) =>
  loginCheck(new Request('http://x/api/auth/login-check', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250)}` },
    body: JSON.stringify({ identifier, password }),
  }) as any)
const lastCode = () => {
  const call = sendEmail.mock.calls.at(-1)![0]
  return /(\d{6})/.exec(call.text)![1]
}

beforeAll(async () => {
  admin = await fx.person('admin', { roles: [{ code: 'ADMIN' }] })
  member = await fx.person('member')
  const passwordHash = await hash(PASSWORD, 4)
  await prisma.user.updateMany({ where: { id: { in: [admin.userId, member.userId] } }, data: { passwordHash } })
})
afterAll(async () => {
  await prisma.verificationToken.deleteMany({ where: { userId: { in: fx.userIds } } })
  await fx.cleanup()
})

describe('F32 Admin 2-factor login', () => {
  const adminEmail = () => `p0dec-admin@p0.example.test`

  it('F32 login-check emails an Admin a 6-digit code instead of letting the password alone through', async () => {
    const res = await check(adminEmail(), PASSWORD)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, otpRequired: true })
    expect(sendEmail.mock.calls.at(-1)![0].to).toBe(adminEmail())
  })

  it('F32 an Admin cannot sign in with the password alone, or with a wrong code', async () => {
    await check(adminEmail(), PASSWORD)
    await expect(authorize({ identifier: adminEmail(), password: PASSWORD })).rejects.toThrow('OTP_REQUIRED')
    await expect(authorize({ identifier: adminEmail(), password: PASSWORD, otp: '000000' })).rejects.toThrow('OTP_INVALID')
  })

  it('F32 password + emailed code signs the Admin in; the code is single-use', async () => {
    await check(adminEmail(), PASSWORD)
    const code = lastCode()
    const user = await authorize({ identifier: adminEmail(), password: PASSWORD, otp: code })
    expect(user.roles).toContain('ADMIN')
    await expect(authorize({ identifier: adminEmail(), password: PASSWORD, otp: code })).rejects.toThrow('OTP_INVALID')
  })

  it('F32 a non-Admin signs in with the password only', async () => {
    const res = await check('p0dec-member@p0.example.test', PASSWORD)
    expect(await res.json()).toEqual({ ok: true })
    const user = await authorize({ identifier: 'p0dec-member@p0.example.test', password: PASSWORD })
    expect(user.id).toBe(member.userId)
  })

  it('OTP codes are burned after the maximum number of wrong guesses', async () => {
    const { code } = await issueOtp(member.userId, 'ADMIN_2FA')
    for (let i = 0; i < OTP_MAX_ATTEMPTS - 1; i++) {
      expect(await verifyOtp(member.userId, 'ADMIN_2FA', '111111')).toEqual({ ok: false, reason: 'INVALID' })
    }
    expect(await verifyOtp(member.userId, 'ADMIN_2FA', '111111')).toEqual({ ok: false, reason: 'TOO_MANY_ATTEMPTS' })
    expect((await verifyOtp(member.userId, 'ADMIN_2FA', code)).ok).toBe(false) // even the right code is now dead
  })
})

describe('Session claims are re-read from the database on every request', () => {
  it('a role granted or revoked after sign-in shows up on the next request', async () => {
    const token = await jwt({ id: member.userId, roles: ['MEMBER'] })
    expect(token.roles).toEqual(['MEMBER'])
    const role = await prisma.role.findUniqueOrThrow({ where: { code: 'NATIONAL_TEAM' } })
    const grant = await prisma.userRole.create({ data: { userId: member.userId, roleId: role.id } })
    expect((await jwt({ id: member.userId, roles: ['MEMBER'] })).roles).toEqual(expect.arrayContaining(['MEMBER', 'NATIONAL_TEAM']))
    await prisma.userRole.delete({ where: { id: grant.id } })
    expect((await jwt({ id: member.userId, roles: ['MEMBER', 'NATIONAL_TEAM'] })).roles).toEqual(['MEMBER'])
  })

  it('a token still claiming ADMIN loses it once the role is gone', async () => {
    const t = await jwt({ id: member.userId, roles: ['ADMIN'] })
    expect(t.roles).not.toContain('ADMIN')
  })

  it('a suspended, blocked or deleted account ends the session', async () => {
    for (const status of ['SUSPENDED', 'BLOCKED', 'DEACTIVATED'] as const) {
      await prisma.user.update({ where: { id: member.userId }, data: { status } })
      await expect(jwt({ id: member.userId, roles: ['MEMBER'] })).rejects.toThrow('ACCOUNT_INACTIVE')
    }
    await prisma.user.update({ where: { id: member.userId }, data: { status: 'ACTIVE', deletedAt: new Date() } })
    await expect(jwt({ id: member.userId })).rejects.toThrow('ACCOUNT_INACTIVE')
    await prisma.user.update({ where: { id: member.userId }, data: { deletedAt: null } })
    await expect(jwt({ id: 'no-such-user' })).rejects.toThrow('ACCOUNT_INACTIVE')
    expect((await jwt({ id: member.userId })).status).toBe('ACTIVE')
  })
})
