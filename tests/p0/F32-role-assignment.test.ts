import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue({ messageId: 'test' }) }))

import { prisma } from '@/lib/prisma'
import { actAs, jsonReq } from '../uat/helpers'
import { p0Fixtures } from './fixtures'
import { GET as getAdminUser, PATCH as patchAdminUser } from '@/app/api/admin/users/[id]/route'
import { countActiveAdmins } from '@/lib/scope'

const fx = p0Fixtures('p0f32')
let admin: { userId: string; roles: string[]; memberId: string | null }
let state: string
let district: string

const patch = (targetUserId: string, body: unknown, as = admin) => {
  actAs(as)
  return patchAdminUser(jsonReq('http://x', 'PATCH', body) as any, { params: { id: targetUserId } })
}
const rolesOf = async (userId: string) =>
  (await prisma.userRole.findMany({ where: { userId }, include: { role: true } }))
    .map((r) => (r.areaId ? `${r.role.code}@${r.areaId}` : r.role.code)).sort()

beforeAll(async () => {
  const seededAdmin = await prisma.user.findUniqueOrThrow({
    where: { email: process.env.ADMIN_EMAIL ?? 'admin@miladwani.com' }, include: { member: true },
  })
  admin = { userId: seededAdmin.id, roles: ['ADMIN'], memberId: seededAdmin.member?.id ?? null }
  const country = await fx.area('in', 'P0 Country', 'COUNTRY', null)
  state = await fx.area('st', 'P0 State', 'STATE', country)
  district = await fx.area('di', 'P0 District', 'DISTRICT', state)
})
afterAll(() => fx.cleanup())

describe('F32 Role assignment — who may assign', () => {
  it('F32 a non-Admin cannot read or change roles, even with ADMIN forged into the session', async () => {
    const intruder = await fx.person('intruder')
    const target = await fx.person('target1')
    const forged = { userId: intruder.userId, roles: ['ADMIN'], memberId: intruder.memberId }
    actAs(forged)
    expect((await getAdminUser(jsonReq('http://x', 'GET') as any, { params: { id: target.userId } })).status).toBe(403)
    expect((await patch(target.userId, { toggleRole: 'ADMIN' }, forged)).status).toBe(403)
    expect(await rolesOf(target.userId)).toEqual(['MEMBER'])
  })

  it('F32 an Admin whose role is revoked loses role management on the next request', async () => {
    const temp = await fx.person('tempadmin', { roles: [{ code: 'MEMBER' }, { code: 'ADMIN' }] })
    const target = await fx.person('target2')
    const as = { userId: temp.userId, roles: ['ADMIN'], memberId: temp.memberId }
    expect((await patch(target.userId, { toggleRole: 'NATIONAL_TEAM' }, as)).status).toBe(200)
    await prisma.userRole.deleteMany({ where: { userId: temp.userId, role: { code: 'ADMIN' } } })
    expect((await patch(target.userId, { toggleRole: 'NATIONAL_TEAM' }, as)).status).toBe(403)
  })

  it('F32 a suspended Admin cannot assign roles', async () => {
    const temp = await fx.person('suspadmin', { roles: [{ code: 'ADMIN' }], status: 'SUSPENDED' })
    const target = await fx.person('target3')
    expect((await patch(target.userId, { toggleRole: 'OPERATOR' }, { userId: temp.userId, roles: ['ADMIN'], memberId: temp.memberId })).status).toBe(403)
  })
})

