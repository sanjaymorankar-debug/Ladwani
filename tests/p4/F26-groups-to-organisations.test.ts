import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue({ messageId: 'test' }) }))

import { prisma } from '@/lib/prisma'
import { p4Fixtures, actAs, json, type Person } from './fixtures'
import { GET as preview, POST as convert } from '@/app/api/admin/group-conversion/route'
import { POST as memberAct } from '@/app/api/organisations/[id]/members/[memberId]/route'
import { POST as decide } from '@/app/api/verification/tasks/[id]/route'

/**
 * P4 follow-up (owner's decisions): an ACTIVE community group is copied into a
 * local organisation — Convener → President, Secretary → Secretary,
 * Treasurer → Chairman; a missing post stays vacant; the taluka comes from the
 * group's place (else the group is listed); start date = group created;
 * registered members only; two Operators verify; the group is kept as it is.
 */
const fx = p4Fixtures('p4g')
let geo: Awaited<ReturnType<typeof fx.geography>>
let admin: Person, op1: Person, op2: Person, conv: Person, secy: Person, trea: Person, mem: Person, noLogin: Person
let conv2: Person, mem2: Person, extra2: Person
const groupIds: string[] = []
const ALL_TICKS = { checklist: { name: true, certificate: true, address: true, officers: true } }

async function group(name: string, areaId: string | null, roster: [Person, string][], status: 'ACTIVE' | 'PENDING_APPROVAL' = 'ACTIVE') {
  const g = await prisma.communityGroup.create({
    data: { name, areaId, status, convenerMemberId: roster.find(([, r]) => r === 'CONVENER')?.[0].memberId ?? null, description: `${name} mandal`, createdAt: new Date('2012-04-01T00:00:00Z') },
  })
  for (const [p, roleInGroup] of roster) await prisma.communityGroupMember.create({ data: { groupId: g.id, memberId: p.memberId, roleInGroup } })
  groupIds.push(g.id)
  return g.id
}
const run = async (as: Person, action: string) => { actAs(as); return convert(json('http://x', 'POST', { action })) }
const planFor = async (groupId: string) => { actAs(admin); return (await (await preview()).json()).groups.find((g: any) => g.groupId === groupId) }
const accept = (p: Person, organisationId: string) => { actAs(p); return memberAct(json('http://x', 'POST', { action: 'accept' }), { params: { id: organisationId, memberId: p.memberId } }) }
async function approveBoth(organisationId: string) {
  for (const t of await prisma.approvalTask.findMany({ where: { organisationId, supersededAt: null, status: 'OPEN' } })) {
    actAs([op1, op2].find((o) => o.userId === t.operatorUserId)!)
    expect((await decide(json('http://x', 'POST', { decision: 'APPROVED', ...ALL_TICKS }), { params: { id: t.id } })).status).toBe(200)
  }
}

let full: string, vacant: string, atDistrict: string, noPlace: string, pending: string

beforeAll(async () => {
  geo = await fx.geography()
  admin = await fx.person('admin', { roles: [{ code: 'ADMIN' }] })
  op1 = await fx.operator('op1', geo.district)
  op2 = await fx.operator('op2', geo.district)
  conv = await fx.adult('conv', { villageId: geo.village })
  secy = await fx.adult('secy', { villageId: geo.village })
  trea = await fx.adult('trea', { villageId: geo.village })
  mem = await fx.adult('mem', { villageId: geo.village })
  noLogin = await fx.profile('nologin')
  conv2 = await fx.adult('conv2', { villageId: geo.village })
  mem2 = await fx.adult('mem2', { villageId: geo.village })
  extra2 = await fx.adult('extra2', { villageId: geo.village })
  full = await group('Yuvak Mandal', geo.village, [[conv, 'CONVENER'], [secy, 'SECRETARY'], [trea, 'TREASURER'], [mem, 'MEMBER'], [noLogin, 'MEMBER']])
  vacant = await group('Bhajan Mandal', geo.taluka, [[conv2, 'CONVENER'], [mem2, 'SECRETARY'], [extra2, 'MEMBER']])
  atDistrict = await group('District Mandal', geo.district, [[mem, 'CONVENER']])
  noPlace = await group('Nowhere Mandal', null, [[mem, 'CONVENER']])
  pending = await group('Pending Mandal', geo.village, [[mem, 'CONVENER']], 'PENDING_APPROVAL')
})
afterAll(async () => {
  await prisma.communityGroupMember.deleteMany({ where: { groupId: { in: groupIds } } })
  await prisma.communityGroup.deleteMany({ where: { id: { in: groupIds } } })
  await fx.cleanup()
})

