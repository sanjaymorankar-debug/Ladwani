import { describe, it, expect, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { PATCH as patchMember, GET as getMember } from '@/app/api/members/[id]/route'
import { PATCH as patchFamily } from '@/app/api/families/[id]/route'
import { POST as postFamilyMembers, GET as getFamilyMembers } from '@/app/api/families/[id]/members/route'
import { GET as getTree } from '@/app/api/families/[id]/tree/route'
import { GET as getJoinRequests } from '@/app/api/families/[id]/join-requests/route'
import { GET as getAdminUser, PATCH as patchAdminUser } from '@/app/api/admin/users/[id]/route'
import { POST as postRelationshipType } from '@/app/api/relationship-types/route'
import { PATCH as patchApproval } from '@/app/api/approvals/[id]/route'
import { account, bareMember, actAs, anonymous, jsonReq } from './helpers'

const edit = (body: any = {}) => jsonReq('http://x', 'PATCH', { firstName: 'Hacked', gender: 'MALE', ...body })

describe('TC-PERM — member-level isolation', () => {
  it('TC-PERM-001 MEMBER-01 cannot edit MEMBER-02', async () => {
    const a = await account('MEMBER-01')
    const b = await account('MEMBER-02')
    actAs({ userId: a.userId, roles: a.roles, memberId: a.memberId })
    const res = await patchMember(edit() as any, { params: { id: b.memberId } })
    expect(res.status).toBe(403)
  })

  it('TC-PERM-001b MEMBER-02 cannot edit MEMBER-01 either (both directions)', async () => {
    const a = await account('MEMBER-01')
    const b = await account('MEMBER-02')
    actAs({ userId: b.userId, roles: b.roles, memberId: b.memberId })
    const res = await patchMember(edit() as any, { params: { id: a.memberId } })
    expect(res.status).toBe(403)
  })

  it('TC-PERM-001c a member CAN edit their own profile', async () => {
    const a = await account('MEMBER-01')
    actAs({ userId: a.userId, roles: a.roles, memberId: a.memberId })
    const res = await patchMember(
      jsonReq('http://x', 'PATCH', { firstName: 'Arun', gender: 'MALE', biography: 'self-edit ok' }) as any,
      { params: { id: a.memberId } }
    )
    expect(res.status).toBe(200)
  })

  it('TC-PERM-004 a Karta cannot override another ADULT ACCOUNT-HOLDER in their own family', async () => {
    const karta = await account('KARTA-01')
    const member01 = await account('MEMBER-01') // has a login, is in Family-01
    expect(member01.familyId).toBe(karta.familyId)

    actAs({ userId: karta.userId, roles: karta.roles, memberId: karta.memberId })
    const res = await patchMember(edit() as any, { params: { id: member01.memberId } })
    expect(res.status).toBe(403) // spec §27
  })

  it('TC-PERM-004b a Karta CAN maintain an account-less member of their own family', async () => {
    const karta = await account('KARTA-01')
    const father = await bareMember('F1-FATHER') // no login of his own
    actAs({ userId: karta.userId, roles: karta.roles, memberId: karta.memberId })
    const res = await patchMember(
      jsonReq('http://x', 'PATCH', { firstName: 'Mohan', gender: 'MALE', biography: 'maintained by Karta' }) as any,
      { params: { id: father.id } }
    )
    expect(res.status).toBe(200)
  })

  it('TC-PERM-004c a Karta cannot maintain an account-less member of ANOTHER family', async () => {
    const karta1 = await account('KARTA-01')
    const otherFamilyMember = await bareMember('F2-DAUGHTER') // Family-02
    actAs({ userId: karta1.userId, roles: karta1.roles, memberId: karta1.memberId })
    const res = await patchMember(edit({ firstName: 'Priya' }) as any, { params: { id: otherFamilyMember.id } })
    expect(res.status).toBe(403)
  })
})

describe('TC-PERM / TC-KARTA2 — family-level isolation (two Kartas)', () => {
  it('TC-PERM-003 KARTA-01 cannot edit Family-02', async () => {
    const k1 = await account('KARTA-01')
    const k2 = await account('KARTA-02')
    actAs({ userId: k1.userId, roles: k1.roles, memberId: k1.memberId })
    const res = await patchFamily(jsonReq('http://x', 'PATCH', { name: 'Hijacked' }) as any, { params: { id: k2.familyId! } })
    expect(res.status).toBe(403)
  })

  it('TC-PERM-003b KARTA-02 cannot edit Family-01 (reverse direction)', async () => {
    const k1 = await account('KARTA-01')
    const k2 = await account('KARTA-02')
    actAs({ userId: k2.userId, roles: k2.roles, memberId: k2.memberId })
    const res = await patchFamily(jsonReq('http://x', 'PATCH', { name: 'Hijacked' }) as any, { params: { id: k1.familyId! } })
    expect(res.status).toBe(403)
  })

  it('TC-KARTA2-001 KARTA-01 cannot add members to Family-02', async () => {
    const k1 = await account('KARTA-01')
    const k2 = await account('KARTA-02')
    actAs({ userId: k1.userId, roles: k1.roles, memberId: k1.memberId })
    const res = await postFamilyMembers(
      jsonReq('http://x', 'POST', { firstName: 'Intruder', gender: 'MALE', forceCreate: true }) as any,
      { params: { id: k2.familyId! } }
    )
    expect(res.status).toBe(403)
  })

  it('TC-KARTA2-002 KARTA-01 cannot read Family-02\'s tree or member list', async () => {
    const k1 = await account('KARTA-01')
    const k2 = await account('KARTA-02')
    actAs({ userId: k1.userId, roles: k1.roles, memberId: k1.memberId })
    expect((await getTree(jsonReq('http://x', 'GET') as any, { params: { id: k2.familyId! } })).status).toBe(403)
    expect((await getFamilyMembers(jsonReq('http://x', 'GET') as any, { params: { id: k2.familyId! } })).status).toBe(403)
  })

  it('TC-KARTA2-003 KARTA-01 cannot read Family-02\'s join-request queue', async () => {
    const k1 = await account('KARTA-01')
    const k2 = await account('KARTA-02')
    actAs({ userId: k1.userId, roles: k1.roles, memberId: k1.memberId })
    const res = await getJoinRequests(jsonReq('http://x', 'GET') as any, { params: { id: k2.familyId! } })
    expect(res.status).toBe(403)
  })

  it('TC-KARTA2-004 a plain member of a family cannot manage it', async () => {
    const member01 = await account('MEMBER-01') // member of Family-01, not Karta
    actAs({ userId: member01.userId, roles: member01.roles, memberId: member01.memberId })
    const res = await patchFamily(jsonReq('http://x', 'PATCH', { name: 'Nope' }) as any, { params: { id: member01.familyId! } })
    expect(res.status).toBe(403)
    // ...but they CAN view it, being a member.
    const view = await getFamilyMembers(jsonReq('http://x', 'GET') as any, { params: { id: member01.familyId! } })
    expect(view.status).toBe(200)
  })
})

describe('TC-PERM — admin surface', () => {
  it('TC-PERM-002 no non-admin role can reach the admin user API', async () => {
    for (const label of ['MEMBER-01', 'KARTA-01', 'OWNER-01', 'OPERATOR-01']) {
      const acc = await account(label)
      const target = await account('MEMBER-02')
      actAs({ userId: acc.userId, roles: acc.roles, memberId: acc.memberId })
      const res = await getAdminUser(jsonReq('http://x', 'GET') as any, { params: { id: target.userId } })
      expect(res.status, `${label} should be denied admin access`).toBe(403)
    }
  })

  it('TC-PERM-002b no non-admin role can create relationship types', async () => {
    for (const label of ['MEMBER-01', 'KARTA-01', 'OWNER-01', 'OPERATOR-01']) {
      const acc = await account(label)
      actAs({ userId: acc.userId, roles: acc.roles, memberId: acc.memberId })
      const res = await postRelationshipType(jsonReq('http://x', 'POST', { code: 'x', label: 'X' }) as any)
      expect(res.status, `${label} should not configure relationship types`).toBe(403)
    }
  })

  it('TC-PERM-006 ADMIN-01 has full access across families and members', async () => {
    const admin = await account('ADMIN-01')
    const k2 = await account('KARTA-02')
    const target = await bareMember('F2-DAUGHTER')
    actAs({ userId: admin.userId, roles: admin.roles, memberId: admin.memberId })

    expect((await getTree(jsonReq('http://x', 'GET') as any, { params: { id: k2.familyId! } })).status).toBe(200)
    expect((await patchMember(
      jsonReq('http://x', 'PATCH', { firstName: 'Priya', gender: 'FEMALE', biography: 'admin edit' }) as any,
      { params: { id: target.id } }
    )).status).toBe(200)
  })

  it('TC-OP-ISOLATION operators can review approvals; asset owners cannot', async () => {
    const op = await account('OPERATOR-01')
    const owner = await account('OWNER-01')
    const solo = await account('INDEPENDENT-01') // real, unverified family
    const approval = await prisma.approval.create({
      data: {
        actionCode: 'family.create', entityType: 'family', entityId: solo.familyId!,
        status: 'SUBMITTED', submittedBy: solo.userId,
      },
    })

    actAs({ userId: owner.userId, roles: owner.roles, memberId: owner.memberId })
    expect((await patchApproval(jsonReq('http://x', 'PATCH', { action: 'approve' }) as any, { params: { id: approval.id } })).status).toBe(403)

    actAs({ userId: op.userId, roles: op.roles, memberId: op.memberId })
    expect((await patchApproval(jsonReq('http://x', 'PATCH', { action: 'approve' }) as any, { params: { id: approval.id } })).status).toBe(200)

    // TC-OP-002: approving actually verifies the family, not just the row.
    const fam = await prisma.family.findUniqueOrThrow({ where: { id: solo.familyId! } })
    expect(fam.verificationStatus).toBe('VERIFIED')
    expect(fam.status).toBe('ACTIVE')
    expect(fam.verifiedBy).toBe(op.userId)

    await prisma.family.update({
      where: { id: solo.familyId! },
      data: { verificationStatus: 'UNVERIFIED', status: 'PENDING', verifiedBy: null, verifiedAt: null },
    })
    await prisma.auditLog.deleteMany({ where: { entityId: approval.id } })
    await prisma.approval.delete({ where: { id: approval.id } })
  })

  it('TC-OP-010 approving a request whose target is gone fails cleanly, not with a 500', async () => {
    const op = await account('OPERATOR-01')
    const approval = await prisma.approval.create({
      data: {
        actionCode: 'family.create', entityType: 'family', entityId: 'deleted-family-id',
        status: 'SUBMITTED', submittedBy: op.userId,
      },
    })
    actAs({ userId: op.userId, roles: op.roles, memberId: op.memberId })
    const res = await patchApproval(jsonReq('http://x', 'PATCH', { action: 'approve' }) as any, { params: { id: approval.id } })
    expect(res.status).toBe(409)
    expect((await res.json()).message).toMatch(/no longer exists/i)

    // ...and the request is left untouched rather than looking applied.
    expect((await prisma.approval.findUniqueOrThrow({ where: { id: approval.id } })).status).toBe('SUBMITTED')
    await prisma.approval.delete({ where: { id: approval.id } })
  })
})

describe('TC-LOGIN-007/008 — unauthenticated access', () => {
  it('every protected endpoint refuses an anonymous caller', async () => {
    const k1 = await account('KARTA-01')
    anonymous()
    expect((await getMember(jsonReq('http://x', 'GET') as any, { params: { id: k1.memberId } })).status).toBe(401)
    expect((await getTree(jsonReq('http://x', 'GET') as any, { params: { id: k1.familyId! } })).status).toBe(401)
    expect((await getFamilyMembers(jsonReq('http://x', 'GET') as any, { params: { id: k1.familyId! } })).status).toBe(401)
    expect((await patchMember(edit() as any, { params: { id: k1.memberId } })).status).toBe(401)
    expect((await patchFamily(jsonReq('http://x', 'PATCH', { name: 'x' }) as any, { params: { id: k1.familyId! } })).status).toBe(401)
  })
})
