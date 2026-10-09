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
import { POST as nominate } from '@/app/api/organisations/[id]/nominations/route'
import { POST as seatAct } from '@/app/api/body-seats/[id]/route'
import { GET as getTask, POST as decide } from '@/app/api/verification/tasks/[id]/route'
import { runOrganisationJobs, onMemberExpired } from '@/lib/organisations'

const fx = p4Fixtures('p4o')
let geo: Awaited<ReturnType<typeof fx.geography>>
let admin: Person, op1: Person, op2: Person, op3: Person
let applicant: Person, pres: Person, sec: Person, tre: Person
let orgId: string

const ALL_TICKS = { checklist: { name: true, certificate: true, address: true, officers: true } }

function orgForm(fields: Record<string, string | null>, cert: Buffer | null = PNG) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) if (v !== null) fd.append(k, v)
  if (cert) fd.append('certificate', new Blob([new Uint8Array(cert)]), 'cert.png')
  return new Request('http://x/api/organisations', { method: 'POST', body: fd })
}
const fields = (over: Record<string, string | null> = {}) => ({
  name: 'Ladwani Seva Mandal', registrationNumber: 'MH/123/2020', addressLine: '1 Temple Road', purpose: 'Community welfare',
  districtAreaId: geo.district, presidentMemberId: pres.memberId, secretaryMemberId: sec.memberId, treasurerMemberId: tre.memberId, ...over,
})
const act = (as: Person, memberId: string, body: Record<string, unknown>, id = orgId) => { actAs(as); return memberAct(json('http://x', 'POST', body), { params: { id, memberId } }) }
const seat = (as: Person, id: string, body: Record<string, unknown>) => { actAs(as); return seatAct(json('http://x', 'POST', body), { params: { id } }) }
const nominateAs = (as: Person, id: string, body: Record<string, unknown>) => { actAs(as); return nominate(json('http://x', 'POST', body), { params: { id } }) }
const membership = (organisationId: string, memberId: string) => prisma.organisationMember.findUnique({ where: { organisationId_memberId: { organisationId, memberId } } })
const roleOf = async (p: Person, code: string) => prisma.userRole.findFirst({ where: { userId: p.userId, role: { code }, bodySeatId: { not: null } } })

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
  applicant = await fx.adult('appl', { villageId: geo.village })
  pres = await fx.adult('pres', { villageId: geo.village })
  sec = await fx.adult('sec', { villageId: geo.village })
  tre = await fx.adult('tre', { villageId: geo.village })
})
afterAll(() => fx.cleanup())

