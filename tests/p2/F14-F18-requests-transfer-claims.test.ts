import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue({ messageId: 'test' }) }))

import { prisma } from '@/lib/prisma'
import { p2Fixtures, actAs, json, type Person } from './fixtures'
import { POST as joinRequest, GET as inbox } from '@/app/api/families/[id]/join-requests/route'
import { PATCH as decideJoin } from '@/app/api/families/[id]/join-requests/[reqId]/route'
import { POST as nominate } from '@/app/api/families/[id]/karta/route'
import { POST as transferAction } from '@/app/api/karta-transfers/[id]/route'
import { GET as myTransfers } from '@/app/api/karta-transfers/route'
import { PATCH as approveGeneric } from '@/app/api/approvals/[id]/route'
import { GET as claimsGet, POST as claimPost } from '@/app/api/claims/route'
import { POST as claimDecide } from '@/app/api/claims/[id]/route'
import { PATCH as changeRole } from '@/app/api/families/[id]/members/[memberId]/route'
import { GET as cronDaily } from '@/app/api/cron/daily/route'
import { openKartaVacancy } from '@/lib/family-rules'

const fx = p2Fixtures('p2req')
let geo: Awaited<ReturnType<typeof fx.geography>>
let admin: Person

beforeAll(async () => {
  geo = await fx.geography()
  admin = await fx.person('admin', { roles: [{ code: 'ADMIN' }] })
  process.env.CRON_SECRET = 'p2-cron-secret-0123456789'
})
afterAll(() => fx.cleanup())

