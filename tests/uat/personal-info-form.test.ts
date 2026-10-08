import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { PATCH as patchMember } from '@/app/api/members/[id]/route'
import { GET as getProfileDetails } from '@/app/api/members/[id]/profile-details/route'
import { PATCH as patchApproval } from '@/app/api/approvals/[id]/route'
import { EMPTY_PROFILE_DETAILS, EMPTY_ADDRESS } from '@/lib/profile-details'
import { account, actAs, jsonReq } from './helpers'

// Personal-information form: marital status branches, the Unmarried toggle
// flow, geo-tagged address and validation — all through the real API route.

const nextYear = String(new Date().getFullYear() + 1)

async function resetMember(memberId: string, maritalStatus: 'UNMARRIED' | 'MARRIED' = 'UNMARRIED') {
  await prisma.memberProfileDetail.deleteMany({ where: { memberId } })
  await prisma.address.deleteMany({ where: { memberId, addressType: 'CURRENT' } })
  await prisma.approval.deleteMany({ where: { actionCode: 'member.address.change', entityId: memberId } })
  await prisma.member.update({ where: { id: memberId }, data: { maritalStatus } })
}

const patch = (memberId: string, body: Record<string, unknown>) =>
  patchMember(jsonReq('http://x', 'PATCH', body) as any, { params: { id: memberId } })

const details = (memberId: string) => prisma.memberProfileDetail.findUnique({ where: { memberId } })

async function asSelf(label: string) {
  const acc = await account(label)
  actAs({ userId: acc.userId, roles: acc.roles, memberId: acc.memberId })
  return acc
}

