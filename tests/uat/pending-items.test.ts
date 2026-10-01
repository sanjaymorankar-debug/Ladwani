import { describe, it, expect, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { PATCH as patchMember } from '@/app/api/members/[id]/route'
import { PUT as putAddress } from '@/app/api/members/[id]/addresses/route'
import { POST as postDeceased } from '@/app/api/members/[id]/deceased/route'
import { POST as postKarta } from '@/app/api/families/[id]/karta/route'
import { POST as postBusiness } from '@/app/api/members/[id]/business/route'
import { PATCH as patchApproval } from '@/app/api/approvals/[id]/route'
import { PUT as putPhysical } from '@/app/api/settings/physical-fields/route'
import { account, bareMember, actAs, jsonReq } from './helpers'
import { validatePhysical, validatePincode } from '@/lib/validators'

describe('validators (section 30)', () => {
  it('accepts blank and sane physical values, rejects absurd ones', () => {
    expect(validatePhysical({})).toBeNull()
    expect(validatePhysical({ heightCm: '172', weightKg: '68' })).toBeNull()
    expect(validatePhysical({ heightCm: 900 })).toMatch(/Height/)
    expect(validatePhysical({ weightKg: 0 })).toMatch(/Weight/)
    expect(validatePhysical({ heightCm: 'tall' })).toMatch(/Height/)
  })

  it('validates Indian PIN codes only for India', () => {
    expect(validatePincode('411001', 'India')).toBeNull()
    expect(validatePincode('', 'India')).toBeNull()
    expect(validatePincode('01234', 'India')).not.toBeNull()
    expect(validatePincode('0123456', 'India')).not.toBeNull()
    expect(validatePincode('SW1A 1AA', 'United Kingdom')).toBeNull()
  })
})

describe('TC-PEND - pending spec items', () => {
  it('TC-PEND-001 profile API rejects out-of-range height and a bad PIN', async () => {
    const karta = await account('KARTA-01')
    const son = await bareMember('F1-SON')
    actAs({ userId: karta.userId, roles: ['KARTA'], memberId: karta.memberId })

    const h = await patchMember(jsonReq('http://x', 'PATCH', { heightCm: 900 }) as any, { params: { id: son.id } })
    expect(h.status).toBe(400)

    const p = await putAddress(
      jsonReq('http://x', 'PUT', { addressType: 'CURRENT', pincode: '12' }) as any,
      { params: { id: son.id } }
    )
    expect(p.status).toBe(400)
  })

  it('TC-PEND-002 business records can be added with a valid year and refuse a future one', async () => {
    const karta = await account('KARTA-01')
    const son = await bareMember('F1-SON')
    actAs({ userId: karta.userId, roles: ['KARTA'], memberId: karta.memberId })

    const bad = await postBusiness(
      jsonReq('http://x', 'POST', { businessName: 'X', establishedYear: 3000 }) as any,
      { params: { id: son.id } }
    )
    expect(bad.status).toBe(400)

    const ok = await postBusiness(
      jsonReq('http://x', 'POST', { businessName: 'Sharma Traders', establishedYear: 2005 }) as any,
      { params: { id: son.id } }
    )
    expect(ok.status).toBe(201)
    await prisma.business.deleteMany({ where: { memberId: son.id, businessName: 'Sharma Traders' } })
  })

  it('TC-PEND-003 marking deceased is queued, nothing changes until an operator approves', async () => {
    const karta = await account('KARTA-01')
    const operator = await account('OPERATOR-01')
    const brother = await bareMember('F1-BROTHER')
    await prisma.approval.deleteMany({ where: { actionCode: 'member.mark_deceased', entityId: brother.id } })

    actAs({ userId: karta.userId, roles: ['KARTA'], memberId: karta.memberId })
    const res = await postDeceased(
      jsonReq('http://x', 'POST', { deceasedAt: '2024-01-15' }) as any,
      { params: { id: brother.id } }
    )
    expect(res.status).toBe(202)
    expect((await prisma.member.findUniqueOrThrow({ where: { id: brother.id } })).status).toBe('ACTIVE')

    const approval = await prisma.approval.findFirstOrThrow({
      where: { actionCode: 'member.mark_deceased', entityId: brother.id, status: 'SUBMITTED' },
    })
    actAs({ userId: operator.userId, roles: ['OPERATOR'], memberId: operator.memberId })
    const approve = await patchApproval(
      jsonReq('http://x', 'PATCH', { action: 'approve' }) as any,
      { params: { id: approval.id } }
    )
    expect(approve.status).toBe(200)
    expect((await prisma.member.findUniqueOrThrow({ where: { id: brother.id } })).status).toBe('DECEASED')

    // Restore the fixture so the suite stays re-runnable.
    await prisma.member.update({ where: { id: brother.id }, data: { status: 'ACTIVE', deceasedAt: null } })
  })

  it('TC-PEND-004 nobody can mark their own profile deceased', async () => {
    const karta = await account('KARTA-01')
    actAs({ userId: karta.userId, roles: ['KARTA'], memberId: karta.memberId })
    const res = await postDeceased(
      jsonReq('http://x', 'POST', { deceasedAt: '2024-01-15' }) as any,
      { params: { id: karta.memberId } }
    )
    expect(res.status).toBe(400)
  })

  it('TC-PEND-005 only an Admin may review a change of Karta; non-Karta cannot request one', async () => {
    const karta = await account('KARTA-01')
    const other = await account('KARTA-02')
    const operator = await account('OPERATOR-01')
    const fam = await prisma.family.findUniqueOrThrow({ where: { registrationNumber: 'UAT-FAM-01' } })

    // A Karta of a different family cannot touch this one.
    actAs({ userId: other.userId, roles: ['KARTA'], memberId: other.memberId })
    const denied = await postKarta(
      jsonReq('http://x', 'POST', { newKartaMemberId: other.memberId }) as any,
      { params: { id: fam.id } }
    )
    expect(denied.status).toBe(403)

    // A queued request cannot be approved by an Operator.
    const approval = await prisma.approval.create({
      data: {
        actionCode: 'family.karta.change', entityType: 'family', entityId: fam.id,
        newValue: { familyId: fam.id, newKartaMemberId: karta.memberId }, status: 'SUBMITTED', submittedBy: karta.userId,
      },
    })
    actAs({ userId: operator.userId, roles: ['OPERATOR'], memberId: operator.memberId })
    const res = await patchApproval(
      jsonReq('http://x', 'PATCH', { action: 'approve' }) as any,
      { params: { id: approval.id } }
    )
    expect(res.status).toBe(403)
    await prisma.approval.delete({ where: { id: approval.id } })
  })

  it('TC-PEND-006 a disabled physical field is refused by the profile API; only Admin can toggle', async () => {
    const admin = await account('ADMIN-01')
    const karta = await account('KARTA-01')
    const son = await bareMember('F1-SON')

    actAs({ userId: karta.userId, roles: ['KARTA'], memberId: karta.memberId })
    const forbidden = await putPhysical(jsonReq('http://x', 'PUT', { weightKg: false }) as any)
    expect(forbidden.status).toBe(403)

    actAs({ userId: admin.userId, roles: ['ADMIN'], memberId: admin.memberId })
    expect((await putPhysical(jsonReq('http://x', 'PUT', { weightKg: false }) as any)).status).toBe(200)

    actAs({ userId: karta.userId, roles: ['KARTA'], memberId: karta.memberId })
    const refused = await patchMember(jsonReq('http://x', 'PATCH', { weightKg: 70 }) as any, { params: { id: son.id } })
    expect(refused.status).toBe(400)

    actAs({ userId: admin.userId, roles: ['ADMIN'], memberId: admin.memberId })
    await putPhysical(jsonReq('http://x', 'PUT', { weightKg: true }) as any)
  })
})
