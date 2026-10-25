import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/email', async (importOriginal) => ({ ...(await importOriginal<object>()), sendEmail: vi.fn().mockResolvedValue({ messageId: 'test' }) }))

import { prisma } from '@/lib/prisma'
import { p0Fixtures } from '../p0/fixtures'
import { actAs } from '../p1/fixtures'
import { resetRateLimits, LIMITS } from '@/lib/rate-limit'
import { POST as register } from '@/app/api/auth/register/route'
import { POST as resetPassword } from '@/app/api/auth/reset-password/route'
import { POST as verifyOtp } from '@/app/api/auth/verify-otp/route'
import { GET as search } from '@/app/api/search/route'
import { GET as directory } from '@/app/api/directory/route'

const fx = p0Fixtures('p6h')
type Person = Awaited<ReturnType<typeof fx.person>>
let a: Person, b: Person

const post = (body: unknown, ip: string) => new Request('http://x', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip, 'user-agent': 'vitest' }, body: JSON.stringify(body),
})
const statuses = async (n: number, call: (i: number) => Promise<Response>) => {
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push((await call(i)).status)
  return out
}

beforeAll(async () => {
  a = await fx.person('a', { roles: [{ code: 'MEMBER' }] })
  b = await fx.person('b', { roles: [{ code: 'MEMBER' }] })
})
beforeEach(() => resetRateLimits())
afterAll(async () => {
  await prisma.verificationToken.deleteMany({ where: { userId: { in: fx.userIds } } })
  await fx.cleanup()
})

describe('P6 hardening: rate limits', () => {
  it('P6 sign-up: 20 an hour from one address, then 429 with Retry-After; another address is unaffected', async () => {
    // Invalid bodies (400) still count: the limit runs before anything else.
    const first = await statuses(LIMITS.register.max, () => register(post({}, '198.51.100.1')))
    expect(new Set(first)).toEqual(new Set([400]))
    const blocked = await register(post({}, '198.51.100.1'))
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0)
    expect((await register(post({}, '198.51.100.2'))).status).toBe(400)
  })

  it('P6 password reset: 5 code guesses per account in 15 minutes, whatever the address', async () => {
    const email = 'p6h-a@p0.example.test'
    expect((await resetPassword(post({ email, step: 'request' }, '198.51.100.3'))).status).toBe(200)
    const guesses = await statuses(LIMITS.resetConfirm.max, (i) => resetPassword(post({ email, step: 'confirm', otp: '000000', newPassword: 'NewPass@123' }, `198.51.100.${10 + i}`)))
    expect(new Set(guesses)).toEqual(new Set([400]))
    expect((await resetPassword(post({ email, step: 'confirm', otp: '000001', newPassword: 'NewPass@123' }, '198.51.100.99'))).status).toBe(429)
  })

  it('P6 password reset: 5 codes sent per account an hour; an unknown account is limited the same way (no enumeration)', async () => {
    for (const email of [`p6h-b@p0.example.test`, 'nobody-p6h@example.test']) {
      const sent = await statuses(LIMITS.resetRequest.max, () => resetPassword(post({ email, step: 'request' }, '198.51.100.4')))
      expect(new Set(sent)).toEqual(new Set([200]))
      expect((await resetPassword(post({ email, step: 'request' }, '198.51.100.5'))).status).toBe(429)
    }
  })

  it('P6 sign-up code: 10 guesses per account in 15 minutes', async () => {
    const tries = await statuses(LIMITS.otpVerify.max, () => verifyOtp(post({ email: 'nobody-otp@example.test', otp: '123456' }, '198.51.100.6')))
    expect(new Set(tries)).toEqual(new Set([400]))
    expect((await verifyOtp(post({ email: 'NOBODY-otp@example.test', otp: '123456' }, '198.51.100.7'))).status).toBe(429)
  })

  it('P6 search and directory: 60 a minute per signed-in user, shared between them; other users are unaffected', async () => {
    actAs(a)
    const ok = await statuses(LIMITS.search.max, (i) => (i % 2 ? search(new Request('http://x/api/search?q=zz')) : directory(new Request('http://x/api/directory'))))
    expect(ok.every((s) => s !== 429)).toBe(true)
    expect((await search(new Request('http://x/api/search?q=zz'))).status).toBe(429)
    actAs(b)
    expect((await search(new Request('http://x/api/search?q=zz'))).status).not.toBe(429)
  })
})

describe('P6 hardening: Content-Security-Policy', () => {
  it('P6 pages carry a CSP that blocks other sites\' scripts, plugins, framing and <base>; API routes do not', async () => {
    // next.config.js is CommonJS; load it the way Next does.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require('../../next.config.js')
    const rules: { source: string; headers: { key: string; value: string }[] }[] = await config.headers()
    const csp = rules.flatMap((r) => r.headers.map((h) => ({ source: r.source, ...h }))).find((h) => h.key === 'Content-Security-Policy')!
    expect(csp).toBeTruthy()
    for (const d of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "connect-src 'self'"]) {
      expect(csp.value).toContain(d)
    }
    expect(csp.value).not.toMatch(/script-src[^;]*https?:/) // no outside script hosts
    const pages = new RegExp(`^${csp.source}$`)
    expect(pages.test('/dashboard')).toBe(true)
    expect(pages.test('/')).toBe(true)
    expect(pages.test('/api/members/x/death-certificate')).toBe(false)
  })
})