describe('F14 Request to join / F15 Karta accepts or rejects', () => {
  let k: Person, famId: string, wife: Person
  beforeAll(async () => {
    k = await fx.adult('k14')
    wife = await fx.adult('w14', { gender: 'FEMALE' })
    famId = await fx.family('Join', k, [{ p: wife, role: 'wife' }])
  })
  const ask = (p: Person, body: Record<string, unknown> = {}) => { actAs(p); return joinRequest(json('http://x', 'POST', body), { params: { id: famId } }) }
  const decide = (who: Person, reqId: string, body: Record<string, unknown>) => { actAs(who); return decideJoin(json('http://x', 'PATCH', body), { params: { id: famId, reqId } }) }

  it('F14 a member of another family can ask to join; one open request per person per family; the Karta is told', async () => {
    const asker = await fx.adult('a14')
    await fx.family('Home14', await fx.adult('hk14'), [{ p: asker, role: 'son' }])
    const res = await ask(asker, { relationshipTypeCode: 'brother', relatedToMemberId: k.memberId })
    expect(res.status).toBe(201)
    expect((await ask(asker)).status).toBe(409)
    expect(await prisma.notification.count({ where: { recipientId: k.userId, data: { path: ['familyId'], equals: famId } } })).toBeGreaterThan(0)
  })

  it('F14 the claimed role must suit the person', async () => {
    const asker = await fx.adult('b14')
    expect((await ask(asker, { relationshipTypeCode: 'sister', relatedToMemberId: k.memberId })).status).toBe(400)
  })

  it('F15 the Karta may correct the role on accept; membership and both-way links are created; requester told', async () => {
    const asker = await fx.adult('c14')
    const { requestId } = await (await ask(asker, { relationshipTypeCode: 'brother', relatedToMemberId: k.memberId })).json()
    const res = await decide(k, requestId, { decision: 'APPROVE', relationshipTypeCode: 'son', relatedToMemberId: wife.memberId })
    expect(res.status).toBe(200)
    expect(await prisma.familyMember.findFirst({ where: { familyId: famId, memberId: asker.memberId } })).toMatchObject({ relationshipRole: 'son', relativeToMemberId: wife.memberId, status: 'ACTIVE' })
    const back = await prisma.memberRelationship.findFirst({ where: { fromMemberId: wife.memberId, toMemberId: asker.memberId }, include: { relationshipType: true } })
    expect(back?.relationshipType.code).toBe('mother') // inverse of 'son', fitted to her gender (P3)
    expect(await prisma.notification.count({ where: { recipientId: asker.userId, title: { contains: 'accepted' } } })).toBe(1)
  })

  it('F15 reject with a reason; a second request can be rejected again (the old unique index blocked that)', async () => {
    const asker = await fx.adult('d14')
    for (let i = 0; i < 2; i++) {
      const { requestId } = await (await ask(asker)).json()
      expect((await decide(k, requestId, { decision: 'REJECT', note: 'Not our family' })).status).toBe(200)
    }
    expect(await prisma.familyJoinRequest.count({ where: { familyId: famId, memberId: asker.memberId, status: 'REJECTED' } })).toBe(2)
  })

  it('F15 every rejection gives a reason (owner\'s decision); someone declining an invitation they received need not', async () => {
    const asker = await fx.adult('rr14')
    const { requestId } = await (await ask(asker)).json()
    expect((await decide(k, requestId, { decision: 'REJECT' })).status).toBe(400)
    expect((await decide(k, requestId, { decision: 'REJECT', note: '   ' })).status).toBe(400)
    expect((await prisma.familyJoinRequest.findUniqueOrThrow({ where: { id: requestId } })).status).toBe('PENDING')
    const invitee = await fx.adult('ri14')
    const invite = await prisma.familyJoinRequest.create({ data: { familyId: famId, memberId: invitee.memberId, direction: 'KARTA_INVITE', requestedBy: k.userId } })
    expect((await decide(invitee, invite.id, { decision: 'REJECT' })).status).toBe(200)
    // The review queue (§28) too: reject and send back need the reason before anything else.
    actAs(admin)
    for (const action of ['reject', 'return']) {
      expect((await approveGeneric(json('http://x', 'PATCH', { action }), { params: { id: 'no-such-approval' } })).status).toBe(400)
      expect((await approveGeneric(json('http://x', 'PATCH', { action, note: 'Wrong family' }), { params: { id: 'no-such-approval' } })).status).toBe(404)
    }
  })

  it('F15 a request unanswered for 30 days expires — on read and by the daily cron', async () => {
    const asker = await fx.adult('e14')
    const { requestId } = await (await ask(asker)).json()
    await prisma.familyJoinRequest.update({ where: { id: requestId }, data: { createdAt: new Date(Date.now() - 31 * 86400000) } })
    expect((await decide(k, requestId, { decision: 'APPROVE' })).status).toBe(409)
    expect((await prisma.familyJoinRequest.findUniqueOrThrow({ where: { id: requestId } })).status).toBe('EXPIRED')

    const again = await fx.adult('f14')
    const second = await (await ask(again)).json()
    await prisma.familyJoinRequest.update({ where: { id: second.requestId }, data: { createdAt: new Date(Date.now() - 31 * 86400000) } })
    const cron = await cronDaily(new Request('http://x', { headers: { 'x-cron-secret': process.env.CRON_SECRET! } }))
    expect((await cron.json()).joinRequestsExpired).toBeGreaterThanOrEqual(1)
    actAs(k)
    const box = await (await inbox(json('http://x', 'GET'), { params: { id: famId } })).json()
    expect(box.requests.map((r: any) => r.id)).not.toContain(second.requestId)
  })

  it('only this family\'s Karta decides a member request', async () => {
    const asker = await fx.adult('g14')
    const { requestId } = await (await ask(asker)).json()
    expect((await decide(wife, requestId, { decision: 'APPROVE' })).status).toBe(403)
    expect((await decide(asker, requestId, { decision: 'APPROVE' })).status).toBe(403)
  })
})

