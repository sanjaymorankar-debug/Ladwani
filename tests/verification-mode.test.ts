import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { prisma } from '@/lib/prisma'

/**
 * The rest of the suite runs with verification OFF (see .env.test), which is
 * the current default. This file covers the opposite setting — the one that's
 * live in dev once SMTP is configured — so both modes are protected.
 *
 * auth-config reads the flag once at module load, so the modules under test
 * are re-imported after stubbing the env var.
 */
const EMAIL = 'verify.mode@example.test'

async function cleanup() {
  const u = await prisma.user.findUnique({ where: { email: EMAIL }, include: { member: true } })
  if (!u) return
  await prisma.verificationToken.deleteMany({ where: { userId: u.id } })
  await prisma.consentRecord.deleteMany({ where: { userId: u.id } })
  await prisma.userRole.deleteMany({ where: { userId: u.id } })
  if (u.member) await prisma.member.delete({ where: { id: u.member.id } })
  await prisma.user.delete({ where: { id: u.id } })
}

beforeAll(cleanup)
afterAll(async () => {
  await cleanup()
  vi.unstubAllEnvs()
})

describe('With email verification switched ON', () => {
  it('creates the account PENDING, issues an EMAIL_VERIFY code, and refuses login until verified', async () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_REQUIRE_VERIFICATION', 'true')
    vi.resetModules()

    // Don't hit a real mail server from the test suite.
    vi.doMock('@/lib/email', () => ({
      sendEmail: vi.fn().mockResolvedValue({ messageId: 'test' }),
      otpEmailTemplate: () => ({ subject: 's', html: 'h', text: 't' }),
      isEmailConfigured: () => true,
    }))

    const { POST: postRegister } = await import('@/app/api/auth/register/route')
    const { validateLogin } = await import('@/lib/auth')

    const res = await postRegister(
      new Request('http://x/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Verify', lastName: 'Mode', email: EMAIL,
          password: 'TestPass123', joinIntent: 'JOIN_EXISTING',
        }),
      })
    )
    expect(res.status).toBe(201)
    expect((await res.json()).requiresVerification).toBe(true)

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: EMAIL },
      include: { verificationTokens: true },
    })

    // Account is parked until the code is entered...
    expect(user.status).toBe('PENDING')
    expect(user.emailVerified).toBe(false)
    // ...a code was issued, for email (not mobile)...
    expect(user.verificationTokens).toHaveLength(1)
    expect(user.verificationTokens[0].type).toBe('EMAIL_VERIFY')
    // ...and it's stored hashed, never in plain text.
    expect(user.verificationTokens[0].tokenHash).not.toMatch(/^\d{6}$/)

    // ...and login is refused with the spec's wording (§36).
    expect(await validateLogin(EMAIL, 'TestPass123')).toEqual({ ok: false, code: 'ACCOUNT_PENDING' })

    vi.doUnmock('@/lib/email')
  })
})
