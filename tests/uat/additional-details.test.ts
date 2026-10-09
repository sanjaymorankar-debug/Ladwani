import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { GET as getOverview } from '@/app/api/members/[id]/additional-details/route'
import { GET as getSection, PUT as putSection, DELETE as deleteSectionRoute } from '@/app/api/members/[id]/additional-details/[section]/route'
import { POST as postConsent } from '@/app/api/members/[id]/additional-details/consent/route'
import { POST as uploadFile } from '@/app/api/members/[id]/additional-details/files/route'
import { GET as getFile } from '@/app/api/member-files/[fileId]/route'
import { PATCH as withdrawRequest } from '@/app/api/members/[id]/support-requests/route'
import { GET as getSupportList } from '@/app/api/support-requests/route'
import { GET as getReports } from '@/app/api/reports/community-support/route'
import { GET as searchMembers } from '@/app/api/search/route'
import { GET as getMember } from '@/app/api/members/[id]/route'
import { PUT as putOptions } from '@/app/api/admin/options/route'
import { PATCH as patchUser } from '@/app/api/admin/users/[id]/route'
import { CONSENT_VERSION } from '@/lib/additional-details/server'
import { SECTIONS } from '@/lib/additional-details/sections'
import { actAs, jsonReq, account } from './helpers'
import {
  cleanupXd, makePerson, makeFamily, linkParent, grantConsent, scopeRole, ensureDistrictArea, interestBySlug, type XdPerson,
} from './extended-fixtures'

// Additional Details (Step 2 + rules 1–8, 11): every section through the real
// API routes and a real PostgreSQL database.

const as = (p: XdPerson) => actAs({ userId: p.userId!, roles: p.roles, memberId: p.memberId })
const put = (memberId: string, section: string, body: unknown, headers: Record<string, string> = {}) =>
  putSection(new Request('http://x', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }) as any, { params: { id: memberId, section } })
const get = (memberId: string, section: string) => getSection(jsonReq('http://x', 'GET') as any, { params: { id: memberId, section } })
const del = (memberId: string, section: string) => deleteSectionRoute(jsonReq('http://x', 'DELETE') as any, { params: { id: memberId, section } })
const overview = (memberId: string) => getOverview(jsonReq('http://x', 'GET') as any, { params: { id: memberId } })

let karta: XdPerson, adultF: XdPerson, sibling: XdPerson, elder: XdPerson, senior: XdPerson
let minor: XdPerson, minorWithLogin: XdPerson, parent: XdPerson, outsider: XdPerson
let districtTeam: XdPerson, otherDistrictTeam: XdPerson, stateTeam: XdPerson, nationalTeam: XdPerson
let cricketId = '', cookingId = '', puneAreaId = ''

beforeAll(async () => {
  await cleanupXd()
  const fam = await makeFamily('AD')
  karta = await makePerson('AdKarta', { age: 50, familyId: fam.id, isKarta: true, roles: ['KARTA'] })
  adultF = await makePerson('AdNeha', { age: 22, gender: 'FEMALE', familyId: fam.id })
  sibling = await makePerson('AdSibling', { age: 28, familyId: fam.id })
  elder = await makePerson('AdElder', { login: false, age: 75, familyId: fam.id })
  senior = await makePerson('AdSenior', { age: 66, familyId: fam.id })
  minor = await makePerson('AdMinor', { login: false, age: 12, familyId: fam.id })
  minorWithLogin = await makePerson('AdTeen', { age: 16, familyId: fam.id })
  // A parent who is not the Karta (e.g. the child's mother).
  parent = await makePerson('AdMother', { age: 40, gender: 'FEMALE', familyId: fam.id })
  await linkParent(parent.memberId, minorWithLogin.memberId, 'mother')
  outsider = await makePerson('AdOutsider', { age: 35, familyId: (await makeFamily('AD2')).id })
  const pune = await ensureDistrictArea('Pune')
  const satara = await ensureDistrictArea('Satara')
  puneAreaId = pune.id
  districtTeam = await makePerson('AdDistrict', { roles: ['DISTRICT_TEAM'] })
  await scopeRole(districtTeam.userId!, 'DISTRICT_TEAM', pune.id)
  otherDistrictTeam = await makePerson('AdSatara', { roles: ['DISTRICT_TEAM'] })
  await scopeRole(otherDistrictTeam.userId!, 'DISTRICT_TEAM', satara.id)
  stateTeam = await makePerson('AdState', { roles: ['STATE_TEAM'] })
  await scopeRole(stateTeam.userId!, 'STATE_TEAM', 'area-mh')
  nationalTeam = await makePerson('AdNational', { roles: ['NATIONAL_TEAM'] })
  cricketId = (await interestBySlug('cricket')).id
  cookingId = (await interestBySlug('cooking')).id
})

