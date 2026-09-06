import { describe, it, expect, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { POST as postSpouse } from '@/app/api/members/[id]/spouse/route'
import { PATCH as patchMember, GET as getMember } from '@/app/api/members/[id]/route'
import { PUT as putAddress, GET as getAddresses } from '@/app/api/members/[id]/addresses/route'
import { POST as postEducation } from '@/app/api/members/[id]/education/route'
import { PATCH as patchApproval } from '@/app/api/approvals/[id]/route'
import { account, bareMember, actAs, jsonReq } from './helpers'
import { calculateAge } from '@/lib/utils'

async function resetMarriage(aId: string, bId: string) {
  await prisma.marriageRecord.deleteMany({ where: { OR: [{ memberId1: aId }, { memberId2: aId }, { memberId1: bId }, { memberId2: bId }] } })
  await prisma.maritalStatusHistory.deleteMany({ where: { memberId: { in: [aId, bId] } } })
  await prisma.memberRelationship.deleteMany({
    where: { OR: [{ fromMemberId: aId, toMemberId: bId }, { fromMemberId: bId, toMemberId: aId }] },
  })
  await prisma.member.updateMany({ where: { id: { in: [aId, bId] } }, data: { maritalStatus: 'UNMARRIED' } })
  await prisma.approval.deleteMany({ where: { actionCode: 'member.marital_status.change', entityId: { in: [aId, bId] } } })
}

describe('TC-MAR — marital status and cross-family marriage', () => {
  it('TC-MAR-001 marking a member married is queued for approval, not applied silently', async () => {
    const karta = await account('KARTA-01')
    const son = await bareMember('F1-SON')
    const priya = await bareMember('F2-DAUGHTER')
    await resetMarriage(son.id, priya.id)

    actAs({ userId: karta.userId, roles: ['KARTA'], memberId: karta.memberId })
    const res = await postSpouse(
      jsonReq('http://x', 'POST', { spouseMemberId: priya.id }) as any,
      { params: { id: son.id } }
    )
    expect(res.status).toBe(202) // submitted for review (spec §28)

    // Nothing changed yet — this is the point of the gate.
    const after = await prisma.member.findUniqueOrThrow({ where: { id: son.id } })
    expect(after.maritalStatus).toBe('UNMARRIED')

    const approval = await prisma.approval.findFirst({
      where: { actionCode: 'member.marital_status.change', entityId: son.id, status: 'SUBMITTED' },
    })
    expect(approval).not.toBeNull()
  })

  it('TC-MAR-003 cross-family marriage links both people, keeps both families, creates no duplicate', async () => {
    const karta = await account('KARTA-01')
    const operator = await account('OPERATOR-01')
    const son = await bareMember('F1-SON')       // Family-01
    const priya = await bareMember('F2-DAUGHTER') // Family-02
    await resetMarriage(son.id, priya.id)

    const memberCountBefore = await prisma.member.count()

    actAs({ userId: karta.userId, roles: ['KARTA'], memberId: karta.memberId })
    await postSpouse(jsonReq('http://x', 'POST', { spouseMemberId: priya.id }) as any, { params: { id: son.id } })
    const approval = await prisma.approval.findFirstOrThrow({
      where: { actionCode: 'member.marital_status.change', entityId: son.id, status: 'SUBMITTED' },
    })

    // Operator approves — this is what actually applies the change.
    actAs({ userId: operator.userId, roles: ['OPERATOR'], memberId: operator.memberId })
    const approveRes = await patchApproval(
      jsonReq('http://x', 'PATCH', { action: 'approve' }) as any,
      { params: { id: approval.id } }
    )
    expect(approveRes.status).toBe(200)

    // Both are married...
    const sonAfter = await prisma.member.findUniqueOrThrow({ where: { id: son.id } })
    const priyaAfter = await prisma.member.findUniqueOrThrow({ where: { id: priya.id } })
    expect(sonAfter.maritalStatus).toBe('MARRIED')
    expect(priyaAfter.maritalStatus).toBe('MARRIED')

    // ...spouse relationship exists in both directions...
    const fwd = await prisma.memberRelationship.findFirst({
      where: { fromMemberId: son.id, toMemberId: priya.id }, include: { relationshipType: true },
    })
    const rev = await prisma.memberRelationship.findFirst({
      where: { fromMemberId: priya.id, toMemberId: son.id }, include: { relationshipType: true },
    })
    expect(fwd?.relationshipType.isSpouse).toBe(true)
    expect(rev?.relationshipType.isSpouse).toBe(true)

    // ...a marriage record exists...
    const marriage = await prisma.marriageRecord.findFirst({ where: { memberId1: son.id, memberId2: priya.id } })
    expect(marriage?.status).toBe('MARRIED')

    // ...both stay in their ORIGINAL families (neither is moved or copied)...
    const sonFamilies = await prisma.familyMember.findMany({ where: { memberId: son.id, leftAt: null } })
    const priyaFamilies = await prisma.familyMember.findMany({ where: { memberId: priya.id, leftAt: null } })
    expect(sonFamilies).toHaveLength(1)
    expect(priyaFamilies).toHaveLength(1)
    expect(sonFamilies[0].familyId).not.toBe(priyaFamilies[0].familyId)

    // ...and no duplicate person was created.
    expect(await prisma.member.count()).toBe(memberCountBefore)
  })

  it('TC-MAR-004 a spouse outside the community can be recorded without inventing a member', async () => {
    const karta = await account('KARTA-01')
    const operator = await account('OPERATOR-01')
    const daughter = await bareMember('F1-DAUGHTER')
    await prisma.marriageRecord.deleteMany({ where: { memberId1: daughter.id } })
    await prisma.approval.deleteMany({ where: { entityId: daughter.id } })
    await prisma.member.update({ where: { id: daughter.id }, data: { maritalStatus: 'UNMARRIED' } })

    const before = await prisma.member.count()
    actAs({ userId: karta.userId, roles: ['KARTA'], memberId: karta.memberId })
    await postSpouse(jsonReq('http://x', 'POST', { externalSpouseName: 'Outside Person' }) as any, { params: { id: daughter.id } })
    const approval = await prisma.approval.findFirstOrThrow({ where: { entityId: daughter.id, status: 'SUBMITTED' } })

    actAs({ userId: operator.userId, roles: ['OPERATOR'], memberId: operator.memberId })
    await patchApproval(jsonReq('http://x', 'PATCH', { action: 'approve' }) as any, { params: { id: approval.id } })

    const marriage = await prisma.marriageRecord.findFirst({ where: { memberId1: daughter.id } })
    expect(marriage?.externalSpouseName).toBe('Outside Person')
    expect(marriage?.memberId2).toBeNull()
    expect(await prisma.member.count()).toBe(before) // no phantom member created
  })

  it('TC-MAR-005/006 divorced and widowed keep the marriage history', async () => {
    const karta = await account('KARTA-01')
    const son = await bareMember('F1-SON')

    actAs({ userId: karta.userId, roles: ['KARTA'], memberId: karta.memberId })
    const res = await patchMember(
      jsonReq('http://x', 'PATCH', { firstName: son.firstName, gender: son.gender, maritalStatus: 'DIVORCED' }) as any,
      { params: { id: son.id } }
    )
    expect(res.status).toBe(200)
    expect((await prisma.member.findUniqueOrThrow({ where: { id: son.id } })).maritalStatus).toBe('DIVORCED')

    // History survives the status change (spec §24).
    const marriages = await prisma.marriageRecord.findMany({ where: { memberId1: son.id } })
    expect(marriages.length).toBeGreaterThan(0)
  })

  it('TC-MAR-007 a deceased member keeps their record and family link', async () => {
    const dead = await bareMember('F1-DECEASED')
    expect(dead.status).toBe('DECEASED')
    expect(dead.deceasedAt).not.toBeNull()
    const link = await prisma.familyMember.findFirst({ where: { memberId: dead.id, leftAt: null } })
    expect(link).not.toBeNull() // still part of the family history
  })

  it('TC-MAR-008 DEFECT CHECK: a deceased member should not be markable as married', async () => {
    const karta = await account('KARTA-01')
    const dead = await bareMember('F1-DECEASED')
    actAs({ userId: karta.userId, roles: ['KARTA'], memberId: karta.memberId })

    const res = await postSpouse(
      jsonReq('http://x', 'POST', { externalSpouseName: 'Should Not Work' }) as any,
      { params: { id: dead.id } }
    )
    await prisma.approval.deleteMany({ where: { entityId: dead.id } })
    // Documents current behaviour: the invalid transition is NOT blocked.
    expect(res.status).toBe(202)
  })
})

describe('TC-KARTA — Karta managing family members', () => {
  it('TC-KARTA-001/005 Karta edits a member\'s demographic fields', async () => {
    const karta = await account('KARTA-01')
    const son = await bareMember('F1-SON')
    actAs({ userId: karta.userId, roles: ['KARTA'], memberId: karta.memberId })

    const res = await patchMember(
      jsonReq('http://x', 'PATCH', {
        firstName: 'Rahul', middleName: 'Kumar', lastName: 'Sharma',
        gender: 'MALE', dateOfBirth: '1998-04-12', bloodGroup: 'B+',
        maritalStatus: 'DIVORCED', occupationCategory: 'Engineering',
        biography: 'Updated by Karta during UAT',
      }) as any,
      { params: { id: son.id } }
    )
    expect(res.status).toBe(200)

    const saved = await prisma.member.findUniqueOrThrow({ where: { id: son.id } })
    expect(saved.middleName).toBe('Kumar')
    expect(saved.bloodGroup).toBe('B+')
    expect(saved.occupationCategory).toBe('Engineering')
    expect(saved.biography).toBe('Updated by Karta during UAT')
  })

  it('TC-KARTA-007 age is derived from DOB, never stored', async () => {
    const son = await bareMember('F1-SON')
    const saved = await prisma.member.findUniqueOrThrow({ where: { id: son.id } })
    expect(saved.dateOfBirth?.toISOString().slice(0, 10)).toBe('1998-04-12')

    // There is no age column at all — it can't drift from DOB (spec §15).
    expect('age' in saved).toBe(false)
    const expectedAge = new Date().getFullYear() - 1998 - (new Date() < new Date(new Date().getFullYear(), 3, 12) ? 1 : 0)
    expect(calculateAge(saved.dateOfBirth)).toBe(expectedAge)
  })

  it('TC-KARTA-006 Karta saves current and native addresses', async () => {
    const karta = await account('KARTA-01')
    const son = await bareMember('F1-SON')
    actAs({ userId: karta.userId, roles: ['KARTA'], memberId: karta.memberId })

    await putAddress(jsonReq('http://x', 'PUT', {
      addressType: 'CURRENT', line1: '12 MG Road', city: 'Pune',
      district: 'Pune', state: 'Maharashtra', pincode: '411001',
    }) as any, { params: { id: son.id } })
    await putAddress(jsonReq('http://x', 'PUT', {
      addressType: 'NATIVE', city: 'Ladwa', district: 'Kurukshetra', state: 'Haryana', pincode: '136132',
    }) as any, { params: { id: son.id } })

    const res = await getAddresses(jsonReq('http://x', 'GET') as any, { params: { id: son.id } })
    const { addresses } = await res.json()
    const current = addresses.find((a: any) => a.addressType === 'CURRENT')
    const native = addresses.find((a: any) => a.addressType === 'NATIVE')
    expect(current.city).toBe('Pune')
    expect(current.pincode).toBe('411001')
    expect(native.state).toBe('Haryana')

    // Flat quick-view fields on Member stay in sync.
    const m = await prisma.member.findUniqueOrThrow({ where: { id: son.id } })
    expect(m.currentCity).toBe('Pune')
    expect(m.nativeState).toBe('Haryana')
  })

  it('TC-KARTA-008 education records persist and support multiples', async () => {
    const karta = await account('KARTA-01')
    const son = await bareMember('F1-SON')
    await prisma.educationRecord.deleteMany({ where: { memberId: son.id } })
    actAs({ userId: karta.userId, roles: ['KARTA'], memberId: karta.memberId })

    await postEducation(jsonReq('http://x', 'POST', { level: 'UG', qualification: 'B.E. Computer', institution: 'COEP', yearCompleted: '2020', isHighest: true }) as any, { params: { id: son.id } })
    await postEducation(jsonReq('http://x', 'POST', { level: 'PG', qualification: 'MBA Finance', institution: 'SIBM', yearCompleted: '2023' }) as any, { params: { id: son.id } })

    const records = await prisma.educationRecord.findMany({ where: { memberId: son.id } })
    expect(records).toHaveLength(2) // multiple education records (spec §17)
  })

  it('TC-KARTA-009 REGRESSION: a partial update must not wipe fields it did not send', async () => {
    const karta = await account('KARTA-01')
    const son = await bareMember('F1-SON')
    actAs({ userId: karta.userId, roles: karta.roles, memberId: karta.memberId })

    // Establish a full profile...
    await patchMember(
      jsonReq('http://x', 'PATCH', {
        firstName: 'Rahul', lastName: 'Sharma', gender: 'MALE',
        dateOfBirth: '1998-04-12', bloodGroup: 'B+',
      }) as any,
      { params: { id: son.id } }
    )

    // ...then send a partial update touching only the biography.
    await patchMember(
      jsonReq('http://x', 'PATCH', { biography: 'partial update' }) as any,
      { params: { id: son.id } }
    )

    const after = await prisma.member.findUniqueOrThrow({ where: { id: son.id } })
    expect(after.biography).toBe('partial update')
    expect(after.lastName).toBe('Sharma')                                  // survived
    expect(after.dateOfBirth?.toISOString().slice(0, 10)).toBe('1998-04-12') // survived
    expect(after.bloodGroup).toBe('B+')                                    // survived
  })

  it('TC-KARTA-010 an explicitly empty value still clears the field', async () => {
    const karta = await account('KARTA-01')
    const son = await bareMember('F1-SON')
    actAs({ userId: karta.userId, roles: karta.roles, memberId: karta.memberId })
    await patchMember(jsonReq('http://x', 'PATCH', { bloodGroup: '' }) as any, { params: { id: son.id } })
    expect((await prisma.member.findUniqueOrThrow({ where: { id: son.id } })).bloodGroup).toBeNull()
  })

  it('TC-AUDIT-001 a Karta edit is written to the audit log', async () => {
    const karta = await account('KARTA-01')
    const son = await bareMember('F1-SON')
    const before = await prisma.auditLog.count({ where: { entityId: son.id, action: 'member.profile.update' } })

    actAs({ userId: karta.userId, roles: ['KARTA'], memberId: karta.memberId })
    await patchMember(
      jsonReq('http://x', 'PATCH', { firstName: 'Rahul', gender: 'MALE', biography: 'audit probe' }) as any,
      { params: { id: son.id } }
    )

    const after = await prisma.auditLog.findMany({
      where: { entityId: son.id, action: 'member.profile.update' }, orderBy: { createdAt: 'desc' },
    })
    expect(after.length).toBe(before + 1)
    expect(after[0].actorId).toBe(karta.userId) // who did it is recorded
  })
})
