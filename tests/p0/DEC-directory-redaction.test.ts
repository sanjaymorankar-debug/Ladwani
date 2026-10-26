import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { actAs, jsonReq } from '../uat/helpers'
import { p0Fixtures } from './fixtures'
import { GET as listMembers } from '@/app/api/members/route'
import { GET as search } from '@/app/api/search/route'

/** Security finding 2: list and search endpoints honour each member's privacy settings. */
const fx = p0Fixtures('p0red')
type P = Awaited<ReturnType<typeof fx.person>>
let owner: P, relative: P, stranger: P, admin: P
let familyId: string

const find = (body: any) => body.members.find((m: any) => m.id === owner.memberId)
async function asViewer(p: P, route: typeof listMembers | typeof search) {
  actAs({ userId: p.userId, roles: p.roles, memberId: p.memberId })
  return (await route(jsonReq('http://x/api/members?q=p0red', 'GET') as any)).json()
}

beforeAll(async () => {
  owner = await fx.person('owner')
  relative = await fx.person('relative')
  stranger = await fx.person('stranger')
  admin = await fx.person('admin', { roles: [{ code: 'ADMIN' }] })
  const fam = await prisma.family.create({ data: { registrationNumber: 'P0RED-FAM', name: 'P0Red' } })
  familyId = fam.id
  await prisma.familyMember.createMany({ data: [{ familyId, memberId: owner.memberId }, { familyId, memberId: relative.memberId }] })
  await prisma.memberFieldVisibility.create({ data: { memberId: owner.memberId, fieldName: 'current_city', visibility: 'PRIVATE' } })
  await prisma.member.update({ where: { id: owner.memberId }, data: { currentCity: 'Pune' } })
})
afterAll(async () => {
  await prisma.memberFieldVisibility.deleteMany({ where: { memberId: owner.memberId } })
  await prisma.familyMember.deleteMany({ where: { familyId } })
  await prisma.family.delete({ where: { id: familyId } })
  await fx.cleanup()
})

describe('Directory and search redaction', () => {
  for (const [name, route] of [['GET /api/members', listMembers], ['GET /api/search', search]] as const) {
    it(`${name}: a stranger gets no contact details, DOB or private fields`, async () => {
      const row = find(await asViewer(stranger, route))
      expect(row.mobilePrimary).toBeNull()
      expect(row.email).toBeNull()
      expect(row.dateOfBirth).toBeNull()      // SAME_FAMILY by default
      expect(row.currentCity).toBeNull()      // owner set it PRIVATE
      expect(row.firstName).toBe('owner')
    })

    it(`${name}: a family member sees DOB but not contact details`, async () => {
      const row = find(await asViewer(relative, route))
      expect(row.dateOfBirth).not.toBeNull()
      expect(row.mobilePrimary).toBeNull()
    })

    it(`${name}: the member themself and an Admin see everything`, async () => {
      expect(find(await asViewer(owner, route)).mobilePrimary).toBe('9876500000')
      expect(find(await asViewer(admin, route)).currentCity).toBe('Pune')
    })
  }
})
