import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue({ messageId: 'test' }) }))

import fs from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { p4Fixtures, actAs, json, PNG, type Person } from './fixtures'
import { POST as register } from '@/app/api/organisations/route'
import { GET as getOrg } from '@/app/api/organisations/[id]/route'
import { POST as submitAgain } from '@/app/api/organisations/[id]/submit/route'
import { POST as addMember } from '@/app/api/organisations/[id]/members/route'
import { POST as memberAct } from '@/app/api/organisations/[id]/members/[memberId]/route'
import { GET as getTask, POST as decide } from '@/app/api/verification/tasks/[id]/route'
import { runOrganisationJobs, onMemberExpired } from '@/lib/organisations'

/**
 * P4 as the owner decided it: a local organisation sits at taluka level
 * (name, start date, taluka, town, management body of registered members);
 * every level has a President, Secretary and Chairman; a unit's three office
 * bearers sit on the organisation above automatically (Taluka → District →
 * State → Country); an Admin or an Operator of the area appoints a LadWani
 * organisation's office bearers.
 */
const fx = p4Fixtures('p4o')
let geo: Awaited<ReturnType<typeof fx.geography>>
let admin: Person, op1: Person, op2: Person, op3: Person, opFar: Person
let applicant: Person, pres: Person, sec: Person, chair: Person, bm: Person
let orgId: string, districtOrg: string, stateOrg: string, countryOrg: string

const ALL_TICKS = { checklist: { name: true, certificate: true, address: true, officers: true } }

function orgForm(fields: Record<string, string | null>, opts: { cert?: Buffer | null; bodyMembers?: string[] } = {}) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) if (v !== null) fd.append(k, v)
  for (const id of opts.bodyMembers ?? []) fd.append('bodyMemberIds', id)
  if (opts.cert) fd.append('certificate', new Blob([new Uint8Array(opts.cert)]), 'cert.png')
  return new Request('http://x/api/organisations', { method: 'POST', body: fd })
}
const fields = (over: Record<string, string | null> = {}) => ({
  name: 'Ladwani Seva Mandal', startedOn: '2015-06-01', talukaAreaId: geo.taluka, town: 'Hadapsar',
  presidentMemberId: pres.memberId, secretaryMemberId: sec.memberId, chairmanMemberId: chair.memberId, ...over,
})
const act = (as: Person, memberId: string, body: Record<string, unknown>, id = orgId) => { actAs(as); return memberAct(json('http://x', 'POST', body), { params: { id, memberId } }) }
const membership = (organisationId: string, memberId: string) => prisma.organisationMember.findUnique({ where: { organisationId_memberId: { organisationId, memberId } } })
const roleOf = async (p: Person, code: string) => prisma.userRole.findFirst({ where: { userId: p.userId, role: { code }, bodySeatId: { not: null } } })
const openSeats = (fromOrganisationId: string) => prisma.bodySeat.count({ where: { fromOrganisationId, status: { in: ['ACCEPTED', 'CONFIRMED'] } } })
async function appoint(as: Person, organisationId: string, p: Person, designation: string) {
  const res = await act(as, p.memberId, { action: 'designate', designation }, organisationId)
  expect(res.status).toBe(200)
  expect((await act(p, p.memberId, { action: 'accept' }, organisationId)).status).toBe(200)
}

async function decideBoth(id: string, decision: string, remarks?: string) {
  const tasks = await prisma.approvalTask.findMany({ where: { organisationId: id, supersededAt: null, status: 'OPEN' } })
  for (const t of tasks) {
    const op = [op1, op2, op3].find((o) => o.userId === t.operatorUserId)!
    actAs(op)
    const res = await decide(json('http://x', 'POST', { decision, remarks, ...ALL_TICKS }), { params: { id: t.id } })
    expect(res.status).toBe(200)
  }
}

beforeAll(async () => {
  geo = await fx.geography()
  admin = await fx.person('admin', { roles: [{ code: 'ADMIN' }] })
  op1 = await fx.operator('op1', geo.district)
  op2 = await fx.operator('op2', geo.district)
  op3 = await fx.operator('op3', geo.district)
  opFar = await fx.operator('opfar', geo.district2)
  applicant = await fx.adult('appl', { villageId: geo.village })
  pres = await fx.adult('pres', { villageId: geo.village })
  sec = await fx.adult('sec', { villageId: geo.village })
  chair = await fx.adult('chair', { villageId: geo.village })
  bm = await fx.adult('bm', { villageId: geo.village })
})
afterAll(() => fx.cleanup())

