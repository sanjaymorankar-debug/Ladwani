import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue({ messageId: 'test' }) }))

import { prisma } from '@/lib/prisma'
import { p3Fixtures, actAs, json, type Person } from './fixtures'
import { POST as addSibling } from '@/app/api/families/[id]/tree/siblings/route'
import { GET as linksGet, POST as linksPost } from '@/app/api/tree-links/route'
import { POST as linkAct } from '@/app/api/tree-links/[id]/route'
import { GET as getTree } from '@/app/api/families/[id]/tree/route'
import { POST as postSpouse } from '@/app/api/members/[id]/spouse/route'
import { PATCH as patchMember } from '@/app/api/members/[id]/route'
import { PATCH as approve } from '@/app/api/approvals/[id]/route'
import { PATCH as decideJoin } from '@/app/api/families/[id]/join-requests/[reqId]/route'
import { linkPeople } from '@/lib/relations'

const fx = p3Fixtures('p3l')
let geo: Awaited<ReturnType<typeof fx.geography>>
let admin: Person

async function tree(famId: string, as: Person) {
  actAs(as)
  const res = await getTree(json('http://x', 'GET'), { params: { id: famId } })
  return { status: res.status, body: await res.json() }
}
const send = (as: Person, body: Record<string, unknown>) => { actAs(as); return linksPost(json('http://x', 'POST', body)) }
const act = (as: Person, id: string, body: Record<string, unknown>) => { actAs(as); return linkAct(json('http://x', 'POST', body), { params: { id } }) }
async function twin(famId: string, firstName: string, lastName: string | null, dob: string) {
  const p = await fx.profile(`t${firstName}${famId.slice(-4)}`)
  await prisma.member.update({ where: { id: p.memberId }, data: { firstName, lastName, dateOfBirth: new Date(dob) } })
  await prisma.familyMember.create({ data: { familyId: famId, memberId: p.memberId, relationshipRole: 'uncle' } })
  return p
}

beforeAll(async () => {
  geo = await fx.geography()
  admin = await fx.person('admin', { roles: [{ code: 'ADMIN' }] })
})
afterAll(() => fx.cleanup())