afterAll(async () => {
  await cleanupXd()
})

/** A valid "Yes" submission for every section, used for the save/edit/delete round-trip. */
function sample(key: string): Record<string, unknown> {
  const yes = (values: Record<string, unknown> = {}, rows?: unknown[]) => ({ answer: 'YES', values, ...(rows ? { rows } : {}) })
  switch (key) {
    case 'insurance': return yes({ insuranceNeedsHelp: false }, [{ insuranceType: 'HEALTH', insurerName: 'Star', sumInsuredBand: '5L_10L', renewalMonth: '4' }])
    case 'doctor': return yes({ doctorName: 'Dr Kale', doctorSpeciality: 'GENERAL', doctorClinic: 'Kale Clinic', doctorCity: 'Pune', doctorContact: '9822000000', doctorNeedsHelp: false })
    case 'adviser': return yes({ adviserName: 'Joshi & Co', adviserType: 'CA', adviserContact: '020-1234', adviserNeedsGuidance: false })
    case 'vehicles': return yes({}, [{ vehicleType: 'CAR', make: 'Maruti', model: 'Swift', year: 2019, fuelType: 'PETROL', lastServiceMonth: '2026-03', nextServiceDueMonth: '2026-09', preferredGarage: 'Sai Motors', registrationNumber: 'MH12AB1234', needsServicingSupport: false }])
    case 'banking': return yes({ hasExistingLoans: true, existingLoanTypes: ['HOME'], otherBankingNeeds: ['FIXED_DEPOSIT'] }, [{ loanType: 'EDUCATION', amountBand: '5L_10L', purpose: 'MS abroad', neededByMonth: '2027-06' }])
    case 'farm': return yes({}, [{ districtAreaId: puneAreaId, taluka: 'Haveli', village: 'Wagholi', areaValue: 2.5, areaUnit: 'ACRE', ownership: 'OWN', irrigated: true, mainCrops: 'Sugarcane' }])
    case 'house': return yes({ houseOwnership: 'RENTED', houseType: 'FLAT', houseWantsToBuy: true })
    case 'education': return yes({ eduNeedsSupport: false }, [{ qualification: 'B.Com', institution: 'BMCC', boardUniversity: 'SPPU', yearCompleted: 2024, marksType: 'PERCENTAGE', marksValue: '78', marksScale: '100' }])
    case 'sports': return yes({}, [{ interestId: cricketId, level: 'DISTRICT', needsCoachingSupport: false, achievements: [{ eventName: 'Inter-college', year: 2023, medal: 'SILVER' }] }])
    case 'hobbies': return yes({}, [{ interestId: cookingId, level: 'REGULAR', canTeach: true, needsSupport: false }])
    case 'career': return yes({ careerLookingFor: ['JOB_CHANGE'], careerSkills: ['Excel', 'Tally'], careerPreferredCity: 'Pune', careerExperienceBand: '1_3', careerCanOffer: [], careerSupportNeeds: [] })
    case 'business': return yes({}, [{ businessName: 'Neha Cakes', businessType: 'FOOD', description: 'Home bakery', city: 'Pune', contact: '98220', website: '', showInDirectory: true, supportNeeds: [] }])
    case 'skills_share': return yes({ teachSubjects: 'Accounts', teachMode: 'ONLINE', teachFeeMode: 'FREE', guidanceFields: ['TAX'], volunteerReady: true, volunteerHoursBand: '4_10', bloodGroup: 'B+', willingToDonateBlood: true, lastDonatedMonth: '2026-01' })
    case 'wellness': return yes({ wellnessActivities: ['WALKING'], wellnessWants: ['DIET_GUIDANCE'] })
    case 'senior': return yes({ seniorLivesWith: 'WITH_SPOUSE', seniorNeeds: ['DIGITAL_HELP'] })
    case 'students': return yes({ studentClassCourse: 'M.Com', studentCareerInterest: 'CA', studentNeeds: ['COMPETITIVE_EXAM'], studentExamName: 'CA Inter' })
    case 'women': return yes({ womenInterests: ['HOME_BUSINESS'], womenNeeds: ['MARKET'] })
    case 'gov_docs': return yes({ govDocNeeds: ['PASSPORT'] })
    case 'housing': return yes({ housingLookingTo: ['BUY'], housingCity: 'Pune', housingBudgetBand: '25L_50L', relocatingCity: '', relocatingWantsContacts: false })
    case 'travel': return yes({ travelInterests: ['PILGRIMAGE'], travelCanHost: false })
    case 'culture': return yes({ languages: ['Marathi', 'Hindi'], motherTongue: 'Marathi', cultureInterests: ['FESTIVAL_COMMITTEE'], openToCityFriends: true, openToMulGaon: true, openToProfession: false })
    case 'marriage_support': return yes({ marriageSupportNeeds: ['HOROSCOPE'] })
    case 'emergency': return yes({ emergencyContactMemberId: null, canHelpEmergency: true, emergencyHelpTypes: ['VEHICLE'] })
    default: throw new Error(key)
  }
}

