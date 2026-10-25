import { describe, it, expect, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { actAs, jsonReq } from './uat/helpers'
import { approvalQueueWhere } from '@/lib/approvals'
import { PATCH as patchRelationshipType } from '@/app/api/relationship-types/[id]/route'

// Staff-only screens fed a value that is not in the database: a typed or
// stale URL must get the normal page or a 404, never an unhandled 500.
const admin = { userId: 'bad-input-admin', roles: ['ADMIN'], memberId: null }
const OPEN = { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'ESCALATED'] } }

describe('Admin screens with bad input', () => {
  it('the approval queue (/admin/approvals) ignores a ?status= that is not an approval status', async () => {
    for (const status of ['bogus', 'PENDING', 'ALL', '', undefined]) {
      const where = approvalQueueWhere(status)
      expect(where).toEqual(OPEN)
      await expect(prisma.approval.findMany({ where, take: 1 })).resolves.toBeInstanceOf(Array)
    }
    for (const status of ['UNDER_REVIEW', 'ESCALATED', 'APPROVED', 'REJECTED']) {
      const where = approvalQueueWhere(status)
      expect(where).toEqual({ status })
      await expect(prisma.approval.findMany({ where, take: 1 })).resolves.toBeInstanceOf(Array)
    }
  })

  it('PATCH /api/relationship-types/[id] answers 404 for an unknown id', async () => {
    actAs(admin)
    const res = await patchRelationshipType(jsonReq('http://x', 'PATCH', { label: 'Nope' }) as any, { params: Promise.resolve({ id: 'no-such-relationship-type' }) })
    expect(res.status).toBe(404)
  })
})