describe('TC-PIF — personal information form', () => {
  let unmarriedId = ''
  let marriedId = ''

  beforeEach(async () => {
    unmarriedId = (await account('MEMBER-02')).memberId
    marriedId = (await account('KARTA-02')).memberId
    await resetMember(unmarriedId, 'UNMARRIED')
    await prisma.memberProfileDetail.deleteMany({ where: { memberId: marriedId } })
  })

  afterAll(async () => {
    await resetMember(unmarriedId, 'UNMARRIED')
    await prisma.memberProfileDetail.deleteMany({ where: { memberId: marriedId } })
  })

  it('TC-PIF-001 an existing record with no details loads as empty fields and still saves', async () => {
    await asSelf('MEMBER-02')
    const res = await getProfileDetails(new Request('http://x') as any, { params: { id: unmarriedId } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.details).toBeNull()
    expect(body.currentAddress).toBeNull()

    // A legacy-style save without any of the new fields works exactly as before.
    const save = await patch(unmarriedId, { biography: 'Hello' })
    expect(save.status).toBe(200)
    expect(await details(unmarriedId)).toBeNull()
  })

  it('TC-PIF-002 Married: common fields saved, Unmarried-only fields ignored', async () => {
    await asSelf('KARTA-02')
    const res = await patch(marriedId, {
      maritalStatus: 'MARRIED',
      profileDetails: {
        ...EMPTY_PROFILE_DETAILS,
        educationLevel: 'PROFESSIONAL', educationStream: 'Chartered Accountancy', educationInstitution: 'ICAI',
        annualIncomeRange: '10L_20L',
        // A stale client sending Unmarried answers for a married member:
        isEarning: true, earningType: 'JOB', companyName: 'Acme', readyForMarriage: true,
      },
    })
    expect(res.status).toBe(200)
    const d = await details(marriedId)
    expect(d).toMatchObject({ educationLevel: 'PROFESSIONAL', educationStream: 'Chartered Accountancy', annualIncomeRange: '10L_20L' })
    expect(d).toMatchObject({ isEarning: false, earningType: null, companyName: null, readyForMarriage: false })
  })

  it('TC-PIF-003 Unmarried + studying: course details saved', async () => {
    await asSelf('MEMBER-02')
    const res = await patch(unmarriedId, {
      maritalStatus: 'UNMARRIED',
      profileDetails: {
        ...EMPTY_PROFILE_DETAILS, educationLevel: 'HIGHER_SECONDARY',
        isPursuingEducation: true, currentCourse: 'B.Sc Physics', currentInstitution: 'Fergusson College', expectedCompletionYear: nextYear,
      },
    })
    expect(res.status).toBe(200)
    expect(await details(unmarriedId)).toMatchObject({
      isPursuingEducation: true, currentCourse: 'B.Sc Physics', currentInstitution: 'Fergusson College',
      expectedCompletionYear: Number(nextYear), isEarning: false,
    })
  })

  it('TC-PIF-004 Unmarried + job, ready and looking for marriage: everything saved', async () => {
    await asSelf('MEMBER-02')
    const res = await patch(unmarriedId, {
      profileDetails: {
        ...EMPTY_PROFILE_DETAILS,
        isEarning: true, earningType: 'JOB', companyName: 'Infosys', designation: 'Engineer', jobSector: 'PRIVATE',
        readyForMarriage: true, lookingForMarriage: true,
        marriageHeightCm: '172', motherTongue: 'Marathi', nativePlace: 'Satara', partnerExpectations: 'Educated, family-oriented',
      },
    })
    expect(res.status).toBe(200)
    expect(await details(unmarriedId)).toMatchObject({
      isEarning: true, earningType: 'JOB', companyName: 'Infosys', designation: 'Engineer', jobSector: 'PRIVATE',
      readyForMarriage: true, lookingForMarriage: true, marriageHeightCm: 172, motherTongue: 'Marathi',
      nativePlace: 'Satara', partnerExpectations: 'Educated, family-oriented', businessName: null,
    })
  })

  it('TC-PIF-005 Unmarried + business: business saved, job fields never stored', async () => {
    await asSelf('MEMBER-02')
    const res = await patch(unmarriedId, {
      profileDetails: {
        ...EMPTY_PROFILE_DETAILS,
        isEarning: true, earningType: 'BUSINESS', businessName: 'Sharma Traders', businessType: 'Retail',
        companyName: 'should be dropped',
      },
    })
    expect(res.status).toBe(200)
    expect(await details(unmarriedId)).toMatchObject({
      earningType: 'BUSINESS', businessName: 'Sharma Traders', businessType: 'Retail', companyName: null,
    })
  })

  it('TC-PIF-006 conditional required fields are enforced on the server', async () => {
    await asSelf('MEMBER-02')
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ isPursuingEducation: true }, /course/i],
      [{ isEarning: true }, /Job or Business/],
      [{ isEarning: true, earningType: 'JOB' }, /Company name/],
      [{ isEarning: true, earningType: 'BUSINESS' }, /Business name/],
      [{ educationLevel: 'OTHER' }, /describe/],
      [{ educationLevel: 'NOT_A_LEVEL' }, /education level/],
    ]
    for (const [over, msg] of cases) {
      const res = await patch(unmarriedId, { profileDetails: { ...EMPTY_PROFILE_DETAILS, ...over } })
      expect(res.status).toBe(400)
      expect((await res.json()).message).toMatch(msg)
    }
    expect(await details(unmarriedId)).toBeNull()
  })

  describe('switching toggles off after data was entered', () => {
    const full = {
      ...EMPTY_PROFILE_DETAILS,
      isPursuingEducation: true, currentCourse: 'MBA', currentInstitution: 'SIBM', expectedCompletionYear: nextYear,
      isEarning: true, earningType: 'JOB', companyName: 'TCS', designation: 'Analyst', jobSector: 'PRIVATE',
      readyForMarriage: true, lookingForMarriage: true, marriageHeightCm: '165', motherTongue: 'Hindi',
      nativePlace: 'Nagpur', partnerExpectations: 'Kind',
    }

    beforeEach(async () => {
      await asSelf('MEMBER-02')
      expect((await patch(unmarriedId, { profileDetails: full })).status).toBe(200)
    })

    it('TC-PIF-007 Pursuing education off clears the course fields', async () => {
      await patch(unmarriedId, { profileDetails: { ...full, isPursuingEducation: false } })
      const d = await details(unmarriedId)
      expect(d).toMatchObject({ isPursuingEducation: false, currentCourse: null, currentInstitution: null, expectedCompletionYear: null })
      expect(d!.companyName).toBe('TCS')
    })

    it('TC-PIF-008 Earning off clears job and the whole marriage chain', async () => {
      await patch(unmarriedId, { profileDetails: { ...full, isEarning: false } })
      expect(await details(unmarriedId)).toMatchObject({
        isEarning: false, earningType: null, companyName: null, designation: null, jobSector: null,
        readyForMarriage: false, lookingForMarriage: false, marriageHeightCm: null, motherTongue: null,
        nativePlace: null, partnerExpectations: null, currentCourse: 'MBA',
      })
    })

    it('TC-PIF-009 Ready for marriage off clears Looking for marriage and its details', async () => {
      await patch(unmarriedId, { profileDetails: { ...full, readyForMarriage: false } })
      expect(await details(unmarriedId)).toMatchObject({
        isEarning: true, companyName: 'TCS', readyForMarriage: false, lookingForMarriage: false,
        marriageHeightCm: null, motherTongue: null, nativePlace: null, partnerExpectations: null,
      })
    })

    it('TC-PIF-010 Looking for marriage off clears only the marriage details', async () => {
      await patch(unmarriedId, { profileDetails: { ...full, lookingForMarriage: false } })
      expect(await details(unmarriedId)).toMatchObject({
        readyForMarriage: true, lookingForMarriage: false, marriageHeightCm: null, motherTongue: null,
      })
    })

    it('TC-PIF-011 Job → Business clears the job fields', async () => {
      await patch(unmarriedId, { profileDetails: { ...full, earningType: 'BUSINESS', businessName: 'Cafe' } })
      expect(await details(unmarriedId)).toMatchObject({ earningType: 'BUSINESS', businessName: 'Cafe', companyName: null, designation: null, jobSector: null })
    })

    it('TC-PIF-012 changing marital status away from Unmarried clears the Unmarried flow', async () => {
      // Even when the client only sends the status change.
      expect((await patch(unmarriedId, { maritalStatus: 'WIDOWED' })).status).toBe(200)
      expect(await details(unmarriedId)).toMatchObject({
        isEarning: false, isPursuingEducation: false, currentCourse: null, companyName: null,
        readyForMarriage: false, lookingForMarriage: false, motherTongue: null,
      })
      await prisma.member.update({ where: { id: unmarriedId }, data: { maritalStatus: 'UNMARRIED' } })
    })

    it('TC-PIF-013 becoming Married through the spouse flow clears the Unmarried flow', async () => {
      const { applySpouseLink } = await import('@/lib/approvals')
      const acc = await account('MEMBER-02')
      await prisma.$transaction((tx) => applySpouseLink(tx, unmarriedId, { externalSpouseName: 'Test Spouse' }, acc.userId))
      expect(await details(unmarriedId)).toMatchObject({ isEarning: false, companyName: null, currentCourse: null })
      await prisma.marriageRecord.deleteMany({ where: { memberId1: unmarriedId } })
      await prisma.maritalStatusHistory.deleteMany({ where: { memberId: unmarriedId } })
    })
  })

  it('TC-PIF-014 address with geo-tag: first entry saves directly; a change is queued for review', async () => {
    await asSelf('MEMBER-02')
    const first = {
      ...EMPTY_ADDRESS, line1: '4 Shivaji Road', line2: 'Kothrud', city: 'Pune', taluka: 'Haveli',
      district: 'Pune', state: 'Maharashtra', pincode: '411038', latitude: 18.507399, longitude: 73.807648,
    }
    const res = await patch(unmarriedId, { currentAddress: first })
    expect(res.status).toBe(200)
    expect((await res.json()).addressStatus).toBe('applied')
    const saved = await prisma.address.findFirstOrThrow({ where: { memberId: unmarriedId, addressType: 'CURRENT' } })
    expect(saved).toMatchObject({ line2: 'Kothrud', taluka: 'Haveli', latitude: 18.507399, longitude: 73.807648 })
    const m = await prisma.member.findUniqueOrThrow({ where: { id: unmarriedId } })
    expect(m.currentCity).toBe('Pune') // flat copy kept in sync, as before

    // Re-saving the same address is a no-op, not a review request.
    expect((await (await patch(unmarriedId, { currentAddress: first })).json()).addressStatus).toBe('unchanged')

    // Moving the pin is a change, gated like any address change (§28).
    const moved = await patch(unmarriedId, { currentAddress: { ...first, latitude: 18.51, longitude: 73.81 } })
    expect((await moved.json()).addressStatus).toBe('pending')
    const approval = await prisma.approval.findFirstOrThrow({
      where: { actionCode: 'member.address.change', entityId: unmarriedId, status: 'SUBMITTED' },
    })

    const operator = await account('OPERATOR-01')
    actAs({ userId: operator.userId, roles: operator.roles, memberId: operator.memberId })
    const approved = await patchApproval(jsonReq('http://x', 'PATCH', { action: 'approve' }) as any, { params: { id: approval.id } })
    expect(approved.status).toBe(200)
    expect(await prisma.address.findFirstOrThrow({ where: { memberId: unmarriedId, addressType: 'CURRENT' } }))
      .toMatchObject({ latitude: 18.51, longitude: 73.81, taluka: 'Haveli' })
  })

  it('TC-PIF-015 an address without location (permission denied) saves fine', async () => {
    await asSelf('MEMBER-02')
    const res = await patch(unmarriedId, { currentAddress: { ...EMPTY_ADDRESS, city: 'Pune', pincode: '411001' } })
    expect(res.status).toBe(200)
    expect(await prisma.address.findFirstOrThrow({ where: { memberId: unmarriedId, addressType: 'CURRENT' } }))
      .toMatchObject({ city: 'Pune', latitude: null, longitude: null })
  })

  it('TC-PIF-016 rejects bad PIN code, coordinates, mobile and missing name', async () => {
    await asSelf('MEMBER-02')
    const bad: [Record<string, unknown>, RegExp][] = [
      [{ currentAddress: { ...EMPTY_ADDRESS, pincode: '12345' } }, /PIN/],
      [{ currentAddress: { ...EMPTY_ADDRESS, latitude: 95, longitude: 73 } }, /Latitude/],
      [{ currentAddress: { ...EMPTY_ADDRESS, latitude: 18, longitude: 200 } }, /Longitude/],
      [{ currentAddress: { ...EMPTY_ADDRESS, latitude: 18, longitude: null } }, /together/],
      [{ mobilePrimary: '12345' }, /mobile/],
      [{ firstName: ' ' }, /name/i],
      [{ maritalStatus: 'ENGAGED' }, /Marital status/],
    ]
    for (const [body, msg] of bad) {
      const res = await patch(unmarriedId, body)
      expect(res.status).toBe(400)
      expect((await res.json()).message).toMatch(msg)
    }
  })

  it('TC-PIF-017 profile details are private to people who may edit the member', async () => {
    await asSelf('MEMBER-01')
    const res = await getProfileDetails(new Request('http://x') as any, { params: { id: unmarriedId } })
    expect(res.status).toBe(403)
  })
})