describe('TC-AD — consent (rule 4)', () => {
  it('TC-AD-001 the first save is refused until the consent notice is agreed', async () => {
    as(adultF)
    const res = await put(adultF.memberId, 'house', sample('house'))
    expect(res.status).toBe(412)
    expect((await res.json()).code).toBe('CONSENT_REQUIRED')
    expect(await prisma.memberSectionSetting.count({ where: { memberId: adultF.memberId } })).toBe(0)
  })

  it('TC-AD-002 agreeing stores the text version, timestamp and IP; a stale version is refused', async () => {
    as(adultF)
    const stale = await postConsent(jsonReq('http://x', 'POST', { agree: true, version: 'old' }) as any, { params: { id: adultF.memberId } })
    expect(stale.status).toBe(409)
    const req = new Request('http://x', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
      body: JSON.stringify({ agree: true, version: CONSENT_VERSION }),
    })
    expect((await postConsent(req as any, { params: { id: adultF.memberId } })).status).toBe(201)
    const rec = await prisma.consentRecord.findFirstOrThrow({ where: { memberId: adultF.memberId, consentType: 'ADDITIONAL_DETAILS' } })
    expect(rec).toMatchObject({ version: CONSENT_VERSION, ipAddress: '203.0.113.7', granted: true, userId: adultF.userId })
    expect(rec.grantedAt).toBeInstanceOf(Date)
    expect((await put(adultF.memberId, 'house', sample('house'))).status).toBe(200)
  })
})

describe('TC-AD — save, edit and delete every section', () => {
  beforeAll(async () => {
    await grantConsent(senior.memberId, senior.userId!)
  })

  for (const section of SECTIONS) {
    it(`TC-AD-SEC ${section.number}. ${section.title}: save, read back, edit, delete`, async () => {
      const who = section.key === 'senior' ? senior : adultF
      as(who)
      const body = sample(section.key)
      const save = await put(who.memberId, section.key, body)
      expect(save.status, await save.clone().text()).toBe(200)
      const saved = (await save.json()).section
      expect(saved.answer).toBe('YES')
      expect(saved.visibility).toBe(section.defaultVisibility)
      for (const [k, v] of Object.entries((body as any).values)) {
        if (v === '' || v === null || (Array.isArray(v) && v.length === 0)) continue
        expect(saved.values[k], `${section.key}.${k}`).toEqual(v)
      }
      if ((body as any).rows) expect(saved.rows.length).toBeGreaterThanOrEqual((body as any).rows.length)

      // Edit: switch to "No" — detail fields (and owned rows) are dropped.
      const edit = await put(who.memberId, section.key, { ...body, answer: 'NO' })
      expect(edit.status).toBe(200)
      const edited = (await edit.json()).section
      expect(edited.answer).toBe('NO')
      for (const f of section.fields ?? []) {
        if (f.memberColumn || (f.onAnswers ?? ['YES']).includes('NO')) continue
        expect(edited.values[f.key], `${section.key}.${f.key} hidden on No`).toBeNull()
      }

      const d = await del(who.memberId, section.key)
      expect(d.status).toBe(200)
      expect(await prisma.memberSectionSetting.count({ where: { memberId: who.memberId, sectionKey: section.key } })).toBe(0)
      const after = (await (await get(who.memberId, section.key)).json()).section
      expect(after.answer).toBeNull()
      for (const f of section.fields ?? []) if (!f.memberColumn) expect(after.values[f.key]).toBeNull()
    })
  }
})