describe('F22 Link a person to another family tree', () => {
  let ka: Person, kb: Person, famA: string, famB: string, op: Person
  beforeAll(async () => {
    ka = await fx.adult('ka', { villageId: geo.village })
    kb = await fx.adult('kb', { villageId: geo.village })
    famA = await fx.family('LinkA', ka, [], { villageId: geo.village })
    famB = await fx.family('LinkB', kb, [], { villageId: geo.village })
    op = await fx.operator('op', geo.district)
  })

  it('F22 conflicting data is shown side by side; when both Kartas agree the records merge into one person in both trees', async () => {
    actAs(ka)
    const sib = await (await addSibling(json('http://x', 'POST', { ofMemberId: ka.memberId, firstName: 'Kaka', gender: 'MALE', birthYear: 1970, linkFamilyId: famB }), { params: { id: famA } })).json()
    const lastName = (await prisma.member.findUniqueOrThrow({ where: { id: sib.memberId } })).lastName
    const theirs = await twin(famB, 'Kaka', lastName, '1971-03-03')

    const first = await send(ka, { fromFamilyId: famA, fromMemberId: sib.memberId, toFamilyId: famB, toMemberId: theirs.memberId })
    expect(first.status).toBe(422)
    expect((await first.json()).conflicts).toEqual([{ field: 'dateOfBirth', from: '1970-01-01', to: '1971-03-03' }])
    const sent = await send(ka, { fromFamilyId: famA, fromMemberId: sib.memberId, toFamilyId: famB, toMemberId: theirs.memberId, proposedResolution: { dateOfBirth: 'to' } })
    expect(sent.status).toBe(201)
    const { linkId } = await sent.json()
    expect(await prisma.treeLinkRequest.count({ where: { fromMemberId: sib.memberId } })).toBe(1) // the placeholder became the request
    expect(await prisma.notification.count({ where: { recipientId: kb.userId, type: 'TREE_LINK_REQUEST' } })).toBe(1)

    actAs(kb)
    const box = await (await linksGet(json(`http://x?familyId=${famB}`, 'GET'))).json()
    expect(box.incoming[0]).toMatchObject({ id: linkId, from: { person: { firstName: 'Kaka' } }, to: { person: { dateOfBirth: '1971-03-03' } } })
    expect((await act(ka, linkId, { action: 'accept', resolution: { dateOfBirth: 'to' } })).status).toBe(403)

    const ok = await act(kb, linkId, { action: 'accept', resolution: { dateOfBirth: 'to' } })
    expect(ok.status).toBe(200)
    const { memberId } = await ok.json()
    expect(memberId).toBe(theirs.memberId)
    expect((await prisma.member.findUniqueOrThrow({ where: { id: sib.memberId } })).deletedAt).not.toBeNull()
    const kept = await prisma.member.findUniqueOrThrow({ where: { id: memberId }, include: { families: { where: { leftAt: null } } } })
    expect(kept.dateOfBirth?.toISOString().slice(0, 10)).toBe('1971-03-03')
    expect(kept.families.map((f) => f.familyId).sort()).toEqual([famA, famB].sort())
    // The family links of the retired record moved: he is still Kaka, brother of the Karta of A.
    expect(await prisma.memberRelationship.count({ where: { fromMemberId: memberId, toMemberId: ka.memberId, isActive: true } })).toBeGreaterThan(0)
    const t = await tree(famA, ka)
    expect(t.body.nodes.find((n: any) => n.id === memberId).data.linkedFamilies.map((f: any) => f.id)).toEqual([famB])
    expect(await prisma.notification.count({ where: { recipientId: ka.userId, type: 'TREE_LINK_RESULT' } })).toBe(1)
    expect(await prisma.auditLog.count({ where: { action: 'family.tree.link.merge', entityId: memberId } })).toBe(1)
  })

  it('F22 when the Kartas choose differently an Operator of the families\' district decides', async () => {
    const ours = await twin(famA, 'Mavshi', 'Same', '1960-01-01')
    const theirs = await twin(famB, 'Mavshi', 'Same', '1961-01-01')
    const { linkId } = await (await send(ka, { fromFamilyId: famA, fromMemberId: ours.memberId, toFamilyId: famB, toMemberId: theirs.memberId, proposedResolution: { dateOfBirth: 'from' } })).json()
    const res = await act(kb, linkId, { action: 'accept', resolution: { dateOfBirth: 'to' } })
    expect(res.status).toBe(202)
    expect((await prisma.treeLinkRequest.findUniqueOrThrow({ where: { id: linkId } })).status).toBe('OPERATOR_REVIEW')
    expect(await prisma.notification.count({ where: { recipientId: op.userId, type: 'TREE_LINK_REVIEW' } })).toBeGreaterThan(0)

    const farOp = await fx.operator('farop', geo.district2)
    expect((await act(farOp, linkId, { action: 'resolve', resolution: { dateOfBirth: 'from' } })).status).toBe(403)
    actAs(op)
    expect((await (await linksGet(json('http://x', 'GET'))).json()).review.map((l: any) => l.id)).toContain(linkId)
    const done = await act(op, linkId, { action: 'resolve', resolution: { dateOfBirth: 'from' } })
    expect(done.status).toBe(200)
    expect((await prisma.member.findUniqueOrThrow({ where: { id: theirs.memberId } })).dateOfBirth?.toISOString().slice(0, 10)).toBe('1960-01-01')
  })

  it('F22 reject needs a reason; the requester can cancel; two records with their own logins are not merged', async () => {
    const a = await twin(famA, 'Chachi', 'X', '1965-01-01')
    const b = await twin(famB, 'Chachi', 'X', '1965-01-01')
    const { linkId } = await (await send(ka, { fromFamilyId: famA, fromMemberId: a.memberId, toFamilyId: famB, toMemberId: b.memberId })).json()
    expect((await act(kb, linkId, { action: 'reject' })).status).toBe(400)
    expect((await act(kb, linkId, { action: 'reject', reason: 'Different person' })).status).toBe(200)

    const again = await (await send(ka, { fromFamilyId: famA, fromMemberId: a.memberId, toFamilyId: famB, toMemberId: b.memberId })).json()
    expect((await act(ka, again.linkId, { action: 'cancel' })).status).toBe(200)

    expect((await send(ka, { fromFamilyId: famA, fromMemberId: ka.memberId, toFamilyId: famB, toMemberId: kb.memberId })).status).toBe(409)
  })

  it("F22 a plain member may ask for a link (owner's decision); the other family's Karta still decides; the member can cancel", async () => {
    const memA = await fx.adult('lnkmema', { villageId: geo.village })
    const memB = await fx.adult('lnkmemb', { villageId: geo.village })
    await prisma.familyMember.create({ data: { familyId: famA, memberId: memA.memberId, relationshipRole: 'brother', relativeToMemberId: ka.memberId } })
    await prisma.familyMember.create({ data: { familyId: famB, memberId: memB.memberId, relationshipRole: 'brother', relativeToMemberId: kb.memberId } })
    const a = await twin(famA, 'Atya', 'Y', '1960-01-01')
    const b = await twin(famB, 'Atya', 'Y', '1960-01-01')
    const res = await send(memA, { fromFamilyId: famA, fromMemberId: a.memberId, toFamilyId: famB, toMemberId: b.memberId })
    expect(res.status).toBe(201)
    const { linkId } = await res.json()
    // A member of the other family is not its Karta: cannot accept.
    expect((await act(memB, linkId, { action: 'accept', resolution: {} })).status).toBe(403)
    // Someone outside famA cannot ask on its behalf.
    expect((await send(memB, { fromFamilyId: famA, fromMemberId: a.memberId, toFamilyId: famB, toMemberId: b.memberId })).status).toBe(403)
    expect((await act(memA, linkId, { action: 'cancel' })).status).toBe(200)
  })
})