describe('F16 Karta transfer / succession', () => {
  it('F16 voluntary: the nominee must accept; then the (existing) Admin review; the old Karta becomes a normal member', async () => {
    const k = await fx.adult('k16', { dob: '1950-01-01' })
    const son = await fx.adult('son16', { dob: '1980-01-01' })
    const famId = await fx.family('Hand', k, [{ p: son, role: 'son' }])
    actAs(k)
    const res = await nominate(json('http://x', 'POST', { newKartaMemberId: son.memberId }), { params: { id: famId } })
    expect(res.status).toBe(202)
    const { transferId } = await res.json()
    expect(await prisma.notification.count({ where: { recipientId: son.userId, type: 'KARTA_NOMINATION' } })).toBe(1)

    actAs(son)
    expect((await myTransfers()).status).toBe(200)
    actAs(k) // the nominator cannot accept on the nominee's behalf
    expect((await transferAction(json('http://x', 'POST', { action: 'accept' }), { params: { id: transferId } })).status).toBe(403)
    actAs(son)
    expect((await transferAction(json('http://x', 'POST', { action: 'accept' }), { params: { id: transferId } })).status).toBe(202)
    // Nothing changes until the Admin review.
    expect((await prisma.family.findUniqueOrThrow({ where: { id: famId } })).kartaMemberId).toBe(k.memberId)
    const approval = await prisma.approval.findFirstOrThrow({ where: { actionCode: 'family.karta.change', entityId: famId, status: 'SUBMITTED' } })
    actAs(admin)
    expect((await approveGeneric(json('http://x', 'PATCH', { action: 'approve' }), { params: { id: approval.id } })).status).toBe(200)

    expect((await prisma.family.findUniqueOrThrow({ where: { id: famId } })).kartaMemberId).toBe(son.memberId)
    expect(await prisma.familyMember.findFirst({ where: { familyId: famId, memberId: son.memberId } })).toMatchObject({ isKarta: true, relationshipRole: 'karta' })
    expect(await prisma.familyMember.findFirst({ where: { familyId: famId, memberId: k.memberId } })).toMatchObject({ isKarta: false, relationshipRole: 'father', relativeToMemberId: son.memberId })
    expect((await prisma.kartaTransfer.findUniqueOrThrow({ where: { id: transferId } })).status).toBe('CONFIRMED')
    expect(await prisma.familyMember.count({ where: { familyId: famId, isKarta: true, leftAt: null } })).toBe(1)
  })

  it('F16 the nominee may decline; a minor or account-less member cannot be nominated', async () => {
    const k = await fx.adult('k16b')
    const bro = await fx.adult('bro16b')
    const kid = await fx.profile('kid16b', { dob: '2015-01-01' })
    const famId = await fx.family('Decline', k, [{ p: bro, role: 'brother' }, { p: kid, role: 'son' }])
    actAs(k)
    expect((await nominate(json('http://x', 'POST', { newKartaMemberId: kid.memberId }), { params: { id: famId } })).status).toBe(400)
    const { transferId } = await (await nominate(json('http://x', 'POST', { newKartaMemberId: bro.memberId }), { params: { id: famId } })).json()
    actAs(bro)
    expect((await transferAction(json('http://x', 'POST', { action: 'decline' }), { params: { id: transferId } })).status).toBe(200)
    expect((await prisma.family.findUniqueOrThrow({ where: { id: famId } })).kartaMemberId).toBe(k.memberId)
  })

  it('F16 vacancy: only an Operator of the family\'s district (or an Admin) confirms; the family is whole again', async () => {
    const k = await fx.adult('k16c', { dob: '1950-01-01' })
    const heir = await fx.adult('heir16c', { dob: '1978-01-01' })
    const famId = await fx.family('Succession', k, [{ p: heir, role: 'son' }], { villageId: geo.village })
    const transfer = await openKartaVacancy(famId, k.memberId, admin.userId)
    expect(transfer!.suggestedMemberId).toBe(heir.memberId)

    const farOp = await fx.operator('farop16', geo.district2)
    actAs(farOp)
    expect((await transferAction(json('http://x', 'POST', { action: 'confirm' }), { params: { id: transfer!.id } })).status).toBe(403)
    const op = await fx.operator('op16', geo.district)
    actAs(op)
    const listed = await (await myTransfers()).json()
    expect(listed.vacancies.map((v: any) => v.id)).toContain(transfer!.id)
    expect((await transferAction(json('http://x', 'POST', { action: 'confirm' }), { params: { id: transfer!.id } })).status).toBe(200)
    const fam = await prisma.family.findUniqueOrThrow({ where: { id: famId } })
    expect(fam).toMatchObject({ status: 'ACTIVE', kartaMemberId: heir.memberId })
    expect(await prisma.auditLog.count({ where: { action: 'family.karta.confirm_vacancy', entityId: famId } })).toBe(1)
  })

  it('F16 a family left vacant beyond the SLA alerts the District team and Admin (once)', async () => {
    const k = await fx.adult('k16d')
    const famId = await fx.family('Slow', k, [], { villageId: geo.village })
    const team = await fx.person('dteam16', { roles: [{ code: 'DISTRICT_TEAM', areaId: geo.district }] })
    const t = await openKartaVacancy(famId, k.memberId, admin.userId)
    await prisma.kartaTransfer.update({ where: { id: t!.id }, data: { createdAt: new Date(Date.now() - 8 * 86400000) } })
    const headers = { 'x-cron-secret': process.env.CRON_SECRET! }
    expect((await (await cronDaily(new Request('http://x', { headers }))).json()).vacanciesEscalated).toBeGreaterThanOrEqual(1)
    await cronDaily(new Request('http://x', { headers }))
    expect(await prisma.notification.count({ where: { recipientId: team.userId, type: 'KARTA_VACANT_SLA' } })).toBe(1)
  })
})