describe('F32 Role assignment — Operator and team mapping', () => {
  it('F32 Admin maps an Operator to a district; change is audited with old and new values and the user is alerted', async () => {
    const op = await fx.person('op1')
    const res = await patch(op.userId, { toggleRole: 'OPERATOR', areaId: district })
    expect(res.status).toBe(200)
    expect(await rolesOf(op.userId)).toEqual(['MEMBER', `OPERATOR@${district}`])

    const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: op.userId, action: 'admin.user.role_grant' } })
    expect(log.actorId).toBe(admin.userId)
    expect(log.oldValue).toEqual({ roles: ['MEMBER'] })
    expect(log.newValue).toEqual({ roles: ['MEMBER', `OPERATOR@${district}`] })

    const alert = await prisma.notification.findFirstOrThrow({ where: { recipientId: op.userId, type: 'ROLE_CHANGE' } })
    expect(alert.title).toContain('Operator')
    expect(alert.emailSent).toBe(true)
  })

  it('F32 an Operator can be mapped to several districts, one row each', async () => {
    const op = await fx.person('op2')
    const district2 = await fx.area('di2', 'P0 District Two', 'DISTRICT', state)
    expect((await patch(op.userId, { toggleRole: 'OPERATOR', areaId: district })).status).toBe(200)
    expect((await patch(op.userId, { toggleRole: 'OPERATOR', areaId: district2 })).status).toBe(200)
    expect(await rolesOf(op.userId)).toEqual(['MEMBER', `OPERATOR@${district}`, `OPERATOR@${district2}`].sort())
  })

  it('F32 toggling the same mapping again removes only that mapping, audited as a revoke', async () => {
    const op = await fx.person('op3')
    await patch(op.userId, { toggleRole: 'OPERATOR', areaId: district })
    expect((await patch(op.userId, { toggleRole: 'OPERATOR', areaId: district })).status).toBe(200)
    expect(await rolesOf(op.userId)).toEqual(['MEMBER'])
    const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: op.userId, action: 'admin.user.role_revoke' } })
    expect(log.oldValue).toEqual({ roles: ['MEMBER', `OPERATOR@${district}`] })
    expect(log.newValue).toEqual({ roles: ['MEMBER'] })
  })

  it('F32 mapping must match the role: Operator/District team → district, State team → state, others → none', async () => {
    const u = await fx.person('mapping')
    expect((await patch(u.userId, { toggleRole: 'OPERATOR', areaId: state })).status).toBe(400)
    expect((await patch(u.userId, { toggleRole: 'DISTRICT_TEAM', areaId: state })).status).toBe(400)
    expect((await patch(u.userId, { toggleRole: 'STATE_TEAM', areaId: district })).status).toBe(400)
    expect((await patch(u.userId, { toggleRole: 'DISTRICT_TEAM' })).status).toBe(400)
    expect((await patch(u.userId, { toggleRole: 'STATE_TEAM' })).status).toBe(400)
    expect((await patch(u.userId, { toggleRole: 'NATIONAL_TEAM', areaId: state })).status).toBe(400)
    expect((await patch(u.userId, { toggleRole: 'OPERATOR', areaId: 'no-such-area' })).status).toBe(400)
    expect(await rolesOf(u.userId)).toEqual(['MEMBER'])

    expect((await patch(u.userId, { toggleRole: 'STATE_TEAM', areaId: state })).status).toBe(200)
    expect((await patch(u.userId, { toggleRole: 'DISTRICT_TEAM', areaId: district })).status).toBe(200)
    expect((await patch(u.userId, { toggleRole: 'NATIONAL_TEAM' })).status).toBe(200)
    expect(await rolesOf(u.userId)).toEqual(['MEMBER', 'NATIONAL_TEAM', `DISTRICT_TEAM@${district}`, `STATE_TEAM@${state}`].sort())
  })

  it('F32 the existing unscoped toggle still works (no areaId sent)', async () => {
    const u = await fx.person('legacy')
    expect((await patch(u.userId, { toggleRole: 'KARTA' })).status).toBe(200)
    expect(await rolesOf(u.userId)).toEqual(['KARTA', 'MEMBER'])
    expect((await patch(u.userId, { toggleRole: 'KARTA' })).status).toBe(200)
    expect(await rolesOf(u.userId)).toEqual(['MEMBER'])
  })

  it('F32 GET returns each grant with its area', async () => {
    const u = await fx.person('getter', { roles: [{ code: 'DISTRICT_TEAM', areaId: district }] })
    actAs(admin)
    const body = await (await getAdminUser(jsonReq('http://x', 'GET') as any, { params: { id: u.userId } })).json()
    expect(body.userRoles[0].area).toMatchObject({ id: district, type: 'DISTRICT' })
  })
})

describe('F32 Role assignment — Admin role and account status', () => {
  it('F32 Admin role can be granted to and removed from another user while more than 2 Admins remain', async () => {
    const u = await fx.person('newadmin')
    expect((await patch(u.userId, { toggleRole: 'ADMIN' })).status).toBe(200)
    expect(await countActiveAdmins()).toBeGreaterThanOrEqual(3)
    expect((await patch(u.userId, { toggleRole: 'ADMIN' })).status).toBe(200)
    expect(await rolesOf(u.userId)).toEqual(['MEMBER'])
  })

  it('F32 minimum 2 Admins kept: the role cannot be removed, nor the Admin suspended, at the floor', async () => {
    const active = await prisma.user.findMany({
      where: { status: 'ACTIVE', deletedAt: null, userRoles: { some: { role: { code: 'ADMIN' } } } },
      select: { id: true },
    })
    const keep = active.find((u) => u.id !== admin.userId)!.id
    const parked = active.filter((u) => u.id !== admin.userId && u.id !== keep).map((u) => u.id)
    await prisma.user.updateMany({ where: { id: { in: parked } }, data: { status: 'SUSPENDED' } })
    try {
      expect(await countActiveAdmins()).toBe(2)
      const removeRole = await patch(keep, { toggleRole: 'ADMIN' })
      expect(removeRole.status).toBe(409)
      expect((await removeRole.json()).message).toMatch(/At least 2 active Admins/)
      expect((await patch(keep, { status: 'SUSPENDED' })).status).toBe(409)
      expect((await patch(admin.userId, { toggleRole: 'ADMIN' })).status).toBe(409) // not even yourself
      expect(await countActiveAdmins()).toBe(2)
    } finally {
      await prisma.user.updateMany({ where: { id: { in: parked } }, data: { status: 'ACTIVE' } })
    }
  })

  it('F32 status changes are validated and audited with the old and new value', async () => {
    const u = await fx.person('status')
    expect((await patch(u.userId, { status: 'ROOT' })).status).toBe(400)
    expect((await patch(u.userId, { status: 'SUSPENDED' })).status).toBe(200)
    const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: u.userId, action: 'admin.user.status_change' } })
    expect(log.oldValue).toEqual({ status: 'ACTIVE' })
    expect(log.newValue).toEqual({ status: 'SUSPENDED' })
  })
})