describe('F26 Create a local (taluka) organisation', () => {
  it('F26 needs a name, a start date (not in the future), a taluka, a town and three different active office bearers', async () => {
    actAs(applicant)
    expect((await register(orgForm(fields({ secretaryMemberId: pres.memberId })))).status).toBe(400)
    expect((await register(orgForm(fields({ talukaAreaId: geo.district })))).status).toBe(400)
    expect((await register(orgForm(fields({ talukaAreaId: geo.village })))).status).toBe(400)
    expect((await register(orgForm(fields({ startedOn: '2999-01-01' })))).status).toBe(400)
    expect((await register(orgForm(fields({ startedOn: null })))).status).toBe(400)
    expect((await register(orgForm(fields({ town: null })))).status).toBe(400)
    expect((await register(orgForm(fields({ chairmanMemberId: null })))).status).toBe(400)
  })

  it('F26 submitted without a certificate: the whole management body is invited; two Operators of the district verify it blind', async () => {
    actAs(applicant)
    const res = await register(orgForm(fields(), { bodyMembers: [bm.memberId] }))
    expect(res.status).toBe(201)
    orgId = (await res.json()).organisationId
    const org = await prisma.organisation.findUniqueOrThrow({ where: { id: orgId } })
    expect(org).toMatchObject({ status: 'PENDING_APPROVAL', kind: 'LOCAL', areaId: geo.taluka, town: 'Hadapsar', certificateKey: null })
    expect(org.startedOn?.toISOString().slice(0, 10)).toBe('2015-06-01')

    const rows = await prisma.organisationMember.findMany({ where: { organisationId: orgId } })
    expect(rows.filter((r) => r.status === 'INVITED' && r.designation !== 'MEMBER').map((r) => r.designation).sort()).toEqual(['CHAIRMAN', 'PRESIDENT', 'SECRETARY'])
    expect(rows.find((r) => r.memberId === bm.memberId)).toMatchObject({ status: 'INVITED', designation: 'MEMBER' })
    expect(rows.find((r) => r.memberId === applicant.memberId)).toMatchObject({ status: 'ACTIVE', designation: 'MEMBER' })
    expect(await prisma.notification.count({ where: { recipientId: chair.userId, type: 'ORGANISATION_INVITE' } })).toBe(1)
    expect(await prisma.notification.count({ where: { recipientId: bm.userId, type: 'ORGANISATION_INVITE' } })).toBe(1)

    const tasks = await prisma.approvalTask.findMany({ where: { organisationId: orgId } })
    expect(tasks).toHaveLength(2)
    expect(new Set(tasks.map((t) => t.operatorUserId)).size).toBe(2)
    expect(tasks.every((t) => t.kind === 'ORGANISATION' && t.districtAreaId === geo.district)).toBe(true)

    const t = tasks[0]
    actAs([op1, op2, op3].find((o) => o.userId === t.operatorUserId)!)
    const view = await (await getTask(json('http://x', 'GET'), { params: { id: t.id } })).json()
    expect(view.organisation).toMatchObject({ name: 'Ladwani Seva Mandal', town: 'Hadapsar', certificate: null })
    expect(view.organisation.district).toMatchObject({ taluka: expect.any(String), district: expect.any(String) })
    expect(view.organisation.officers).toHaveLength(3)
    expect(view.organisation.members).toHaveLength(2) // the other body member and the applicant
    expect(view.checklistItems.map((c: any) => c.key)).toEqual(['name', 'certificate', 'address', 'officers'])
    expect(JSON.stringify(view)).not.toContain(tasks[1].id) // never the other operator's task
  })

  it('F26/F28 ACTIVE once both Operators approve and the three office bearers accept; they then sit on the District organisation automatically', async () => {
    await decideBoth(orgId, 'APPROVED')
    expect((await prisma.organisation.findUniqueOrThrow({ where: { id: orgId } })).status).toBe('PENDING_APPROVAL')
    expect((await act(pres, pres.memberId, { action: 'accept' })).status).toBe(200)
    expect((await act(sec, sec.memberId, { action: 'accept' })).status).toBe(200)
    expect((await act(sec, chair.memberId, { action: 'accept' })).status).toBe(403) // only the person answers
    expect((await prisma.organisation.findUniqueOrThrow({ where: { id: orgId } })).status).toBe('PENDING_APPROVAL')
    expect(await prisma.bodySeat.count({ where: { fromOrganisationId: orgId } })).toBe(0) // nothing goes up before it is active
    expect((await act(chair, chair.memberId, { action: 'accept' })).status).toBe(200)
    expect((await prisma.organisation.findUniqueOrThrow({ where: { id: orgId } })).status).toBe('ACTIVE')

    const district = await prisma.organisation.findFirstOrThrow({ where: { kind: 'DISTRICT_BODY', areaId: geo.district } })
    districtOrg = district.id
    expect(district.name).toContain('District Organisation')
    for (const p of [pres, sec, chair]) {
      expect(await membership(districtOrg, p.memberId)).toMatchObject({ status: 'ACTIVE', designation: 'MEMBER', seatId: expect.any(String) })
      expect(await roleOf(p, 'DISTRICT_TEAM')).toMatchObject({ areaId: geo.district })
    }
    expect(await openSeats(orgId)).toBe(3) // at most the three office bearers
    expect(await membership(districtOrg, applicant.memberId)).toBeNull() // a plain member does not go up
    expect((await act(bm, bm.memberId, { action: 'accept' })).status).toBe(200)
    expect(await membership(districtOrg, bm.memberId)).toBeNull()
  })

  it('F26 sent back → corrected → resubmitted as a new round; a declining nominee is replaced; a certificate, if attached, is stored encrypted', async () => {
    const p2 = await fx.adult('p2'), s2 = await fx.adult('s2'), c2 = await fx.adult('c2'), c3 = await fx.adult('c3')
    actAs(applicant)
    const res = await register(orgForm(fields({ name: 'Second Mandal', presidentMemberId: p2.memberId, secretaryMemberId: s2.memberId, chairmanMemberId: c2.memberId }), { cert: PNG }))
    const { organisationId } = await res.json()
    const created = await prisma.organisation.findUniqueOrThrow({ where: { id: organisationId } })
    const raw = await fs.readFile(path.join(path.resolve(process.env.UPLOAD_DIR || 'uploads'), created.certificateKey!))
    expect(raw.includes(PNG)).toBe(false) // not stored in the clear

    await decideBoth(organisationId, 'SENT_BACK', 'Start date looks wrong')
    const org = await prisma.organisation.findUniqueOrThrow({ where: { id: organisationId } })
    expect(org).toMatchObject({ status: 'CORRECTION_REQUIRED' })
    expect(org.decisionNote).toContain('Start date')
    actAs(applicant)
    expect((await submitAgain(json('http://x', 'POST'), { params: { id: organisationId } })).status).toBe(200)
    expect(await prisma.approvalTask.count({ where: { organisationId, round: 2 } })).toBe(2)

    expect((await act(c2, c2.memberId, { action: 'decline' }, organisationId)).status).toBe(200)
    expect((await act(applicant, c2.memberId, { action: 'renominate', newMemberId: c3.memberId }, organisationId)).status).toBe(200)
    expect(await membership(organisationId, c3.memberId)).toMatchObject({ status: 'INVITED', designation: 'CHAIRMAN' })
  })
})