describe('F17 Claim a non-login profile', () => {
  let k: Person, famId: string, target: Person, me: Person
  beforeAll(async () => {
    k = await fx.adult('k17')
    target = await fx.profile('claimme', { dob: '1996-06-06', mobile: '9811177777' })
    await prisma.member.update({ where: { id: target.memberId }, data: { lastName: 'Claimed' } })
    famId = await fx.family('Claim', k, [{ p: target, role: 'son' }])
    // The real person registers separately (a second record for the same person).
    me = await fx.applicant('registrant', geo.village)
    await prisma.member.update({ where: { id: me.memberId }, data: { firstName: 'claimme', lastName: 'Claimed', dateOfBirth: new Date('1996-06-06') } })
  })

  it('F17 the registrant sees the matching profile (limited view) and says "This is me"; the Karta is told', async () => {
    actAs(me)
    const { matches } = await (await claimsGet()).json()
    expect(matches).toHaveLength(1)
    expect(Object.keys(matches[0]).sort()).toEqual(['birthYear', 'families', 'memberId', 'mulGaon', 'name'])
    const res = await claimPost(json('http://x', 'POST', { memberId: target.memberId }))
    expect(res.status).toBe(201)
    expect(await prisma.notification.count({ where: { recipientId: k.userId, type: 'PROFILE_CLAIM' } })).toBe(1)
  })

  it('F17 only that family\'s Karta can confirm', async () => {
    const claim = await prisma.profileClaim.findFirstOrThrow({ where: { userId: me.userId } })
    actAs(me)
    expect((await claimDecide(json('http://x', 'POST', { decision: 'CONFIRM' }), { params: { id: claim.id } })).status).toBe(403)
  })

  it('F17 rejecting a claim gives a reason (owner\'s decision)', async () => {
    const claim = await prisma.profileClaim.findFirstOrThrow({ where: { userId: me.userId } })
    actAs(k)
    expect((await claimDecide(json('http://x', 'POST', { decision: 'REJECT' }), { params: { id: claim.id } })).status).toBe(400)
    expect((await prisma.profileClaim.findUniqueOrThrow({ where: { id: claim.id } })).status).toBe('PENDING')
  })

  it('F17 on confirm the records merge: one person, with the login, the family links and the registration data', async () => {
    const claim = await prisma.profileClaim.findFirstOrThrow({ where: { userId: me.userId } })
    actAs(k)
    expect((await claimDecide(json('http://x', 'POST', { decision: 'CONFIRM' }), { params: { id: claim.id } })).status).toBe(200)
    const merged = await prisma.member.findUniqueOrThrow({ where: { id: target.memberId } })
    expect(merged.userId).toBe(me.userId)
    const retired = await prisma.member.findUniqueOrThrow({ where: { id: me.memberId } })
    expect(retired.userId).toBeNull()
    expect(retired.deletedAt).not.toBeNull()
    expect(await prisma.familyMember.findFirst({ where: { familyId: famId, memberId: target.memberId, leftAt: null } })).toMatchObject({ relationshipRole: 'son' })
    expect((await prisma.memberArea.findFirstOrThrow({ where: { memberId: target.memberId, isPrimary: true } })).areaId).toBe(geo.village)
    expect(await prisma.address.count({ where: { memberId: target.memberId } })).toBe(2)
    expect(await prisma.auditLog.count({ where: { action: 'member.claim.merge', entityId: target.memberId } })).toBe(1)
    // Registration status is unchanged: the two-operator approval still applies.
    expect((await prisma.user.findUniqueOrThrow({ where: { id: me.userId } })).status).toBe('DRAFT')
    fx.memberIds.push(target.memberId)
  })
})