describe('TC-AD — conditional fields', () => {
  it('TC-AD-010 fields under an unanswered condition are never stored', async () => {
    as(adultF)
    // Own house: "wants to buy" only exists for renters.
    let res = await put(adultF.memberId, 'house', { answer: 'YES', values: { houseOwnership: 'OWN', houseType: 'FLAT', houseWantsToBuy: true } })
    expect((await res.json()).section.values.houseWantsToBuy).toBeNull()
    // Insurance "No" keeps the help question but never the policies.
    res = await put(adultF.memberId, 'insurance', { answer: 'NO', values: { insuranceNeedsHelp: true, insuranceHelpNote: 'Need health cover' }, rows: [{ insuranceType: 'LIFE' }], share: { insuranceNeedsHelp: false } })
    const s = (await res.json()).section
    expect(s.rows).toEqual([])
    expect(s.values).toMatchObject({ insuranceNeedsHelp: true, insuranceHelpNote: 'Need health cover' })
    // Prefer not to say clears everything.
    res = await put(adultF.memberId, 'insurance', { answer: 'PREFER_NOT', values: { insuranceNeedsHelp: true } })
    expect((await res.json()).section.values.insuranceNeedsHelp).toBeNull()
    // A note without its "needs help" switch is dropped.
    res = await put(adultF.memberId, 'education', { answer: 'YES', values: { eduNeedsSupport: false, eduSupportNote: 'x', eduSupportTypes: ['FEES'] }, rows: [] })
    expect((await res.json()).section.values).toMatchObject({ eduSupportNote: null, eduSupportTypes: null })
  })

  it('TC-AD-011 invalid options, months and amounts are rejected on the server', async () => {
    as(adultF)
    const bad: [string, unknown][] = [
      ['house', { answer: 'YES', values: { houseOwnership: 'CASTLE' } }],
      ['vehicles', { answer: 'YES', rows: [{ vehicleType: 'CAR', lastServiceMonth: '03/2026' }] }],
      ['banking', { answer: 'YES', rows: [{ loanType: 'HOME', amountBand: '4500000' }] }],
      ['house', { answer: 'MAYBE' }],
      ['culture', { answer: 'YES', values: { cultureInterests: 'YOUTH_WING' } }],
    ]
    for (const [section, body] of bad) expect((await put(adultF.memberId, section, body)).status, section).toBe(400)
  })

  it('TC-AD-012 sections that do not apply are hidden and refused (age, gender, marital status)', async () => {
    as(sibling)
    await grantConsent(sibling.memberId, sibling.userId!)
    const ov = await (await overview(sibling.memberId)).json()
    expect(ov.applicable).not.toContain('senior')
    expect(ov.applicable).not.toContain('women')
    expect(ov.applicable).not.toContain('students')
    expect((await put(sibling.memberId, 'senior', sample('senior'))).status).toBe(400)
    expect((await put(sibling.memberId, 'women', sample('women'))).status).toBe(400)
    await prisma.member.update({ where: { id: sibling.memberId }, data: { maritalStatus: 'MARRIED' } })
    expect((await put(sibling.memberId, 'marriage_support', sample('marriage_support'))).status).toBe(400)
    await prisma.member.update({ where: { id: sibling.memberId }, data: { maritalStatus: 'UNMARRIED' } })
    expect(ov.completeness).toBeGreaterThanOrEqual(0)
  })
})