describe('F27 Manage organisation members and designations', () => {
  let m1: Person, m2: Person
  beforeAll(async () => { m1 = await fx.adult('m1'); m2 = await fx.adult('m2') })

  it('F27 invited members accept; requests are accepted by the President or Secretary; plain members cannot manage', async () => {
    actAs(sec)
    expect((await addMember(json('http://x', 'POST', { memberId: m1.memberId }), { params: { id: orgId } })).status).toBe(201)
    expect((await act(m1, m1.memberId, { action: 'accept' })).status).toBe(200)
    actAs(m2)
    expect((await addMember(json('http://x', 'POST', {}), { params: { id: orgId } })).status).toBe(201)
    expect((await act(m1, m2.memberId, { action: 'approve' })).status).toBe(403)
    expect((await act(pres, m2.memberId, { action: 'reject' })).status).toBe(400) // a rejection gives a reason (owner's decision)
    expect((await act(pres, m2.memberId, { action: 'approve' })).status).toBe(200)
    expect(await membership(orgId, m2.memberId)).toMatchObject({ status: 'ACTIVE', designation: 'MEMBER' })
    expect(await prisma.notification.count({ where: { recipientId: m2.userId, type: 'ORGANISATION_MEMBER' } })).toBe(1)
  })

  it('F27/F28 a President handover needs the new holder\'s acceptance; the seat on the District organisation moves with the post', async () => {
    expect((await act(sec, m1.memberId, { action: 'designate', designation: 'MEMBER' })).status).toBe(400)
    expect((await act(sec, m1.memberId, { action: 'designate', designation: 'TREASURER' })).status).toBe(400) // Chairman replaced Treasurer
    expect((await act(sec, pres.memberId, { action: 'remove', reason: 'x' })).status).toBe(409)
    expect((await act(pres, pres.memberId, { action: 'resign' })).status).toBe(409)
    expect((await act(sec, m1.memberId, { action: 'designate', designation: 'PRESIDENT' })).status).toBe(200)
    expect(await membership(orgId, pres.memberId)).toMatchObject({ designation: 'PRESIDENT' }) // not yet
    expect((await act(m1, m1.memberId, { action: 'accept' })).status).toBe(200)
    expect(await membership(orgId, m1.memberId)).toMatchObject({ designation: 'PRESIDENT', pendingDesignation: null })
    expect(await membership(orgId, pres.memberId)).toMatchObject({ designation: 'MEMBER', status: 'ACTIVE' })
    // The District seat followed the post.
    expect(await membership(districtOrg, pres.memberId)).toMatchObject({ status: 'ENDED' })
    expect(await roleOf(pres, 'DISTRICT_TEAM')).toBeNull()
    expect(await membership(districtOrg, m1.memberId)).toMatchObject({ status: 'ACTIVE' })
    expect(await roleOf(m1, 'DISTRICT_TEAM')).not.toBeNull()
    expect(await openSeats(orgId)).toBe(3)
    // The database refuses a second President even if code slipped.
    await expect(prisma.organisationMember.update({ where: { organisationId_memberId: { organisationId: orgId, memberId: m2.memberId } }, data: { designation: 'PRESIDENT' } })).rejects.toThrow()
  })

  it('F27 remove a member with a reason; F31 an ended term flags the post vacant and ends its District seat', async () => {
    expect((await act(m1, m2.memberId, { action: 'remove' })).status).toBe(400)
    expect((await act(m1, m2.memberId, { action: 'remove', reason: 'Moved away' })).status).toBe(200)
    expect(await membership(orgId, m2.memberId)).toMatchObject({ status: 'ENDED' })
    expect((await act(m1, chair.memberId, { action: 'term', termStart: '2024-01-01', termEnd: '2025-01-01' })).status).toBe(200)
    const out = await runOrganisationJobs()
    expect(out.officeTermsEnded).toBeGreaterThanOrEqual(1)
    expect(await membership(orgId, chair.memberId)).toMatchObject({ designation: 'MEMBER' })
    expect(await membership(districtOrg, chair.memberId)).toMatchObject({ status: 'ENDED' })
    expect(await prisma.notification.count({ where: { recipientId: m1.userId, type: 'OFFICE_VACANT' } })).toBeGreaterThan(0)
    // Refill the post: the seat comes back.
    await appoint(m1, orgId, chair, 'CHAIRMAN')
    expect(await membership(districtOrg, chair.memberId)).toMatchObject({ status: 'ACTIVE' })
  })
})

