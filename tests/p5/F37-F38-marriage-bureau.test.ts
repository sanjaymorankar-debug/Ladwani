import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue({ messageId: 'test' }) }))

import { prisma } from '@/lib/prisma'
import { p5Fixtures, actAs, json, type Person } from './fixtures'
import { GET as list, POST as createProfile } from '@/app/api/matrimony/profiles/route'
import { GET as getProfile, PATCH as patchProfile } from '@/app/api/matrimony/profiles/[id]/route'
import { GET as mine } from '@/app/api/matrimony/profiles/mine/route'
import { GET as interests, POST as sendInterest } from '@/app/api/matrimony/interests/route'
import { PATCH as answer } from '@/app/api/matrimony/interests/[id]/route'
import { PATCH as patchMember } from '@/app/api/members/[id]/route'

const fx = p5Fixtures('p5m')
let geo: Awaited<ReturnType<typeof fx.geography>>
let groomK: Person, groom: Person, brideK: Person, bride: Person, viewer: Person, young: Person
let groomProfile: string, brideProfile: string

const setRules = (on: boolean) => prisma.setting.upsert({
  where: { key: 'bureau.workbook_rules' }, update: { value: on ? 'true' : 'false' },
  create: { key: 'bureau.workbook_rules', value: on ? 'true' : 'false' },
})
async function profileFor(p: Person, extra: object = {}) {
  actAs(p)
  const { profileId } = await (await createProfile(json('http://x', 'POST', { about: 'Hello', heightCm: 170, contactPreference: 'BOTH', ...extra }))).json()
  return profileId as string
}
const toggle = (as: Person, id: string, on: boolean) => { actAs(as); return patchProfile(json('http://x', 'PATCH', { isVisible: on }), { params: { id } }) }
const earning = (p: Person) => prisma.member.update({
  where: { id: p.memberId },
  data: { employmentStatus: 'WORKING', profileDetails: { upsert: { create: { annualIncomeRange: '5L_10L' }, update: { annualIncomeRange: '5L_10L' } } } },
})

beforeAll(async () => {
  geo = await fx.geography()
  groomK = await fx.adult('gk', { dob: '1965-01-01', villageId: geo.village })
  groom = await fx.adult('g', { dob: '1995-01-01', villageId: geo.village })
  brideK = await fx.adult('bk', { dob: '1968-01-01', villageId: geo.village2 })
  bride = await fx.adult('b', { gender: 'FEMALE', dob: '1997-01-01', villageId: geo.village2 })
  viewer = await fx.adult('v', { dob: '1990-01-01' })
  young = await fx.adult('y', { dob: `${new Date().getFullYear() - 20}-01-01` })
  await fx.family('Groom', groomK, [{ p: groom, role: 'son' }], { gotra: 'Kashyap' })
  await fx.family('Bride', brideK, [{ p: bride, role: 'daughter' }], { gotra: 'Kashyap' })
  await setRules(true) // the workbook rules are the default (owner's decision)
})
afterAll(async () => { await setRules(true); await fx.cleanup() })

describe('F37 Opt in / out of the marriage bureau', () => {
  it('F37 legal age: a man under 21 cannot register', async () => {
    actAs(young)
    const res = await createProfile(json('http://x', 'POST', {}))
    expect(res.status).toBe(403)
    expect((await res.json()).message).toMatch(/legal age/)
  })

  it('F37 extra details are validated; opting in tells the Karta of the family', async () => {
    await earning(groom)
    actAs(groom)
    expect((await createProfile(json('http://x', 'POST', { heightCm: 20 }))).status).toBe(400)
    groomProfile = await profileFor(groom, { horoscope: 'Mesh rashi', expectations: 'Educated' })
    expect((await toggle(groom, groomProfile, true)).status).toBe(200)
    expect(await prisma.notification.count({ where: { recipientId: groomK.userId, type: 'BUREAU_LISTED' } })).toBe(1)
    expect(await prisma.matrimonialProfile.findUniqueOrThrow({ where: { id: groomProfile } })).toMatchObject({ horoscope: 'Mesh rashi', contactPreference: 'BOTH' })
  })

  it('F37 workbook rules: only unmarried AND earning members may list; the reason is shown instead of the toggle', async () => {
    actAs(bride)
    const m = await (await mine()).json()
    expect(m.eligibility).toMatchObject({ ok: false })
    expect(m.eligibility.reason).toMatch(/earning/)
    actAs(bride)
    expect((await createProfile(json('http://x', 'POST', {}))).status).toBe(403)
    await earning(bride)
    brideProfile = await profileFor(bride)
    expect((await toggle(bride, brideProfile, true)).status).toBe(200)
    // Divorced is not allowed under the workbook rules (OP-08 assumption).
    await prisma.member.update({ where: { id: viewer.memberId }, data: { maritalStatus: 'DIVORCED' } })
    await earning(viewer)
    actAs(viewer)
    expect((await createProfile(json('http://x', 'POST', {}))).status).toBe(403)
    await prisma.member.update({ where: { id: viewer.memberId }, data: { maritalStatus: 'UNMARRIED' } })
  })

  it('F37 a status that cannot be listed takes the listing down automatically', async () => {
    const other = await fx.adult('sep', { dob: '1992-01-01' })
    await earning(other)
    const id = await profileFor(other)
    await toggle(other, id, true)
    actAs(other)
    const me = await prisma.member.update({ where: { id: other.memberId }, data: { firstName: 'Sepa' } })
    expect((await patchMember(json('http://x', 'PATCH', { firstName: me.firstName, gender: me.gender, maritalStatus: 'SEPARATED' }), { params: { id: other.memberId } })).status).toBe(200)
    expect((await prisma.matrimonialProfile.findUniqueOrThrow({ where: { id } })).isVisible).toBe(false)
  })
})