describe('TC-AD — who can edit (rule 1)', () => {
  it('TC-AD-020 a minor with a login cannot enter their own details; a parent and the Karta can', async () => {
    as(minorWithLogin)
    expect((await put(minorWithLogin.memberId, 'hobbies', sample('hobbies'))).status).toBe(403)
    as(parent)
    expect((await postConsent(jsonReq('http://x', 'POST', { agree: true, version: CONSENT_VERSION }) as any, { params: { id: minorWithLogin.memberId } })).status).toBe(201)
    const consent = await prisma.consentRecord.findFirstOrThrow({ where: { memberId: minorWithLogin.memberId } })
    expect(consent.userId).toBe(parent.userId) // the parent consents on the child's behalf
    expect((await put(minorWithLogin.memberId, 'hobbies', { ...sample('hobbies'), entryNote: 'Entered by mother' })).status).toBe(200)
    as(karta)
    expect((await put(minorWithLogin.memberId, 'students', sample('students'))).status).toBe(200)
    as(outsider)
    expect((await put(minorWithLogin.memberId, 'hobbies', sample('hobbies'))).status).toBe(403)
  })

  it('TC-AD-021 Karta enters for a child without a login, with a logged note of who entered it', async () => {
    as(karta)
    await postConsent(jsonReq('http://x', 'POST', { agree: true, version: CONSENT_VERSION }) as any, { params: { id: minor.memberId } })
    const res = await put(minor.memberId, 'students', { ...sample('students'), entryNote: 'Filled in by Karta at the family meeting' })
    expect(res.status).toBe(200)
    const setting = await prisma.memberSectionSetting.findUniqueOrThrow({ where: { memberId_sectionKey: { memberId: minor.memberId, sectionKey: 'students' } } })
    expect(setting).toMatchObject({ enteredByUserId: karta.userId, entryNote: 'Filled in by Karta at the family meeting' })
    const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: minor.memberId, action: { startsWith: 'additional_details.section' }, fieldName: 'students' } })
    expect(log.actorId).toBe(karta.userId)
    expect((log.metadata as any).enteredBy).toBe('KARTA')
  })

  it('TC-AD-022 Karta edits an account-less elder, but never an adult who has their own login', async () => {
    as(karta)
    await postConsent(jsonReq('http://x', 'POST', { agree: true, version: CONSENT_VERSION }) as any, { params: { id: elder.memberId } })
    expect((await put(elder.memberId, 'senior', sample('senior'))).status).toBe(200)
    expect((await put(adultF.memberId, 'house', sample('house'))).status).toBe(403)
  })

  it('TC-AD-023 staff have no edit rights in this area', async () => {
    const admin = await account('ADMIN-01')
    actAs(admin)
    expect((await put(adultF.memberId, 'house', sample('house'))).status).toBe(403)
  })

  it('TC-AD-024 saving never creates an approval request and does not need operator approval (rule 5)', async () => {
    const before = await prisma.approval.count()
    as(adultF)
    expect((await put(adultF.memberId, 'travel', sample('travel'))).status).toBe(200)
    expect(await prisma.approval.count()).toBe(before)
  })
})

describe('TC-AD — visibility at every level (rules 2 and 8)', () => {
  const viewers = () => ({ self: adultF, karta, family: sibling, body: districtTeam, wrongDistrictBody: otherDistrictTeam, community: outsider })
  const expectations: Record<string, string[]> = {
    ONLY_ME: ['self'],
    KARTA: ['self', 'karta'],
    FAMILY: ['self', 'karta', 'family'],
    COMMUNITY_BODIES: ['self', 'karta', 'family', 'body'],
    COMMUNITY: ['self', 'karta', 'family', 'body', 'wrongDistrictBody', 'community'],
  }
  for (const [level, allowed] of Object.entries(expectations)) {
    it(`TC-AD-030 house section at ${level}`, async () => {
      as(adultF)
      expect((await put(adultF.memberId, 'house', { ...sample('house'), visibility: level })).status).toBe(200)
      for (const [name, p] of Object.entries(viewers())) {
        as(p)
        const res = await get(adultF.memberId, 'house')
        expect(res.status, `${level} as ${name}`).toBe(allowed.includes(name) ? 200 : 404)
        const ov = await (await overview(adultF.memberId)).json()
        const keys = ov.sections.map((s: any) => s.key)
        if (name !== 'self') expect(keys.includes('house'), `${level} overview as ${name}`).toBe(allowed.includes(name))
      }
    })
  }

  it('TC-AD-031 loans, insurance, investment adviser and doctor can never be wider than My Karta', async () => {
    as(adultF)
    for (const key of ['insurance', 'doctor', 'adviser', 'banking']) {
      for (const level of ['FAMILY', 'COMMUNITY_BODIES', 'COMMUNITY']) {
        const res = await put(adultF.memberId, key, { ...sample(key), visibility: level })
        expect(res.status, `${key} ${level}`).toBe(400)
      }
      expect((await put(adultF.memberId, key, { ...sample(key), visibility: 'KARTA' })).status).toBe(200)
    }
    // ...so even a District team member never sees them.
    as(districtTeam)
    for (const key of ['insurance', 'doctor', 'adviser', 'banking']) expect((await get(adultF.memberId, key)).status).toBe(404)
    as(karta)
    expect((await get(adultF.memberId, 'doctor')).status).toBe(200)
  })

  it('TC-AD-032 registration number is masked and blood-donor fields are hidden from other viewers', async () => {
    as(adultF)
    await put(adultF.memberId, 'vehicles', { ...sample('vehicles'), visibility: 'COMMUNITY' })
    await put(adultF.memberId, 'skills_share', { ...sample('skills_share'), visibility: 'COMMUNITY' })
    as(outsider)
    const v = (await (await get(adultF.memberId, 'vehicles')).json()).section
    expect(v.rows[0].registrationNumber).toBe('••••1234')
    const s = (await (await get(adultF.memberId, 'skills_share')).json()).section
    expect(s.values.teachSubjects).toBe('Accounts')
    expect(s.values).not.toHaveProperty('willingToDonateBlood')
    expect(s.values).not.toHaveProperty('lastDonatedMonth')
    expect(s.values).not.toHaveProperty('bloodGroup')
    as(adultF)
    const own = (await (await get(adultF.memberId, 'vehicles')).json()).section
    expect(own.rows[0].registrationNumber).toBe('MH12AB1234')
  })

  it('TC-AD-033 these fields never appear in search, the member API or the marriage bureau', async () => {
    as(adultF)
    await put(adultF.memberId, 'education', { answer: 'YES', visibility: 'ONLY_ME', values: {}, rows: [{ qualification: 'B.Com', yearCompleted: 2024, marksType: 'PERCENTAGE', marksValue: '91.7', marksScale: '100', boardUniversity: 'XdBoardUniv' }] })
    await put(adultF.memberId, 'business', { answer: 'YES', visibility: 'ONLY_ME', rows: [{ businessName: 'Neha Cakes', contact: '98220XDCONTACT', supportNeeds: ['FUNDING'] }] })
    as(outsider)
    const search = await (await searchMembers(new Request(`http://x/api/search?q=AdNeha`) as any)).json()
    const json = JSON.stringify(search)
    const member = JSON.stringify(await (await getMember(jsonReq('http://x', 'GET') as any, { params: { id: adultF.memberId } })).json())
    for (const leak of ['Sai Motors', 'MH12AB1234', 'registrationNumber', 'teachSubjects', 'houseOwnership', 'insurerName', 'Kale Clinic', 'sectionSettings', 'additionalDetail', 'marksValue', '91.7', 'XdBoardUniv', 'XDCONTACT', 'supportNeeds', 'FUNDING']) {
      expect(json).not.toContain(leak)
      expect(member).not.toContain(leak)
    }
    const profile = await prisma.matrimonialProfile.findFirst({ where: { memberId: adultF.memberId } })
    expect(profile).toBeNull()
  })
})

