import { describe, it, expect, beforeAll, vi } from 'vitest'

// Route handlers call getServerSession(authOptions) directly; mocking the
// module lets each test simulate a specific logged-in user without going
// through real HTTP/cookies.
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { mockSessionAs } from './helpers/session'

import { POST as postFamilyMembers, GET as getFamilyMembers } from '@/app/api/families/[id]/members/route'
import { GET as getFamilyTree } from '@/app/api/families/[id]/tree/route'
import { PATCH as patchMember, GET as getMember } from '@/app/api/members/[id]/route'
import { POST as postRelationshipType } from '@/app/api/relationship-types/route'
import { GET as getAdminUser } from '@/app/api/admin/users/[id]/route'

interface Fixtures {
  memberUser: { id: string; memberId: string }
  kartaUser: { id: string; memberId: string; familyId: string }
  otherKartaUser: { id: string; memberId: string; familyId: string }
  operatorUser: { id: string }
  adminUser: { id: string }
}

let fx: Fixtures

beforeAll(async () => {
  const [memberUser, kartaUser, otherKartaUser, operatorUser, adminUser] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: 'test.member@example.test' }, include: { member: true } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'test.karta@example.test' }, include: { member: { include: { families: true } } } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'test.other-karta@example.test' }, include: { member: { include: { families: true } } } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'test.operator@example.test' } }),
    prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL ?? 'admin@miladwani.com' } }),
  ])

  fx = {
    memberUser: { id: memberUser.id, memberId: memberUser.member!.id },
    kartaUser: { id: kartaUser.id, memberId: kartaUser.member!.id, familyId: kartaUser.member!.families[0].familyId },
    otherKartaUser: { id: otherKartaUser.id, memberId: otherKartaUser.member!.id, familyId: otherKartaUser.member!.families[0].familyId },
    operatorUser: { id: operatorUser.id },
    adminUser: { id: adminUser.id },
  }
})

function req(url: string, init?: RequestInit) {
  return new Request(url, init)
}

describe('Member: self vs. others', () => {
  it('can edit their own profile', async () => {
    mockSessionAs({ id: fx.memberUser.id, roles: ['MEMBER'], memberId: fx.memberUser.memberId, status: 'ACTIVE' })
    const res = await patchMember(
      req('http://x/api/members/self', { method: 'PATCH', body: JSON.stringify({ firstName: 'Test', biography: 'hi' }) }),
      { params: { id: fx.memberUser.memberId } }
    )
    expect(res.status).toBe(200)
  })

  it('cannot edit another member\'s profile', async () => {
    mockSessionAs({ id: fx.memberUser.id, roles: ['MEMBER'], memberId: fx.memberUser.memberId, status: 'ACTIVE' })
    const res = await patchMember(
      req('http://x/api/members/other', { method: 'PATCH', body: JSON.stringify({ firstName: 'Hacked' }) }),
      { params: { id: fx.kartaUser.memberId } }
    )
    expect(res.status).toBe(403)
  })

  it('cannot add a member to a family they do not head (member of, but not Karta of)', async () => {
    // test.member is a plain member OF fx.kartaUser's family (seeded that
    // way deliberately) - proves membership alone isn't enough to manage it.
    mockSessionAs({ id: fx.memberUser.id, roles: ['MEMBER'], memberId: fx.memberUser.memberId, status: 'ACTIVE' })
    const res = await postFamilyMembers(
      req('http://x/api/families/x/members', {
        method: 'POST',
        body: JSON.stringify({ firstName: 'Intruder', gender: 'MALE' }),
      }),
      { params: { id: fx.kartaUser.familyId } }
    )
    expect(res.status).toBe(403)
  })

  it('cannot view a family they do not belong to at all', async () => {
    mockSessionAs({ id: fx.memberUser.id, roles: ['MEMBER'], memberId: fx.memberUser.memberId, status: 'ACTIVE' })
    const res = await getFamilyMembers(req('http://x/api/families/x/members'), { params: { id: fx.otherKartaUser.familyId } })
    expect(res.status).toBe(403)
  })

  it('CAN view a family they are a plain member of', async () => {
    mockSessionAs({ id: fx.memberUser.id, roles: ['MEMBER'], memberId: fx.memberUser.memberId, status: 'ACTIVE' })
    const res = await getFamilyMembers(req('http://x/api/families/x/members'), { params: { id: fx.kartaUser.familyId } })
    expect(res.status).toBe(200)
  })

  it('cannot access admin APIs', async () => {
    mockSessionAs({ id: fx.memberUser.id, roles: ['MEMBER'], memberId: fx.memberUser.memberId, status: 'ACTIVE' })
    const res = await getAdminUser(req('http://x/api/admin/users/x'), { params: { id: fx.kartaUser.id } })
    expect(res.status).toBe(403)
  })
})