describe('F38 Browse and express interest', () => {
  it('F38 the list and the profile show no contact details; income is a band; same-Gotra matches are flagged', async () => {
    actAs(bride)
    const res = await (await list(json('http://x/api/matrimony/profiles?gotra=Kashyap', 'GET'))).json()
    const card = res.profiles.find((p: any) => p.memberId === groom.memberId)
    expect(card).toMatchObject({ sameGotra: true, gotra: 'Kashyap' })
    const text = JSON.stringify(res)
    expect(text).not.toMatch(/mobilePrimary|"email"|"mobile"|dateOfBirth|bloodGroup|memberNumber/)
    actAs(bride)
    const detail = JSON.stringify(await (await getProfile(json('http://x', 'GET'), { params: { id: groomProfile } })).json())
    expect(detail).not.toMatch(/mobilePrimary|"email"|"mobile"|dateOfBirth/)
    await earning(groom)
    actAs(bride)
    const banded = await (await list(json(`http://x/api/matrimony/profiles?district=${geo.district}`, 'GET'))).json()
    expect(banded.profiles.find((p: any) => p.memberId === groom.memberId)).toMatchObject({ incomeBand: '5L_10L' })
  })

  it('F38 the Karta answers for the family member; contact details are shared only after acceptance', async () => {
    actAs(bride)
    const sent = await sendInterest(json('http://x', 'POST', { toMemberId: groom.memberId }))
    expect(sent.status).toBe(201)
    const { interest } = await sent.json()
    expect(await prisma.notification.count({ where: { recipientId: groomK.userId, type: 'MATRIMONIAL_INTEREST' } })).toBe(1)
    actAs(bride)
    const before = await (await interests(json('http://x', 'GET'))).json()
    expect(before.sent.find((i: any) => i.id === interest.id).contact).toBeNull()

    actAs(viewer)
    expect((await answer(json('http://x', 'PATCH', { action: 'accept' }), { params: { id: interest.id } })).status).toBe(403)
    actAs(groomK) // the groom's Karta accepts on his behalf
    const ok = await answer(json('http://x', 'PATCH', { action: 'accept' }), { params: { id: interest.id } })
    expect(ok.status).toBe(200)
    expect((await prisma.matrimonialInterest.findUniqueOrThrow({ where: { id: interest.id } })).respondedBy).toBe(groomK.userId)
    actAs(bride)
    const after = await (await interests(json('http://x', 'GET'))).json()
    const contact = after.sent.find((i: any) => i.id === interest.id).contact
    expect(contact.preference).toBe('BOTH')
    expect(contact.karta.name).toBeTruthy()
    expect(contact.person.name).toBeTruthy()
  })

  it('F38 workbook rules: only listed members and their Karta may browse and send interests', async () => {
    actAs(viewer)
    expect((await list(json('http://x/api/matrimony/profiles', 'GET'))).status).toBe(403)
    actAs(viewer)
    expect((await sendInterest(json('http://x', 'POST', { toMemberId: groom.memberId }))).status).toBe(403)
    actAs(brideK) // Karta of a listed member
    expect((await list(json('http://x/api/matrimony/profiles', 'GET'))).status).toBe(200)
    actAs(brideK)
    expect((await sendInterest(json('http://x', 'POST', { toMemberId: groom.memberId, fromMemberId: bride.memberId }))).status).toBe(409) // already accepted
  })

  it('switching bureau.workbook_rules off restores the earlier rules (anyone browses; divorced may list)', async () => {
    await setRules(false)
    try {
      actAs(viewer)
      expect((await list(json('http://x/api/matrimony/profiles', 'GET'))).status).toBe(200)
      await prisma.member.update({ where: { id: viewer.memberId }, data: { maritalStatus: 'DIVORCED' } })
      actAs(viewer)
      expect((await createProfile(json('http://x', 'POST', {}))).status).toBe(201)
    } finally {
      await prisma.member.update({ where: { id: viewer.memberId }, data: { maritalStatus: 'UNMARRIED' } })
      await setRules(true)
    }
  })
})