describe('TC-AD — support requests (rule 3)', () => {
  it('TC-AD-040 "needs help" alone does not share anything; the member is asked first', async () => {
    as(adultF)
    const res = await put(adultF.memberId, 'education', { answer: 'YES', values: { eduNeedsSupport: true, eduSupportTypes: ['FEES'], eduSupportAmountBand: '10K_50K', eduSupportNote: 'Final year fees' }, rows: [] })
    const body = await res.json()
    expect(body.support.askToShare).toEqual([{ key: 'eduNeedsSupport', category: 'EDUCATION' }])
    expect(await prisma.supportRequest.count({ where: { memberId: adultF.memberId } })).toBe(0)
    await put(adultF.memberId, 'education', { answer: 'YES', values: { eduNeedsSupport: true }, rows: [], share: { eduNeedsSupport: false } })
    expect(await prisma.supportRequest.count({ where: { memberId: adultF.memberId } })).toBe(0)
  })

  it('TC-AD-041 opting in sends it to the District team for that district only; State/National see counts', async () => {
    as(adultF)
    const res = await put(adultF.memberId, 'education', { answer: 'YES', values: { eduNeedsSupport: true, eduSupportNote: 'Final year fees' }, rows: [], share: { eduNeedsSupport: true } })
    expect((await res.json()).support.opened).toEqual([{ sourceKey: 'education.eduNeedsSupport', category: 'EDUCATION' }])
    const reqRow = await prisma.supportRequest.findFirstOrThrow({ where: { memberId: adultF.memberId, status: 'OPEN' } })
    expect(reqRow).toMatchObject({ category: 'EDUCATION', district: 'Pune', note: 'Final year fees' })

    as(districtTeam)
    const pune = await (await getSupportList(jsonReq('http://x', 'GET') as any)).json()
    expect(pune.requests.map((r: any) => r.member.id)).toContain(adultF.memberId)
    as(otherDistrictTeam)
    const satara = await (await getSupportList(jsonReq('http://x', 'GET') as any)).json()
    expect(satara.requests.map((r: any) => r.member.id)).not.toContain(adultF.memberId)
    for (const team of [stateTeam, nationalTeam]) {
      as(team)
      const body = await (await getSupportList(jsonReq('http://x', 'GET') as any)).json()
      expect(body.requests).toEqual([])
      expect(JSON.stringify(body)).not.toContain('AdNeha')
      expect(body.counts.byCategory.find((c: any) => c.key === 'EDUCATION')?.count).toBeGreaterThanOrEqual(1)
      expect(body.counts.byDistrict.find((c: any) => c.key === 'Pune')?.count).toBeGreaterThanOrEqual(1)
    }
    as(outsider)
    expect((await getSupportList(jsonReq('http://x', 'GET') as any)).status).toBe(403)
    expect((await getReports()).status).toBe(403)
  })

  it('TC-AD-042 the member can withdraw the request at any time', async () => {
    as(adultF)
    const reqRow = await prisma.supportRequest.findFirstOrThrow({ where: { memberId: adultF.memberId, status: 'OPEN' } })
    const res = await withdrawRequest(jsonReq('http://x', 'PATCH', { requestId: reqRow.id }) as any, { params: { id: adultF.memberId } })
    expect(res.status).toBe(200)
    expect((await prisma.supportRequest.findUniqueOrThrow({ where: { id: reqRow.id } })).status).toBe('WITHDRAWN')
    as(districtTeam)
    const pune = await (await getSupportList(jsonReq('http://x', 'GET') as any)).json()
    expect(pune.requests.map((r: any) => r.id)).not.toContain(reqRow.id)
  })

  it('TC-AD-043 capped sections can still raise an opted-in request (the rule 3 exception)', async () => {
    as(adultF)
    await put(adultF.memberId, 'doctor', { answer: 'NO', visibility: 'ONLY_ME', values: { doctorNeedsHelp: true }, share: { doctorNeedsHelp: true } })
    await put(adultF.memberId, 'vehicles', { ...sample('vehicles'), rows: [{ vehicleType: 'BIKE', needsServicingSupport: true, servicingSupportNote: 'Clutch', _share: true }] })
    const open = await prisma.supportRequest.findMany({ where: { memberId: adultF.memberId, status: 'OPEN' } })
    expect(open.map((r) => r.category).sort()).toEqual(['DOCTOR', 'SERVICING'])
    // Turning "needs help" off withdraws it automatically.
    await put(adultF.memberId, 'doctor', { answer: 'NO', values: { doctorNeedsHelp: false } })
    expect(await prisma.supportRequest.count({ where: { memberId: adultF.memberId, status: 'OPEN', category: 'DOCTOR' } })).toBe(0)
  })

  it('TC-AD-044 reports count open requests by type and district for State/National teams', async () => {
    as(nationalTeam)
    const body = await (await getReports()).json()
    expect(body.support.byCategory.some((c: any) => c.key === 'SERVICING')).toBe(true)
    expect(JSON.stringify(body)).not.toContain('AdNeha')
    expect(body.groups).toHaveProperty('groupCount')
    expect(body.groups).toHaveProperty('problems')
    expect(body.groups).toHaveProperty('mentorsByField')
  })
})