describe('F26 Register a social organisation', () => {
  it('F26 needs a district, a certificate and three different active office bearers', async () => {
    actAs(applicant)
    expect((await register(orgForm(fields({ secretaryMemberId: pres.memberId })))).status).toBe(400)
    expect((await register(orgForm(fields(), null))).status).toBe(400)
    expect((await register(orgForm(fields({ districtAreaId: geo.village })))).status).toBe(400)
  })

  it('F26 submitted: certificate encrypted, nominees invited, two Operators of the district get blind tasks', async () => {
    actAs(applicant)
    const res = await register(orgForm(fields()))
    expect(res.status).toBe(201)
    orgId = (await res.json()).organisationId
    const org = await prisma.organisation.findUniqueOrThrow({ where: { id: orgId } })
    expect(org).toMatchObject({ status: 'PENDING_APPROVAL', kind: 'LOCAL', areaId: geo.district })
    const raw = await fs.readFile(path.join(path.resolve(process.env.UPLOAD_DIR || 'uploads'), org.certificateKey!))
    expect(raw.includes(PNG)).toBe(false) // not stored in the clear

    const rows = await prisma.organisationMember.findMany({ where: { organisationId: orgId } })
    expect(rows.filter((r) => r.status === 'INVITED').map((r) => r.designation).sort()).toEqual(['PRESIDENT', 'SECRETARY', 'TREASURER'])
    expect(rows.find((r) => r.memberId === applicant.memberId)).toMatchObject({ status: 'ACTIVE', designation: 'MEMBER' })
    expect(await prisma.notification.count({ where: { recipientId: pres.userId, type: 'ORGANISATION_INVITE' } })).toBe(1)

    const tasks = await prisma.approvalTask.findMany({ where: { organisationId: orgId } })
    expect(tasks).toHaveLength(2)
    expect(new Set(tasks.map((t) => t.operatorUserId)).size).toBe(2)
    expect(tasks.every((t) => t.kind === 'ORGANISATION' && t.districtAreaId === geo.district)).toBe(true)

    const t = tasks[0]
    actAs([op1, op2, op3].find((o) => o.userId === t.operatorUserId)!)
    const view = await (await getTask(json('http://x', 'GET'), { params: { id: t.id } })).json()
    expect(view.organisation).toMatchObject({ name: 'Ladwani Seva Mandal', registrationNumber: 'MH/123/2020' })
    expect(view.organisation.officers).toHaveLength(3)
    expect(view.organisation.certificate).toContain(`/api/organisations/${orgId}/certificate`)
    expect(view.checklistItems.map((c: any) => c.key)).toEqual(['name', 'certificate', 'address', 'officers'])
    expect(JSON.stringify(view)).not.toContain(tasks[1].id) // never the other operator's task
  })

  it('F26 becomes ACTIVE only when both Operators approve AND all three office bearers accept', async () => {
    await decideBoth(orgId, 'APPROVED')
    const approved = await prisma.organisation.findUniqueOrThrow({ where: { id: orgId } })
    expect(approved.status).toBe('PENDING_APPROVAL')
    expect(approved.approvedAt).not.toBeNull()
    expect((await act(pres, pres.memberId, { action: 'accept' })).status).toBe(200)
    expect((await act(sec, sec.memberId, { action: 'accept' })).status).toBe(200)
    expect((await act(sec, tre.memberId, { action: 'accept' })).status).toBe(403) // only the person answers
    expect((await prisma.organisation.findUniqueOrThrow({ where: { id: orgId } })).status).toBe('PENDING_APPROVAL')
    expect((await act(tre, tre.memberId, { action: 'accept' })).status).toBe(200)
    expect((await prisma.organisation.findUniqueOrThrow({ where: { id: orgId } })).status).toBe('ACTIVE')
    expect(await prisma.notification.count({ where: { recipientId: applicant.userId, type: 'ORGANISATION_RESULT', title: { contains: 'now active' } } })).toBe(1)
  })

  it('F26 sent back → corrected → resubmitted as a new round; a declining nominee is replaced', async () => {
    const p2 = await fx.adult('p2'), s2 = await fx.adult('s2'), t2 = await fx.adult('t2'), t3 = await fx.adult('t3')
    actAs(applicant)
    const { organisationId } = await (await register(orgForm(fields({ name: 'Second Mandal', presidentMemberId: p2.memberId, secretaryMemberId: s2.memberId, treasurerMemberId: t2.memberId })))).json()
    await decideBoth(organisationId, 'SENT_BACK', 'Certificate is unreadable')
    const org = await prisma.organisation.findUniqueOrThrow({ where: { id: organisationId } })
    expect(org).toMatchObject({ status: 'CORRECTION_REQUIRED' })
    expect(org.decisionNote).toContain('unreadable')
    actAs(applicant)
    expect((await submitAgain(json('http://x', 'POST'), { params: { id: organisationId } })).status).toBe(200)
    expect(await prisma.approvalTask.count({ where: { organisationId, round: 2 } })).toBe(2)

    expect((await act(t2, t2.memberId, { action: 'decline' }, organisationId)).status).toBe(200)
    expect((await act(applicant, t2.memberId, { action: 'renominate', newMemberId: t3.memberId }, organisationId)).status).toBe(200)
    expect(await membership(organisationId, t3.memberId)).toMatchObject({ status: 'INVITED', designation: 'TREASURER' })
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
    expect((await act(pres, m2.memberId, { action: 'approve' })).status).toBe(200)
    expect(await membership(orgId, m2.memberId)).toMatchObject({ status: 'ACTIVE', designation: 'MEMBER' })
    expect(await prisma.notification.count({ where: { recipientId: m2.userId, type: 'ORGANISATION_MEMBER' } })).toBe(1)
  })

  it('F27 always exactly one President: a handover needs the new holder\'s acceptance; the outgoing one becomes a Member', async () => {
    expect((await act(sec, m1.memberId, { action: 'designate', designation: 'MEMBER' })).status).toBe(400)
    expect((await act(sec, pres.memberId, { action: 'remove', reason: 'x' })).status).toBe(409)
    expect((await act(pres, pres.memberId, { action: 'resign' })).status).toBe(409)
    expect((await act(sec, m1.memberId, { action: 'designate', designation: 'PRESIDENT' })).status).toBe(200)
    expect(await membership(orgId, pres.memberId)).toMatchObject({ designation: 'PRESIDENT' }) // not yet
    expect((await act(m1, m1.memberId, { action: 'accept' })).status).toBe(200)
    expect(await membership(orgId, m1.memberId)).toMatchObject({ designation: 'PRESIDENT', pendingDesignation: null })
    expect(await membership(orgId, pres.memberId)).toMatchObject({ designation: 'MEMBER', status: 'ACTIVE' })
    expect(await prisma.organisationMember.count({ where: { organisationId: orgId, designation: 'PRESIDENT', status: 'ACTIVE' } })).toBe(1)
    // The database refuses a second President even if code slipped.
    await expect(prisma.organisationMember.update({ where: { organisationId_memberId: { organisationId: orgId, memberId: m2.memberId } }, data: { designation: 'PRESIDENT' } })).rejects.toThrow()
  })

  it('F27 remove a member with a reason; set an office bearer\'s term; F31 an ended term flags the post vacant', async () => {
    expect((await act(m1, m2.memberId, { action: 'remove' })).status).toBe(400)
    expect((await act(m1, m2.memberId, { action: 'remove', reason: 'Moved away' })).status).toBe(200)
    expect(await membership(orgId, m2.memberId)).toMatchObject({ status: 'ENDED' })
    expect((await act(m1, tre.memberId, { action: 'term', termStart: '2024-01-01', termEnd: '2025-01-01' })).status).toBe(200)
    const out = await runOrganisationJobs()
    expect(out.officeTermsEnded).toBeGreaterThanOrEqual(1)
    expect(await membership(orgId, tre.memberId)).toMatchObject({ designation: 'MEMBER' })
    expect(await prisma.notification.count({ where: { recipientId: m1.userId, type: 'OFFICE_VACANT' } })).toBeGreaterThan(0)
    // Refill the post for the rest of the tests.
    await act(m1, tre.memberId, { action: 'designate', designation: 'TREASURER' })
    await act(tre, tre.memberId, { action: 'accept' })
  })
})