describe('Karta: own family vs. other families', () => {
  it('can add a member to their own family', async () => {
    mockSessionAs({ id: fx.kartaUser.id, roles: ['KARTA'], memberId: fx.kartaUser.memberId, status: 'ACTIVE' })
    const res = await postFamilyMembers(
      req('http://x/api/families/x/members', {
        method: 'POST',
        body: JSON.stringify({ firstName: 'Child', gender: 'FEMALE', forceCreate: true }),
      }),
      { params: { id: fx.kartaUser.familyId } }
    )
    expect(res.status).toBe(201)
  })

  it('can view their own family\'s tree', async () => {
    mockSessionAs({ id: fx.kartaUser.id, roles: ['KARTA'], memberId: fx.kartaUser.memberId, status: 'ACTIVE' })
    const res = await getFamilyTree(req('http://x/api/families/x/tree'), { params: { id: fx.kartaUser.familyId } })
    expect(res.status).toBe(200)
  })

  it('cannot add a member to a different family', async () => {
    mockSessionAs({ id: fx.kartaUser.id, roles: ['KARTA'], memberId: fx.kartaUser.memberId, status: 'ACTIVE' })
    const res = await postFamilyMembers(
      req('http://x/api/families/x/members', {
        method: 'POST',
        body: JSON.stringify({ firstName: 'Intruder', gender: 'MALE' }),
      }),
      { params: { id: fx.otherKartaUser.familyId } }
    )
    expect(res.status).toBe(403)
  })

  it('cannot view a different family\'s tree', async () => {
    mockSessionAs({ id: fx.kartaUser.id, roles: ['KARTA'], memberId: fx.kartaUser.memberId, status: 'ACTIVE' })
    const res = await getFamilyTree(req('http://x/api/families/x/tree'), { params: { id: fx.otherKartaUser.familyId } })
    expect(res.status).toBe(403)
  })

  it('cannot access admin functionality', async () => {
    mockSessionAs({ id: fx.kartaUser.id, roles: ['KARTA'], memberId: fx.kartaUser.memberId, status: 'ACTIVE' })
    const res = await postRelationshipType(
      req('http://x/api/relationship-types', { method: 'POST', body: JSON.stringify({ code: 'x', label: 'X' }) })
    )
    expect(res.status).toBe(403)
  })

  it('cannot override another adult member\'s private profile without permission', async () => {
    // Karta of the "Test" family, but memberUser belongs to no family and is unrelated.
    mockSessionAs({ id: fx.kartaUser.id, roles: ['KARTA'], memberId: fx.kartaUser.memberId, status: 'ACTIVE' })
    const res = await patchMember(
      req('http://x/api/members/x', { method: 'PATCH', body: JSON.stringify({ firstName: 'Overridden' }) }),
      { params: { id: fx.memberUser.memberId } }
    )
    expect(res.status).toBe(403)
  })
})

describe('Operator: scoped access', () => {
  it('can view any member\'s profile without redaction (staff bypass)', async () => {
    mockSessionAs({ id: fx.operatorUser.id, roles: ['OPERATOR'], memberId: null, status: 'ACTIVE' })
    const res = await getMember(req('http://x/api/members/x'), { params: { id: fx.memberUser.memberId } })
    expect(res.status).toBe(200)
  })

  it('cannot create relationship types (admin-only)', async () => {
    mockSessionAs({ id: fx.operatorUser.id, roles: ['OPERATOR'], memberId: null, status: 'ACTIVE' })
    const res = await postRelationshipType(
      req('http://x/api/relationship-types', { method: 'POST', body: JSON.stringify({ code: 'x2', label: 'X2' }) })
    )
    expect(res.status).toBe(403)
  })
})

describe('Admin: full access', () => {
  it('can create relationship types', async () => {
    mockSessionAs({ id: fx.adminUser.id, roles: ['ADMIN'], memberId: null, status: 'ACTIVE' })
    const res = await postRelationshipType(
      req('http://x/api/relationship-types', {
        method: 'POST',
        body: JSON.stringify({ code: `test-code-${Date.now()}`, label: 'Test Relation' }),
      })
    )
    expect(res.status).toBe(201)
  })

  it('can view and edit any member', async () => {
    mockSessionAs({ id: fx.adminUser.id, roles: ['ADMIN'], memberId: null, status: 'ACTIVE' })
    const res = await patchMember(
      req('http://x/api/members/x', { method: 'PATCH', body: JSON.stringify({ firstName: 'AdminEdited' }) }),
      { params: { id: fx.memberUser.memberId } }
    )
    expect(res.status).toBe(200)
  })

  it('can add a member to any family', async () => {
    mockSessionAs({ id: fx.adminUser.id, roles: ['ADMIN'], memberId: null, status: 'ACTIVE' })
    const res = await postFamilyMembers(
      req('http://x/api/families/x/members', {
        method: 'POST',
        body: JSON.stringify({ firstName: 'AdminAdded', gender: 'MALE', forceCreate: true }),
      }),
      { params: { id: fx.otherKartaUser.familyId } }
    )
    expect(res.status).toBe(201)
  })
})

describe('Unauthenticated', () => {
  it('is rejected from protected member routes', async () => {
    mockSessionAs(null)
    const res = await getMember(req('http://x/api/members/x'), { params: { id: fx.memberUser.memberId } })
    expect(res.status).toBe(401)
  })

  it('is rejected from protected family routes', async () => {
    mockSessionAs(null)
    const res = await getFamilyTree(req('http://x/api/families/x/tree'), { params: { id: fx.kartaUser.familyId } })
    expect(res.status).toBe(401)
  })
})
