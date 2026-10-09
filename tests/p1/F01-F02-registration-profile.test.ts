import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue({ messageId: 'test' }), otpEmailTemplate: () => ({ subject: 's', html: 'h', text: 't' }), isEmailConfigured: () => true }))

import { prisma } from '@/lib/prisma'
import { p1Fixtures, actAs, json, type Person } from './fixtures'
import { POST as register } from '@/app/api/auth/register/route'
import { POST as verifyOtpRoute } from '@/app/api/auth/verify-otp/route'
import { GET as areas } from '@/app/api/areas/route'
import { PATCH as patchMember } from '@/app/api/members/[id]/route'
import { PUT as putAddress } from '@/app/api/members/[id]/addresses/route'
import { POST as postFamily } from '@/app/api/families/route'
import { POST as postPost } from '@/app/api/posts/route'
import { GET as getVerification } from '@/app/api/verification/route'
import { issueOtp } from '@/lib/otp'
import { isEarning } from '@/lib/occupation'
import { profileCompleteness } from '@/lib/registration'

const fx = p1Fixtures('p1reg')
let geo: Awaited<ReturnType<typeof fx.geography>>
const created: string[] = []

const body = (over: Record<string, unknown> = {}) => ({
  firstName: 'Ravi', lastName: 'Ladwani', email: `p1reg-${Math.random().toString(36).slice(2, 8)}@p0.example.test`,
  password: 'StrongPass123', joinIntent: 'JOIN_EXISTING', gender: 'MALE', dateOfBirth: '1995-03-10',
  mulGaonAreaId: geo.village, ...over,
})
async function signUp(over: Record<string, unknown> = {}) {
  const b = body(over)
  const res = await register(json('http://x/api/auth/register', 'POST', b))
  if (res.status === 201) {
    const u = await prisma.user.findUniqueOrThrow({ where: { email: b.email as string }, include: { member: true } })
    fx.userIds.push(u.id); fx.memberIds.push(u.member!.id); created.push(u.id)
    return { res, user: u, person: { userId: u.id, memberId: u.member!.id, roles: ['MEMBER'] } as Person }
  }
  return { res, user: null, person: null }
}

beforeAll(async () => { geo = await fx.geography() })
afterAll(async () => {
  await prisma.userRole.deleteMany({ where: { userId: { in: created } } })
  await fx.cleanup()
})

describe('F01 User self-registration', () => {
  it('F01 creates a DRAFT account with gender, DOB, Mul Gaon from the location master, and a welcome message', async () => {
    const { res, user } = await signUp({ mobile: '9876512345' })
    expect(res.status).toBe(201)
    expect(user!.status).toBe('DRAFT')
    expect(user!.member).toMatchObject({ gender: 'MALE', nativeVillage: 'p1reg Village', nativeDistrict: 'p1reg District', nativeState: 'p1reg State', mobilePrimary: '9876512345' })
    const home = await prisma.memberArea.findFirstOrThrow({ where: { memberId: user!.member!.id } })
    expect(home).toMatchObject({ areaId: geo.village, isPrimary: true })
    expect(await prisma.notification.count({ where: { recipientId: user!.id, type: 'WELCOME' } })).toBe(1)
  })

  it('F01 under-18 cannot self-register', async () => {
    const tooYoung = new Date(); tooYoung.setFullYear(tooYoung.getFullYear() - 17)
    const { res } = await signUp({ dateOfBirth: tooYoung.toISOString().slice(0, 10) })
    expect(res.status).toBe(400)
    expect((await res.json()).message).toMatch(/18 or older/)
  })

  it('F01 gender, date of birth and Mul Gaon are mandatory; Mul Gaon must be a village under a district', async () => {
    expect((await signUp({ gender: undefined })).res.status).toBe(400)
    expect((await signUp({ dateOfBirth: undefined })).res.status).toBe(400)
    expect((await signUp({ mulGaonAreaId: undefined })).res.status).toBe(400)
    expect((await signUp({ mulGaonAreaId: geo.district })).res.status).toBe(400)
    expect((await signUp({ mulGaonAreaId: 'no-such-area' })).res.status).toBe(400)
  })

  it('F01 mobile and email are unique — one account per person', async () => {
    const first = await signUp({ mobile: '9876512399' })
    expect(first.res.status).toBe(201)
    expect((await signUp({ mobile: '9876512399' })).res.status).toBe(409)
    expect((await signUp({ email: first.user!.email })).res.status).toBe(409)
  })

  it('F01 the location cascade is public and lists only active places under the parent', async () => {
    const res = await areas(new Request(`http://x/api/areas?parentId=${geo.taluka}`))
    expect((await res.json()).areas.map((a: any) => a.name)).toEqual(['p1reg Village'])
  })

  it('F01 OTP verification moves an unverified account to DRAFT; a code dies after 5 wrong guesses', async () => {
    const { user } = await signUp()
    await prisma.user.update({ where: { id: user!.id }, data: { status: 'PENDING' } })
    const { code } = await issueOtp(user!.id, 'EMAIL_VERIFY')
    const ok = await verifyOtpRoute(json('http://x', 'POST', { email: user!.email, otp: code }))
    expect(ok.status).toBe(200)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user!.id } })).status).toBe('DRAFT')

    const second = await issueOtp(user!.id, 'EMAIL_VERIFY')
    for (let i = 0; i < 5; i++) await verifyOtpRoute(json('http://x', 'POST', { email: user!.email, otp: '000000' }))
    const late = await verifyOtpRoute(json('http://x', 'POST', { email: user!.email, otp: second.code }))
    expect(late.status).toBe(400)
  })

  it('F01 an unknown account gets the same answer as a wrong code (no enumeration)', async () => {
    const res = await verifyOtpRoute(json('http://x', 'POST', { email: 'nobody@p0.example.test', otp: '123456' }))
    expect(res.status).toBe(400)
  })

  it('F01 a DRAFT account can only fill its own profile — no family, no posts', async () => {
    const { person } = await signUp()
    actAs(person!)
    expect((await postFamily(json('http://x/api/families', 'POST', { name: 'Nope' }) as any)).status).toBe(403)
    expect((await postPost(json('http://x/api/posts', 'POST', { content: 'hi' }))).status).toBe(403)
    const own = await patchMember(json('http://x', 'PATCH', { biography: 'My story' }), { params: { id: person!.memberId } })
    expect(own.status).toBe(200)
  })
})