describe('F26 Community groups become local organisations (P4 follow-up)', () => {
  it('F26 only an Admin previews or converts', async () => {
    actAs(op1)
    expect((await preview()).status).toBe(403)
    expect((await run(conv, 'apply')).status).toBe(403)
  })

  it('F26 the preview maps roles, finds the taluka (village → town), uses the creation date, and lists groups it cannot place', async () => {
    const p = await planFor(full)
    expect(p).toMatchObject({ status: 'READY', talukaAreaId: geo.taluka, taluka: 'p4g Taluka', town: 'p4g Village', startedOn: '2012-04-01' })
    expect(p.offices.PRESIDENT.memberId).toBe(conv.memberId)
    expect(p.offices.SECRETARY.memberId).toBe(secy.memberId)
    expect(p.offices.CHAIRMAN.memberId).toBe(trea.memberId)
    expect(p.members.map((m: any) => m.memberId)).toEqual([mem.memberId])
    expect(p.skipped).toEqual([expect.objectContaining({ memberId: noLogin.memberId, reason: 'No login (not a registered member)' })])

    const v = await planFor(vacant)
    expect(v).toMatchObject({ status: 'READY', talukaAreaId: geo.taluka, town: 'p4g Taluka' })
    expect(v.offices.CHAIRMAN).toBeNull()

    expect(await planFor(atDistrict)).toMatchObject({ status: 'NEEDS_TALUKA', talukaAreaId: null })
    expect((await planFor(atDistrict)).reason).toContain('above taluka level')
    expect(await planFor(noPlace)).toMatchObject({ status: 'NEEDS_TALUKA' })
    expect(await planFor(pending)).toBeUndefined() // only ACTIVE groups are copied
  })

  it('F26 apply: a pending organisation per ready group; the convener (applicant) is President at once, the rest are invited; two Operators verify; the group is untouched; running again copies nothing', async () => {
    const res = await run(admin, 'apply')
    expect(res.status).toBe(200)
    const org = await prisma.organisation.findUniqueOrThrow({ where: { sourceGroupId: full } })
    expect(org).toMatchObject({ kind: 'LOCAL', name: 'Yuvak Mandal', status: 'PENDING_APPROVAL', areaId: geo.taluka, town: 'p4g Village', applicantUserId: conv.userId, purpose: 'Yuvak Mandal mandal' })
    expect(org.startedOn?.toISOString().slice(0, 10)).toBe('2012-04-01')
    const rows = await prisma.organisationMember.findMany({ where: { organisationId: org.id }, orderBy: { designation: 'asc' } })
    expect(rows.map((r) => [r.memberId, r.designation, r.status]).sort()).toEqual([
      [conv.memberId, 'PRESIDENT', 'ACTIVE'], [secy.memberId, 'SECRETARY', 'INVITED'], [trea.memberId, 'CHAIRMAN', 'INVITED'], [mem.memberId, 'MEMBER', 'INVITED'],
    ].sort())
    expect(await prisma.approvalTask.count({ where: { organisationId: org.id, round: 1 } })).toBe(2)
    expect(await prisma.notification.count({ where: { recipientId: trea.userId, type: 'ORGANISATION_INVITE' } })).toBe(1)
    expect(await prisma.auditLog.count({ where: { entityId: org.id, action: 'organisation.convert_from_group' } })).toBe(1)
    // The group stays exactly as it was.
    expect(await prisma.communityGroup.findUniqueOrThrow({ where: { id: full } })).toMatchObject({ status: 'ACTIVE', isActive: true })
    expect(await prisma.communityGroupMember.count({ where: { groupId: full, leftAt: null } })).toBe(5)
    expect(await prisma.organisation.count({ where: { sourceGroupId: { in: [atDistrict, noPlace, pending] } } })).toBe(0)

    expect((await planFor(full)).status).toBe('CONVERTED')
    await run(admin, 'apply')
    expect(await prisma.organisation.count({ where: { sourceGroupId: { in: [full, vacant] } } })).toBe(2)
  })

  it('F26 a vacant post: approved but not active until someone takes the post by hand-over; then active and promoted to the District organisation', async () => {
    const org = await prisma.organisation.findUniqueOrThrow({ where: { sourceGroupId: vacant } })
    expect((await accept(mem2, org.id)).status).toBe(200)
    expect((await accept(extra2, org.id)).status).toBe(200)
    await approveBoth(org.id)
    expect((await prisma.organisation.findUniqueOrThrow({ where: { id: org.id } })).status).toBe('PENDING_APPROVAL')

    actAs(conv2) // the President fills the vacant Chairman post
    expect((await memberAct(json('http://x', 'POST', { action: 'designate', designation: 'CHAIRMAN' }), { params: { id: org.id, memberId: extra2.memberId } })).status).toBe(200)
    expect((await accept(extra2, org.id)).status).toBe(200)
    expect((await prisma.organisation.findUniqueOrThrow({ where: { id: org.id } })).status).toBe('ACTIVE')
    expect(await prisma.bodySeat.count({ where: { fromOrganisationId: org.id } })).toBe(3)
  })

  it('F26 undo removes the copies not yet active (with invitations and tasks); an active copy and every group are kept', async () => {
    const pendingCopy = await prisma.organisation.findUniqueOrThrow({ where: { sourceGroupId: full } })
    const res = await run(admin, 'undo')
    expect(res.status).toBe(200)
    expect((await res.json()).kept.map((k: any) => k.name)).toContain('Bhajan Mandal')
    expect(await prisma.organisation.findUnique({ where: { id: pendingCopy.id } })).toBeNull()
    expect(await prisma.organisationMember.count({ where: { organisationId: pendingCopy.id } })).toBe(0)
    expect(await prisma.approvalTask.count({ where: { organisationId: pendingCopy.id } })).toBe(0)
    expect(await prisma.organisation.count({ where: { sourceGroupId: vacant, status: 'ACTIVE' } })).toBe(1)
    expect(await prisma.communityGroup.count({ where: { id: { in: groupIds } } })).toBe(groupIds.length)
    expect((await planFor(full)).status).toBe('READY') // can be copied again
  })
})
