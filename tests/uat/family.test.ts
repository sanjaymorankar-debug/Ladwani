import { describe, it, expect, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { POST as postFamilies } from '@/app/api/families/route'
import { POST as postMembers, GET as getMembers } from '@/app/api/families/[id]/members/route'
import { GET as getTree } from '@/app/api/families/[id]/tree/route'
import { POST as postJoinRequest, GET as getJoinRequests } from '@/app/api/families/[id]/join-requests/route'
import { PATCH as patchJoinRequest } from '@/app/api/families/[id]/join-requests/[reqId]/route'
import { account, bareMember, familyByReg, actAs, jsonReq } from './helpers'

const created: string[] = []
afterAll(async () => {
  for (const id of created) {
    await prisma.memberRelationship.deleteMany({ where: { OR: [{ fromMemberId: id }, { toMemberId: id }] } })
    await prisma.familyMember.deleteMany({ where: { memberId: id } })
    await prisma.educationRecord.deleteMany({ where: { memberId: id } })
    await prisma.member.deleteMany({ where: { id } })
  }
})

describe('TC-FAM — family and Karta', () => {
  it('TC-FAM-002 registering a family creates User→Member→Family→Karta', async () => {
    // A fresh member with no family, standing in for someone who just signed up.
    const m = await account('MEMBER-02')
    await prisma.familyMember.deleteMany({ where: { memberId: m.memberId } })

    actAs({ userId: m.userId, roles: ['MEMBER'], memberId: m.memberId })
    const res = await postFamilies(jsonReq('http://x/api/families', 'POST', { name: 'UatNewFam' }) as any)
    expect(res.status).toBe(201)
    const { familyId } = await res.json()

    // All four links must exist, verified in the database not the UI.
    const family = await prisma.family.findUniqueOrThrow({ where: { id: familyId } })
    const fm = await prisma.familyMember.findUniqueOrThrow({
      where: { familyId_memberId: { familyId, memberId: m.memberId } },
    })
    const kartaRole = await prisma.userRole.findFirst({
      where: { userId: m.userId, familyId, role: { code: 'KARTA' } },
    })
    expect(family.kartaMemberId).toBe(m.memberId)  // Family -> Karta
    expect(fm.isKarta).toBe(true)                   // Member -> Family membership
    expect(kartaRole).not.toBeNull()                // User -> KARTA role, scoped

    // cleanup: detach so later runs start clean
    await prisma.userRole.deleteMany({ where: { userId: m.userId, familyId } })
    await prisma.familyMember.deleteMany({ where: { familyId } })
    await prisma.approval.deleteMany({ where: { entityId: familyId } })
    await prisma.auditLog.deleteMany({ where: { entityId: familyId } })
    await prisma.family.delete({ where: { id: familyId } })
  })

  it('TC-FAM-004/005 an independent person is a valid one-person family', async () => {
    const solo = await account('INDEPENDENT-01')
    const family = await familyByReg('UAT-FAM-03')

    const members = await prisma.familyMember.findMany({ where: { familyId: family.id, leftAt: null } })
    expect(members).toHaveLength(1)
    expect(members[0].memberId).toBe(solo.memberId)
    expect(members[0].isKarta).toBe(true)
    // No invented parents/spouse/children.
    const rels = await prisma.memberRelationship.findMany({ where: { familyId: family.id } })
    expect(rels).toHaveLength(0)

    // ...and the tree renders with just them.
    actAs({ userId: solo.userId, roles: ['KARTA'], memberId: solo.memberId })
    const res = await getTree(jsonReq('http://x', 'GET') as any, { params: { id: family.id } })
    expect(res.status).toBe(200)
    const tree = await res.json()
    expect(tree.nodes).toHaveLength(1)
    expect(tree.edges).toHaveLength(0)
  })

  it('TC-FAM-006 Karta adds a family member and the relationship is stored both ways', async () => {
    const karta = await account('KARTA-01')
    actAs({ userId: karta.userId, roles: ['KARTA'], memberId: karta.memberId })

    const res = await postMembers(
      jsonReq('http://x', 'POST', {
        firstName: 'Uat', lastName: 'Nephew', gender: 'MALE',
        relatedToMemberId: karta.memberId, relationshipTypeCode: 'son',
        forceCreate: true,
      }) as any,
      { params: { id: karta.familyId! } }
    )
    expect(res.status).toBe(201)
    const { memberId } = await res.json()
    created.push(memberId)

    const forward = await prisma.memberRelationship.findFirst({
      where: { fromMemberId: memberId, toMemberId: karta.memberId }, include: { relationshipType: true },
    })
    const inverse = await prisma.memberRelationship.findFirst({
      where: { fromMemberId: karta.memberId, toMemberId: memberId }, include: { relationshipType: true },
    })
    expect(forward?.relationshipType.code).toBe('son')
    expect(inverse?.relationshipType.code).toBe('father') // bidirectional (spec §25)
  })

  it('TC-FAM-007 adding an existing person surfaces the duplicate instead of creating one', async () => {
    const karta = await account('KARTA-01')
    const existing = await bareMember('F1-SON') // Rahul, already in the community
    actAs({ userId: karta.userId, roles: ['KARTA'], memberId: karta.memberId })

    const before = await prisma.member.count()
    const res = await postMembers(
      jsonReq('http://x', 'POST', {
        firstName: existing.firstName, lastName: existing.lastName,
        gender: 'MALE', dateOfBirth: existing.dateOfBirth,
      }) as any,
      { params: { id: karta.familyId! } }
    )
    const body = await res.json()
    const after = await prisma.member.count()

    expect(res.status).toBe(409)
    expect(body.possibleDuplicates.map((d: any) => d.id)).toContain(existing.id)
    expect(after).toBe(before) // nothing was created (spec §31)
  })

  it('TC-FAM-008 an existing member can request to join, and the Karta accepts', async () => {
    const joiner = await account('MEMBER-02')
    const karta = await account('KARTA-02')
    await prisma.familyJoinRequest.deleteMany({ where: { memberId: joiner.memberId } })
    await prisma.familyMember.deleteMany({ where: { memberId: joiner.memberId } })

    actAs({ userId: joiner.userId, roles: ['MEMBER'], memberId: joiner.memberId })
    const reqRes = await postJoinRequest(jsonReq('http://x', 'POST', {}) as any, { params: { id: karta.familyId! } })
    expect(reqRes.status).toBe(201)
    const { requestId } = await reqRes.json()

    // The Karta sees it in their queue...
    actAs({ userId: karta.userId, roles: ['KARTA'], memberId: karta.memberId })
    const listRes = await getJoinRequests(jsonReq('http://x', 'GET') as any, { params: { id: karta.familyId! } })
    expect((await listRes.json()).requests.map((r: any) => r.id)).toContain(requestId)

    // ...and approving it links the member without creating a duplicate.
    const beforeMembers = await prisma.member.count()
    const patchRes = await patchJoinRequest(
      jsonReq('http://x', 'PATCH', { decision: 'APPROVE' }) as any,
      { params: { id: karta.familyId!, reqId: requestId } }
    )
    expect(patchRes.status).toBe(200)
    expect(await prisma.member.count()).toBe(beforeMembers) // no duplicate person

    const link = await prisma.familyMember.findUnique({
      where: { familyId_memberId: { familyId: karta.familyId!, memberId: joiner.memberId } },
    })
    expect(link).not.toBeNull()
    expect(link!.isKarta).toBe(false) // joining doesn't grant Karta

    await prisma.familyMember.deleteMany({ where: { memberId: joiner.memberId } })
    await prisma.familyJoinRequest.deleteMany({ where: { memberId: joiner.memberId } })
  })

  it('TC-FAM-009 a rejected join request does not create the relationship', async () => {
    const joiner = await account('MEMBER-02')
    const karta = await account('KARTA-02')
    await prisma.familyJoinRequest.deleteMany({ where: { memberId: joiner.memberId } })
    await prisma.familyMember.deleteMany({ where: { memberId: joiner.memberId } })

    actAs({ userId: joiner.userId, roles: ['MEMBER'], memberId: joiner.memberId })
    const { requestId } = await (await postJoinRequest(jsonReq('http://x', 'POST', {}) as any, { params: { id: karta.familyId! } })).json()

    actAs({ userId: karta.userId, roles: ['KARTA'], memberId: karta.memberId })
    const res = await patchJoinRequest(
      jsonReq('http://x', 'PATCH', { decision: 'REJECT' }) as any,
      { params: { id: karta.familyId!, reqId: requestId } }
    )
    expect(res.status).toBe(200)

    const link = await prisma.familyMember.findFirst({
      where: { familyId: karta.familyId!, memberId: joiner.memberId },
    })
    expect(link).toBeNull()
    await prisma.familyJoinRequest.deleteMany({ where: { memberId: joiner.memberId } })
  })
})

describe('TC-TREE — family tree', () => {
  it('TC-TREE-001 multi-generation tree is generated from relationship records', async () => {
    const karta = await account('KARTA-01')
    actAs({ userId: karta.userId, roles: ['KARTA'], memberId: karta.memberId })

    const res = await getTree(jsonReq('http://x', 'GET') as any, { params: { id: karta.familyId! } })
    expect(res.status).toBe(200)
    const tree = await res.json()

    const names = tree.nodes.map((n: any) => n.data.firstName)
    expect(names).toEqual(expect.arrayContaining(['Rajesh', 'Mohan', 'Sita', 'Anita', 'Rahul', 'Kavita']))
    expect(tree.edges.length).toBeGreaterThan(0)
  })

  it('TC-TREE-002 spouse appears as a spouse-typed edge', async () => {
    const karta = await account('KARTA-01')
    actAs({ userId: karta.userId, roles: ['KARTA'], memberId: karta.memberId })
    const tree = await (await getTree(jsonReq('http://x', 'GET') as any, { params: { id: karta.familyId! } })).json()
    expect(tree.edges.some((e: any) => e.type === 'spouse')).toBe(true)
  })

  it('TC-TREE-006 a deceased member stays in the family tree', async () => {
    const karta = await account('KARTA-01')
    const dead = await bareMember('F1-DECEASED')
    expect(dead.status).toBe('DECEASED')

    actAs({ userId: karta.userId, roles: ['KARTA'], memberId: karta.memberId })
    const tree = await (await getTree(jsonReq('http://x', 'GET') as any, { params: { id: karta.familyId! } })).json()
    const node = tree.nodes.find((n: any) => n.id === dead.id)
    expect(node).toBeDefined()                 // still present (history preserved)
    expect(node.data.status).toBe('DECEASED')  // and flagged, so the UI can style it
  })

  it('TC-TREE-005 removing a relationship does not delete the person', async () => {
    const karta = await account('KARTA-01')
    const sister = await bareMember('F1-SISTER')
    const rel = await prisma.memberRelationship.create({
      data: {
        fromMemberId: sister.id, toMemberId: karta.memberId, familyId: karta.familyId!,
        relationshipTypeId: (await prisma.relationshipType.findUniqueOrThrow({ where: { code: 'sister' } })).id,
      },
    })
    await prisma.memberRelationship.delete({ where: { id: rel.id } })

    const stillThere = await prisma.member.findUnique({ where: { id: sister.id } })
    expect(stillThere).not.toBeNull()
    const stillInFamily = await prisma.familyMember.findFirst({ where: { memberId: sister.id, familyId: karta.familyId! } })
    expect(stillInFamily).not.toBeNull()
  })
})