describe('F28–F31 Nominations up the LadWani bodies', () => {
  let x: Person, y: Person, president: Person
  let districtBody: string, stateBody: string, nationalBody: string
  const seatOf = (memberId: string, from: string) => prisma.bodySeat.findFirstOrThrow({ where: { memberId, fromOrganisationId: from }, orderBy: { createdAt: 'desc' } })
  async function acceptAndConfirm(from: string, people: Person[]) {
    for (const p of people) {
      const s = await seatOf(p.memberId, from)
      expect((await seat(p, s.id, { action: 'accept' })).status).toBe(200)
      expect((await seat(admin, s.id, { action: 'confirm' })).status).toBe(200)
    }
  }

  beforeAll(async () => {
    x = await fx.adult('x'); y = await fx.adult('y')
    const holder = await prisma.organisationMember.findFirstOrThrow({ where: { organisationId: orgId, designation: 'PRESIDENT', status: 'ACTIVE' } })
    president = { userId: (await prisma.member.findUniqueOrThrow({ where: { id: holder.memberId } })).userId!, memberId: holder.memberId, roles: ['MEMBER'] }
    for (const p of [x, y]) {
      actAs(president)
      await addMember(json('http://x', 'POST', { memberId: p.memberId }), { params: { id: orgId } })
      await act(p, p.memberId, { action: 'accept' })
    }
  })

  it('F28 exactly two nominees, both members of the organisation; only its President nominates', async () => {
    const outsider = await fx.adult('outsider')
    expect((await nominateAs(sec, orgId, { memberIds: [x.memberId, y.memberId] })).status).toBe(403)
    expect((await nominateAs(president, orgId, { memberIds: [x.memberId] })).status).toBe(400)
    expect((await nominateAs(president, orgId, { memberIds: [x.memberId, outsider.memberId] })).status).toBe(400)
    const res = await nominateAs(president, orgId, { memberIds: [x.memberId, y.memberId] })
    expect(res.status).toBe(201)
    districtBody = (await res.json()).body.id
    expect(await prisma.organisation.findUniqueOrThrow({ where: { id: districtBody } })).toMatchObject({ kind: 'DISTRICT_BODY', areaId: geo.district, status: 'ACTIVE' })
    expect((await nominateAs(president, orgId, { memberIds: [sec.memberId] })).status).toBe(400) // already two
  })

  it('F28 nominees accept, the District body President / Admin confirms; the seat gives District team access', async () => {
    const sx = await seatOf(x.memberId, orgId)
    expect((await seat(admin, sx.id, { action: 'confirm' })).status).toBe(409) // nominee first
    expect((await seat(y, sx.id, { action: 'accept' })).status).toBe(403)
    expect((await seat(x, sx.id, { action: 'accept' })).status).toBe(200)
    expect((await seat(president, sx.id, { action: 'confirm' })).status).toBe(403) // not the body's President
    expect((await seat(admin, sx.id, { action: 'confirm' })).status).toBe(200)
    expect(await membership(districtBody, x.memberId)).toMatchObject({ status: 'ACTIVE', seatId: sx.id })
    expect(await roleOf(x, 'DISTRICT_TEAM')).toMatchObject({ areaId: geo.district, bodySeatId: sx.id })
    const sy = await seatOf(y.memberId, orgId)
    await seat(y, sy.id, { action: 'accept' }); await seat(admin, sy.id, { action: 'confirm' })
  })

  it('F29 / F30 the District body sends two to the State body, the State body two to the National body; access follows the seat', async () => {
    // The body's own President (appointed by an Admin, accepted by x) runs its nominations.
    expect((await act(admin, x.memberId, { action: 'designate', designation: 'PRESIDENT' }, districtBody)).status).toBe(200)
    expect((await act(x, x.memberId, { action: 'accept' }, districtBody)).status).toBe(200)
    const st = await nominateAs(x, districtBody, { memberIds: [x.memberId, y.memberId] })
    expect(st.status).toBe(201)
    stateBody = (await st.json()).body.id
    await acceptAndConfirm(districtBody, [x, y])
    expect(await roleOf(x, 'STATE_TEAM')).toMatchObject({ areaId: geo.state })

    await act(admin, x.memberId, { action: 'designate', designation: 'PRESIDENT' }, stateBody)
    await act(x, x.memberId, { action: 'accept' }, stateBody)
    const nat = await nominateAs(x, stateBody, { memberIds: [x.memberId, y.memberId] })
    expect(nat.status).toBe(201)
    nationalBody = (await nat.json()).body.id
    await acceptAndConfirm(stateBody, [x, y])
    expect(await roleOf(y, 'NATIONAL_TEAM')).toMatchObject({ areaId: null })
    expect((await prisma.organisation.findUniqueOrThrow({ where: { id: nationalBody } })).kind).toBe('NATIONAL_BODY')
  })

  it('F31 losing the lower seat removes every seat above that came from it, and its access; the nominating unit is told', async () => {
    expect((await act(y, y.memberId, { action: 'resign' })).status).toBe(200) // y leaves the local organisation
    for (const body of [districtBody, stateBody, nationalBody]) {
      expect(await membership(body, y.memberId)).toMatchObject({ status: 'ENDED' })
    }
    expect(await prisma.bodySeat.count({ where: { memberId: y.memberId, status: { in: ['NOMINATED', 'ACCEPTED', 'CONFIRMED'] } } })).toBe(0)
    for (const code of ['DISTRICT_TEAM', 'STATE_TEAM', 'NATIONAL_TEAM']) expect(await roleOf(y, code)).toBeNull()
    expect(await roleOf(x, 'NATIONAL_TEAM')).not.toBeNull() // x is untouched
    expect(await prisma.notification.count({ where: { recipientId: president.userId, type: 'BODY_SEAT_VACANT' } })).toBeGreaterThan(0)
  })

  it('F31 an expired member\'s posts and seats fall vacant and their access goes', async () => {
    await onMemberExpired(x.memberId, admin.userId)
    for (const code of ['DISTRICT_TEAM', 'STATE_TEAM', 'NATIONAL_TEAM']) expect(await roleOf(x, code)).toBeNull()
    expect(await membership(districtBody, x.memberId)).toMatchObject({ status: 'ENDED' })
    expect(await prisma.notification.count({ where: { type: 'OFFICE_VACANT', data: { path: '$.organisationId', equals: districtBody } } })).toBeGreaterThan(0)
  })

  it('a non-member sees an active organisation\'s summary only', async () => {
    const stranger = await fx.adult('stranger')
    actAs(stranger)
    const res = await (await getOrg(json('http://x', 'GET'), { params: { id: orgId } })).json()
    expect(res.full).toBe(false)
    expect(res.members.every((m: any) => m.designation !== 'MEMBER')).toBe(true)
    expect(res.organisation.registrationNumber).toBeUndefined()
  })
})