describe('TC-AD — deletion, uploads and audit (rules 4, 6, 7)', () => {
  it('TC-AD-050 deleting a section removes its rows, values and support requests', async () => {
    as(adultF)
    expect(await prisma.memberVehicle.count({ where: { memberId: adultF.memberId } })).toBeGreaterThan(0)
    expect((await del(adultF.memberId, 'vehicles')).status).toBe(200)
    expect(await prisma.memberVehicle.count({ where: { memberId: adultF.memberId } })).toBe(0)
    expect(await prisma.supportRequest.count({ where: { memberId: adultF.memberId, sourceKey: { startsWith: 'vehicles' } } })).toBe(0)
  })

  it('TC-AD-051 marksheet upload: type and size limits, private serving per visibility', async () => {
    as(adultF)
    const upload = (bytes: number[], type: string, name: string) => {
      const fd = new FormData()
      fd.set('purpose', 'MARKSHEET')
      fd.set('file', new File([new Uint8Array(bytes)], name, { type }))
      return uploadFile(new Request('http://x', { method: 'POST', body: fd }) as any, { params: { id: adultF.memberId } })
    }
    expect((await upload([0x4d, 0x5a, 0, 0], 'application/pdf', 'evil.pdf')).status).toBe(400) // bytes aren't a PDF
    expect((await upload([1, 2, 3], 'text/plain', 'a.txt')).status).toBe(400)
    const ok = await upload([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31], 'application/pdf', 'marks.pdf')
    expect(ok.status).toBe(201)
    const { fileId } = await ok.json()
    const save = await put(adultF.memberId, 'education', { answer: 'YES', visibility: 'FAMILY', values: {}, rows: [{ qualification: 'HSC', yearCompleted: 2021, marksType: 'PERCENTAGE', marksValue: '81', marksScale: '100', marksheetFileId: fileId }] })
    expect(save.status).toBe(200)
    expect((await getFile(jsonReq('http://x', 'GET') as any, { params: { fileId } })).status).toBe(200)
    as(sibling)
    expect((await getFile(jsonReq('http://x', 'GET') as any, { params: { fileId } })).status).toBe(200)
    as(outsider)
    expect((await getFile(jsonReq('http://x', 'GET') as any, { params: { fileId } })).status).toBe(404)
    as(adultF)
    await del(adultF.memberId, 'education')
    expect(await prisma.memberFile.count({ where: { id: fileId } })).toBe(0)
  })

  it('TC-AD-052 creates, updates, deletes and views by others are audit-logged — without the values', async () => {
    const logs = await prisma.auditLog.findMany({ where: { entityId: adultF.memberId, action: { startsWith: 'additional_details' } } })
    const actions = new Set(logs.map((l) => l.action))
    for (const a of ['additional_details.section.create', 'additional_details.section.update', 'additional_details.section.delete', 'additional_details.view']) {
      expect(actions.has(a), a).toBe(true)
    }
    const views = logs.filter((l) => l.action === 'additional_details.view')
    expect(views.some((v) => v.actorId === outsider.userId)).toBe(true)
    expect(views.some((v) => v.actorId === adultF.userId)).toBe(false) // own views aren't logged
    const text = JSON.stringify(logs)
    for (const secret of ['MH12AB1234', 'Kale Clinic', 'Final year fees', 'Sai Motors']) expect(text).not.toContain(secret)
  })
})