describe('F02 Complete personal profile', () => {
  let me: Person
  beforeAll(async () => { me = (await signUp()).person! })

  it('F02 Working needs a source of income, its details and an income band', async () => {
    actAs(me)
    const patch = (b: unknown) => patchMember(json('http://x', 'PATCH', b), { params: { id: me.memberId } })
    expect((await patch({ employmentStatus: 'WORKING', occupation: {} })).status).toBe(400)
    expect((await patch({ employmentStatus: 'WORKING', occupation: { incomeSource: 'SERVICE', serviceType: 'PSU' } })).status).toBe(400) // no employer, no band
    const ok = await patch({
      employmentStatus: 'WORKING', occupation: { incomeSource: 'SERVICE', serviceType: 'PSU', employerName: 'BHEL' },
      profileDetails: { annualIncomeRange: '5L_10L' },
    })
    expect(ok.status).toBe(200)
    const pd = await prisma.memberProfileDetail.findUniqueOrThrow({ where: { memberId: me.memberId } })
    expect(pd).toMatchObject({ incomeSource: 'SERVICE', serviceType: 'PSU', employerName: 'BHEL', annualIncomeRange: '5L_10L' })
    expect(isEarning('WORKING', pd.annualIncomeRange)).toBe(true)
  })

  it('F02 Professional needs a profession; leaving Working clears the occupation details', async () => {
    actAs(me)
    const patch = (b: unknown) => patchMember(json('http://x', 'PATCH', b), { params: { id: me.memberId } })
    expect((await patch({ employmentStatus: 'WORKING', occupation: { incomeSource: 'PROFESSIONAL', profession: 'OTHER' } })).status).toBe(400)
    expect((await patch({ employmentStatus: 'WORKING', occupation: { incomeSource: 'PROFESSIONAL', profession: 'CA' } })).status).toBe(200)
    expect((await patch({ employmentStatus: 'HOMEMAKER' })).status).toBe(200)
    const pd = await prisma.memberProfileDetail.findUniqueOrThrow({ where: { memberId: me.memberId } })
    expect(pd.incomeSource).toBeNull()
    expect(pd.profession).toBeNull()
    expect((await patch({ employmentStatus: 'ASTRONAUT' })).status).toBe(400)
  })

  it('F02 income is stored as a band, never an amount; "prefer not to say" is not earning', async () => {
    expect(isEarning('WORKING', 'NOT_SAY')).toBe(false)
    expect(isEarning('STUDENT', '5L_10L')).toBe(false)
    expect(isEarning('EMPLOYED', '2L_5L')).toBe(true) // older stored value still understood
  })

  it('F02 current address takes its levels from the location master; "same as current" fills the permanent one', async () => {
    actAs(me)
    const cur = await putAddress(json('http://x', 'PUT', { addressType: 'CURRENT', areaId: geo.village, line1: '12 Temple Lane', pincode: '411001' }), { params: { id: me.memberId } })
    expect(cur.status).toBe(200)
    const current = await prisma.address.findFirstOrThrow({ where: { memberId: me.memberId, addressType: 'CURRENT' } })
    expect(current).toMatchObject({ areaId: geo.village, city: 'p1reg Village', taluka: 'p1reg Taluka', district: 'p1reg District', state: 'p1reg State' })

    const perm = await putAddress(json('http://x', 'PUT', { addressType: 'PERMANENT', sameAsCurrent: true }), { params: { id: me.memberId } })
    expect(perm.status).toBe(200)
    expect(await prisma.address.findFirstOrThrow({ where: { memberId: me.memberId, addressType: 'PERMANENT' } }))
      .toMatchObject({ sameAsCurrent: true, line1: '12 Temple Lane', areaId: geo.village, pincode: '411001' })

    // Before approval an address change saves directly (no review queue).
    const again = await putAddress(json('http://x', 'PUT', { addressType: 'CURRENT', areaId: geo.village, line1: '14 Temple Lane' }), { params: { id: me.memberId } })
    expect(again.status).toBe(200)
  })

  it('F02 profile completeness is shown as a percentage with the missing mandatory items', async () => {
    actAs(me)
    const status = await (await getVerification()).json()
    expect(status.status).toBe('DRAFT')
    expect(status.completeness.percent).toBeGreaterThan(0)
    expect(status.completeness.percent).toBeLessThan(100)
    expect(status.completeness.missingMandatory).toContain('ID proof and self-signed copy')
    const c = await profileCompleteness(me.memberId)
    expect(c.items.find((i) => i.key === 'mulGaon')!.done).toBe(true)
  })
})