describe('F23 Marital status change triggers new family link / F24 one person in several families', () => {
  let gk: Person, g: Person, bk: Person, br: Person, sis: Person, famG: string, famBr: string

  beforeAll(async () => {
    gk = await fx.adult('gk', { dob: '1965-01-01' })
    g = await fx.adult('g', { dob: '1995-01-01' })
    bk = await fx.adult('bk', { dob: '1968-01-01' })
    br = await fx.adult('br', { gender: 'FEMALE', dob: '1998-01-01' })
    sis = await fx.adult('sis', { gender: 'FEMALE', dob: '2000-01-01' })
    famG = await fx.family('Groom', gk, [{ p: g, role: 'son' }])
    famBr = await fx.family('Bride', bk, [{ p: br, role: 'daughter' }, { p: sis, role: 'daughter' }])
    await linkPeople(prisma, gk.memberId, g.memberId, 'father', gk.userId, famG)
    await linkPeople(prisma, bk.memberId, br.memberId, 'father', bk.userId, famBr)
    await linkPeople(prisma, bk.memberId, sis.memberId, 'father', bk.userId, famBr)
  })

  async function marry(as: Person, memberId: string, body: Record<string, unknown>) {
    actAs(as)
    const res = await postSpouse(json('http://x', 'POST', body), { params: { id: memberId } })
    if (res.status !== 202) return res
    const approval = await prisma.approval.findFirstOrThrow({ where: { actionCode: 'member.marital_status.change', entityId: memberId, status: 'SUBMITTED' } })
    actAs(admin)
    return approve(json('http://x', 'PATCH', { action: 'approve' }), { params: { id: approval.id } })
  }

  it('F23 legal age is checked before "Married": 21 for a man, 18 for a woman', async () => {
    const young = await fx.adult('young', { dob: `${new Date().getFullYear() - 20}-01-01` })
    actAs(young)
    const res = await postSpouse(json('http://x', 'POST', { spouseMemberId: sis.memberId }), { params: { id: young.memberId } })
    expect(res.status).toBe(400)
    expect((await res.json()).message).toMatch(/legal age/)
    expect((await postSpouse(json('http://x', 'POST', { spouseMemberId: br.memberId, marriageDate: '2999-01-01' }), { params: { id: young.memberId } })).status).toBe(400)
  })

  it('F23 the marriage asks each spouse\'s family Karta to add the other; nobody leaves their birth family; Kartas told', async () => {
    const res = await marry(g, g.memberId, { spouseMemberId: br.memberId, marriageDate: '2024-02-01' })
    expect(res.status).toBe(200)
    expect((await prisma.marriageRecord.findFirstOrThrow({ where: { memberId1: g.memberId, memberId2: br.memberId } })).marriageDate?.toISOString().slice(0, 10)).toBe('2024-02-01')

    const toGroomFamily = await prisma.familyJoinRequest.findFirstOrThrow({ where: { familyId: famG, memberId: br.memberId } })
    expect(toGroomFamily).toMatchObject({ origin: 'MARRIAGE', status: 'PENDING', relationshipTypeCode: 'daughter_in_law', relatedToMemberId: gk.memberId })
    const toBrideFamily = await prisma.familyJoinRequest.findFirstOrThrow({ where: { familyId: famBr, memberId: g.memberId } })
    expect(toBrideFamily).toMatchObject({ origin: 'MARRIAGE', relationshipTypeCode: 'son_in_law', relatedToMemberId: bk.memberId })
    expect(await prisma.notification.count({ where: { recipientId: gk.userId, type: 'MARRIAGE_FAMILY_REQUEST' } })).toBe(1)
    expect(await prisma.notification.count({ where: { recipientId: bk.userId, type: { in: ['MARRIAGE_FAMILY_REQUEST', 'MARRIAGE_RECORDED'] } } })).toBe(2)
    expect(await prisma.familyMember.count({ where: { memberId: br.memberId, leftAt: null } })).toBe(1) // still only her birth family

    // The groom's Karta accepts: she is now in both families, with a different role in each (F24).
    actAs(gk)
    expect((await decideJoin(json('http://x', 'PATCH', { decision: 'APPROVE' }), { params: { id: famG, reqId: toGroomFamily.id } })).status).toBe(200)
    const roles = await prisma.familyMember.findMany({ where: { memberId: br.memberId, leftAt: null }, select: { familyId: true, relationshipRole: true } })
    expect(Object.fromEntries(roles.map((r) => [r.familyId, r.relationshipRole]))).toEqual({ [famBr]: 'daughter', [famG]: 'daughter_in_law' })
    expect(await prisma.notification.count({ where: { recipientId: br.userId, title: 'Family request accepted' } })).toBe(1)

    const t = await tree(famG, gk)
    const node = t.body.nodes.find((n: any) => n.id === br.memberId)
    expect(node.data.role).toBe('Daughter-in-law')
    expect(node.data.linkedFamilies.map((f: any) => f.id)).toEqual([famBr]) // jump icon to her birth family
    expect(t.body.edges.some((e: any) => e.kind === 'spouse' && [e.source, e.target].includes(br.memberId))).toBe(true)
  })

  it('F25 non-members see nothing; a linked family\'s member sees only the connecting branch, without personal details', async () => {
    const outsider = await fx.adult('outsider')
    expect((await tree(famG, outsider)).status).toBe(403)
    const branch = await tree(famG, sis) // sister of the bride, member of the bride's family only
    expect(branch.status).toBe(200)
    expect(branch.body.mode).toBe('BRANCH')
    const ids = branch.body.nodes.map((n: any) => n.id)
    expect(ids).toEqual(expect.arrayContaining([br.memberId, g.memberId]))
    expect(ids).not.toContain(gk.memberId)
    expect(branch.body.nodes[0].data.dateOfBirth).toBeUndefined()
    expect(branch.body.nodes[0].data.currentCity).toBeUndefined()
    expect((await tree(famG, admin)).body.mode).toBe('FULL')
  })

  it('F23 divorce marks the marriage link and keeps its history', async () => {
    actAs(g)
    const me = await prisma.member.update({ where: { id: g.memberId }, data: { firstName: 'Gopal' } })
    const res = await patchMember(json('http://x', 'PATCH', { firstName: me.firstName, gender: me.gender, maritalStatus: 'DIVORCED' }), { params: { id: g.memberId } })
    expect(res.status).toBe(200)
    expect((await prisma.marriageRecord.findFirstOrThrow({ where: { memberId1: g.memberId } })).status).toBe('DIVORCED')
    expect((await prisma.member.findUniqueOrThrow({ where: { id: br.memberId } })).maritalStatus).toBe('DIVORCED')
    expect(await prisma.maritalStatusHistory.count({ where: { memberId: { in: [g.memberId, br.memberId] } } })).toBeGreaterThanOrEqual(4)
    const t = await tree(famG, gk)
    expect(t.body.edges.find((e: any) => e.kind === 'spouse' && [e.source, e.target].includes(br.memberId)).label).toBe('Divorced')
    // She keeps her place in both families: history is not erased.
    expect(await prisma.familyMember.count({ where: { memberId: br.memberId, leftAt: null } })).toBe(2)
  })

  it('F23 a spouse not yet on the site can be recorded as a person, so their side of the tree can be built', async () => {
    const son2 = await fx.profile('son2', { dob: '1992-01-01' })
    await prisma.familyMember.create({ data: { familyId: famG, memberId: son2.memberId, relationshipRole: 'son', relativeToMemberId: gk.memberId } })
    await linkPeople(prisma, gk.memberId, son2.memberId, 'father', gk.userId, famG)
    const res = await marry(gk, son2.memberId, { newSpouse: { firstName: 'Neha', lastName: 'New', gender: 'FEMALE', dateOfBirth: '1994-04-04' } })
    expect(res.status).toBe(200)
    const m = await prisma.marriageRecord.findFirstOrThrow({ where: { memberId1: son2.memberId } })
    const neha = await prisma.member.findUniqueOrThrow({ where: { id: m.memberId2! } })
    expect(neha).toMatchObject({ firstName: 'Neha', gender: 'FEMALE', userId: null, maritalStatus: 'MARRIED' })
    expect(await prisma.familyJoinRequest.findFirst({ where: { familyId: famG, memberId: neha.id } })).toMatchObject({ origin: 'MARRIAGE', relationshipTypeCode: 'daughter_in_law' })
  })
})