describe('F18 Operator changes / adds a member\'s role', () => {
  let k: Person, famId: string, m: Person, wife: Person, op: Person
  beforeAll(async () => {
    k = await fx.adult('k18')
    wife = await fx.adult('w18', { gender: 'FEMALE' })
    m = await fx.adult('m18')
    famId = await fx.family('Roles', k, [{ p: wife, role: 'wife' }, { p: m, role: 'brother' }], { villageId: geo.village })
    op = await fx.operator('op18', geo.district)
  })
  const change = (who: Person, body: Record<string, unknown>) => { actAs(who); return changeRole(json('http://x', 'PATCH', body), { params: { id: famId, memberId: m.memberId } }) }

  it('F18 an Operator of the family\'s district changes the role with a mandatory remark; audited; Karta and member told', async () => {
    expect((await change(op, { relationshipRole: 'son', relativeToMemberId: k.memberId })).status).toBe(400) // no remark
    expect((await change(op, { relationshipRole: 'son', relativeToMemberId: k.memberId, remark: 'Reported by the family: he is the son' })).status).toBe(200)
    const row = await prisma.familyMember.findFirstOrThrow({ where: { familyId: famId, memberId: m.memberId } })
    expect(row).toMatchObject({ relationshipRole: 'son', relativeToMemberId: k.memberId })
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'family.member.role_change', entityId: row.id } })
    expect(log.oldValue).toMatchObject({ relationshipRole: 'brother' })
    expect(log.newValue).toMatchObject({ relationshipRole: 'son' })
    expect((log.metadata as any).remark).toMatch(/son/)
    expect(await prisma.notification.count({ where: { recipientId: k.userId, type: 'FAMILY_ROLE' } })).toBe(1)
    expect(await prisma.notification.count({ where: { recipientId: m.userId, type: 'FAMILY_ROLE' } })).toBe(1)
  })

  it('F18 an Operator of another district, or a plain member, cannot; gender still has to fit', async () => {
    const far = await fx.operator('far18', geo.district2)
    expect((await change(far, { relationshipRole: 'son', relativeToMemberId: k.memberId, remark: 'not my district' })).status).toBe(403)
    expect((await change(wife, { relationshipRole: 'son', relativeToMemberId: k.memberId, remark: 'nope nope' })).status).toBe(403)
    expect((await change(op, { relationshipRole: 'daughter', relativeToMemberId: k.memberId, remark: 'wrong gender' })).status).toBe(400)
  })

  it('F18 the Karta can also change a role (no remark needed)', async () => {
    expect((await change(k, { relationshipRole: 'nephew_brothers', relativeToMemberId: k.memberId })).status).toBe(200)
  })
})