describe('TC-AD — dropdowns from the master table (rule 11)', () => {
  it('TC-AD-060 an Admin edits a list and the server validates against it', async () => {
    const admin = await account('ADMIN-01')
    actAs(admin)
    const res = await putOptions(jsonReq('http://x', 'PUT', { listKey: 'VEHICLE_TYPE', options: [{ value: 'CAR', label: 'Car' }, { value: 'TRACTOR', label: 'Tractor' }] }) as any)
    expect(res.status).toBe(200)
    as(adultF)
    expect((await put(adultF.memberId, 'vehicles', { answer: 'YES', rows: [{ vehicleType: 'TRACTOR' }] })).status).toBe(200)
    expect((await put(adultF.memberId, 'vehicles', { answer: 'YES', rows: [{ vehicleType: 'BIKE' }] })).status).toBe(400)
    actAs(admin)
    await putOptions(jsonReq('http://x', 'PUT', { listKey: 'VEHICLE_TYPE', reset: true }) as any)
    as(adultF)
    expect((await put(adultF.memberId, 'vehicles', { answer: 'YES', rows: [{ vehicleType: 'BIKE' }] })).status).toBe(200)
  })
})

describe('TC-AD — community team roles', () => {
  it('TC-AD-070 Admin scopes a District team role to a district; a district is required', async () => {
    const admin = await account('ADMIN-01')
    const helper = await makePerson('AdHelper', {})
    actAs(admin)
    const noArea = await patchUser(jsonReq('http://x', 'PATCH', { toggleRole: 'DISTRICT_TEAM' }) as any, { params: { id: helper.userId! } })
    expect(noArea.status).toBe(400)
    const ok = await patchUser(jsonReq('http://x', 'PATCH', { toggleRole: 'DISTRICT_TEAM', areaId: puneAreaId }) as any, { params: { id: helper.userId! } })
    expect(ok.status).toBe(200)
    const ur = await prisma.userRole.findFirstOrThrow({ where: { userId: helper.userId!, role: { code: 'DISTRICT_TEAM' } } })
    expect(ur.areaId).toBe(puneAreaId)
    actAs({ userId: helper.userId!, roles: ['MEMBER', 'DISTRICT_TEAM'], memberId: helper.memberId })
    const res = await getSupportList(jsonReq('http://x', 'GET') as any)
    expect(res.status).toBe(200)
    expect((await res.json()).scope.districts).toEqual(['pune'])
  })
})