describe('F28–F31 The LadWani District, State and Country organisations', () => {
  let m1: Person, m3: Person
  beforeAll(async () => {
    const holder = await prisma.organisationMember.findFirstOrThrow({ where: { organisationId: orgId, designation: 'PRESIDENT', status: 'ACTIVE' } })
    m1 = { userId: (await prisma.member.findUniqueOrThrow({ where: { id: holder.memberId } })).userId!, memberId: holder.memberId, roles: ['MEMBER'] }
  })

  it('F29 an Admin or an Operator of the district appoints the District organisation\'s office bearers (they accept); they then sit on the State organisation', async () => {
    expect((await act(sec, sec.memberId, { action: 'designate', designation: 'PRESIDENT' }, districtOrg)).status).toBe(403) // a plain member
    expect((await act(opFar, m1.memberId, { action: 'designate', designation: 'PRESIDENT' }, districtOrg)).status).toBe(403) // another district's Operator
    await appoint(op2, districtOrg, m1, 'PRESIDENT')
    await appoint(admin, districtOrg, sec, 'SECRETARY')
    await appoint(op1, districtOrg, chair, 'CHAIRMAN')

    const state = await prisma.organisation.findFirstOrThrow({ where: { kind: 'STATE_BODY', areaId: geo.state } })
    stateOrg = state.id
    expect(state.name).toContain('State Organisation')
    for (const p of [m1, sec, chair]) {
      expect(await membership(stateOrg, p.memberId)).toMatchObject({ status: 'ACTIVE' })
      expect(await roleOf(p, 'STATE_TEAM')).toMatchObject({ areaId: geo.state })
    }
    expect(await openSeats(districtOrg)).toBe(3)
  })

  it('F30 the State organisation\'s office bearers (appointed by an Admin or an Operator in that state) sit on the Country organisation', async () => {
    expect((await act(opFar, m1.memberId, { action: 'designate', designation: 'PRESIDENT' }, stateOrg)).status).toBe(403) // Operator in another state
    await appoint(op3, stateOrg, m1, 'PRESIDENT')
    await appoint(admin, stateOrg, sec, 'SECRETARY')
    await appoint(admin, stateOrg, chair, 'CHAIRMAN')

    const country = await prisma.organisation.findFirstOrThrow({ where: { kind: 'NATIONAL_BODY', bodyKey: `NATIONAL_BODY:${geo.c}` } })
    countryOrg = country.id
    expect(country.name).toContain('Country Organisation')
    for (const p of [m1, sec, chair]) {
      expect(await membership(countryOrg, p.memberId)).toMatchObject({ status: 'ACTIVE' })
      expect(await roleOf(p, 'NATIONAL_TEAM')).toMatchObject({ areaId: null })
    }
    // Only an Admin appoints at country level.
    expect((await act(op1, m1.memberId, { action: 'designate', designation: 'PRESIDENT' }, countryOrg)).status).toBe(403)
  })

  it('F31 losing the post at the bottom ends every seat above that came from it, and its access; the posts above fall vacant', async () => {
    m3 = await fx.adult('m3')
    actAs(m1)
    await addMember(json('http://x', 'POST', { memberId: m3.memberId }), { params: { id: orgId } })
    await act(m3, m3.memberId, { action: 'accept' })
    await appoint(m1, orgId, m3, 'SECRETARY') // sec hands the local post over

    expect(await membership(orgId, sec.memberId)).toMatchObject({ status: 'ACTIVE', designation: 'MEMBER' })
    for (const body of [districtOrg, stateOrg, countryOrg]) expect(await membership(body, sec.memberId)).toMatchObject({ status: 'ENDED' })
    for (const code of ['DISTRICT_TEAM', 'STATE_TEAM', 'NATIONAL_TEAM']) expect(await roleOf(sec, code)).toBeNull()
    expect(await membership(districtOrg, m3.memberId)).toMatchObject({ status: 'ACTIVE' }) // the new holder goes up
    expect(await roleOf(m1, 'NATIONAL_TEAM')).not.toBeNull() // others untouched
    expect(await prisma.notification.count({ where: { type: 'OFFICE_VACANT', data: { path: '$.organisationId', equals: districtOrg } } })).toBeGreaterThan(0)
  })

  it('F31 an expired member\'s posts and seats fall vacant and their access goes', async () => {
    await onMemberExpired(m1.memberId, admin.userId)
    for (const code of ['DISTRICT_TEAM', 'STATE_TEAM', 'NATIONAL_TEAM']) expect(await roleOf(m1, code)).toBeNull()
    expect(await membership(districtOrg, m1.memberId)).toMatchObject({ status: 'ENDED' })
    expect(await prisma.notification.count({ where: { type: 'OFFICE_VACANT', data: { path: '$.organisationId', equals: orgId } } })).toBeGreaterThan(0)
  })

  it('a non-member sees an active organisation\'s summary only (with its town and start date)', async () => {
    const stranger = await fx.adult('stranger')
    actAs(stranger)
    const res = await (await getOrg(json('http://x', 'GET'), { params: { id: orgId } })).json()
    expect(res.full).toBe(false)
    expect(res.organisation).toMatchObject({ town: 'Hadapsar' })
    expect(res.members.every((m: any) => m.designation !== 'MEMBER')).toBe(true)
    expect(res.organisation.registrationNumber).toBeUndefined()
  })
})
