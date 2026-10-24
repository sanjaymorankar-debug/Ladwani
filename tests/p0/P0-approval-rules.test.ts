import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue({ messageId: 'test' }) }))

import { prisma } from '@/lib/prisma'
import { actAs, jsonReq } from '../uat/helpers'
import { p0Fixtures } from './fixtures'
import { PATCH as patchRule } from '@/app/api/admin/approval-rules/[id]/route'
import { requiresApproval } from '@/lib/approvals'

const fx = p0Fixtures('p0ar')
const CODE = 'p0ar.test.action'
const INACTIVE_CODE = 'p0ar.test.inactive'
let admin: { userId: string; roles: string[]; memberId: string | null }
let ruleId: string
let inactiveId: string

const patch = (id: string, body: unknown, as = admin) => {
  actAs(as)
  return patchRule(jsonReq('http://x', 'PATCH', body) as any, { params: { id } })
}
const auditsFor = (entityId: string) =>
  prisma.auditLog.findMany({ where: { entityId, action: 'approval_rule.update' }, orderBy: { createdAt: 'asc' } })

beforeAll(async () => {
  const seededAdmin = await prisma.user.findUniqueOrThrow({
    where: { email: process.env.ADMIN_EMAIL ?? 'admin@miladwani.com' }, include: { member: true },
  })
  admin = { userId: seededAdmin.id, roles: ['ADMIN'], memberId: seededAdmin.member?.id ?? null }
  await prisma.approvalRule.deleteMany({ where: { actionCode: { in: [CODE, INACTIVE_CODE] } } })
  ruleId = (await prisma.approvalRule.create({ data: { actionCode: CODE, requiresApproval: true, approverRole: 'OPERATOR' } })).id
  inactiveId = (await prisma.approvalRule.create({ data: { actionCode: INACTIVE_CODE, requiresApproval: true, isActive: false } })).id
})
afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [ruleId, inactiveId] } } })
  await prisma.approvalRule.deleteMany({ where: { id: { in: [ruleId, inactiveId] } } })
  await fx.cleanup()
})

describe('§28 Approval rules — who may change them', () => {
  it('§28 a non-Admin cannot change a rule, even with ADMIN forged into the session', async () => {
    const intruder = await fx.person('intruder')
    const res = await patch(ruleId, { requiresApproval: false }, { userId: intruder.userId, roles: ['ADMIN'], memberId: intruder.memberId })
    expect(res.status).toBe(403)
    expect((await prisma.approvalRule.findUniqueOrThrow({ where: { id: ruleId } })).requiresApproval).toBe(true)
    expect(await auditsFor(ruleId)).toHaveLength(0)
  })

  it('§28 an Operator cannot change a rule', async () => {
    const op = await fx.person('operator', { roles: [{ code: 'OPERATOR' }] })
    expect((await patch(ruleId, { requiresApproval: false }, { userId: op.userId, roles: ['OPERATOR'], memberId: op.memberId })).status).toBe(403)
  })

  it('§28 a suspended Admin cannot change a rule', async () => {
    const susp = await fx.person('suspadmin', { roles: [{ code: 'ADMIN' }], status: 'SUSPENDED' })
    expect((await patch(ruleId, { requiresApproval: false }, { userId: susp.userId, roles: ['ADMIN'], memberId: susp.memberId })).status).toBe(403)
  })

  it('§28 an Admin whose role is revoked loses access on the next request', async () => {
    const temp = await fx.person('tempadmin', { roles: [{ code: 'MEMBER' }, { code: 'ADMIN' }] })
    const as = { userId: temp.userId, roles: ['ADMIN'], memberId: temp.memberId }
    await prisma.userRole.deleteMany({ where: { userId: temp.userId, role: { code: 'ADMIN' } } })
    expect((await patch(ruleId, { requiresApproval: false }, as)).status).toBe(403)
  })
})

describe('§28 Approval rules — switching a rule', () => {
  it('§28 Admin switches approval off: the action applies at once, and the change is audited with old and new values', async () => {
    expect(await requiresApproval(CODE)).toBe(true)
    const res = await patch(ruleId, { requiresApproval: false })
    expect(res.status).toBe(200)
    expect((await res.json()).rule).toMatchObject({ id: ruleId, actionCode: CODE, requiresApproval: false })
    expect(await requiresApproval(CODE)).toBe(false)

    const [log] = await auditsFor(ruleId)
    expect(log).toMatchObject({
      actorId: admin.userId, actorRole: 'ADMIN', entityType: 'approval_rule', fieldName: 'requiresApproval',
      oldValue: { requiresApproval: true }, newValue: { requiresApproval: false }, metadata: { actionCode: CODE },
    })
  })

  it('§28 Admin switches approval back on, and that is audited too', async () => {
    expect((await patch(ruleId, { requiresApproval: true })).status).toBe(200)
    expect(await requiresApproval(CODE)).toBe(true)
    const logs = await auditsFor(ruleId)
    expect(logs).toHaveLength(2)
    expect(logs[1]).toMatchObject({ oldValue: { requiresApproval: false }, newValue: { requiresApproval: true } })
  })

  it('§28 saving the value a rule already has changes nothing and writes no audit row', async () => {
    const res = await patch(ruleId, { requiresApproval: true })
    expect(res.status).toBe(200)
    expect(await auditsFor(ruleId)).toHaveLength(2)
  })

  it('§28 an inactive rule cannot be switched off: it always requires approval', async () => {
    expect((await patch(inactiveId, { requiresApproval: false })).status).toBe(409)
    expect((await prisma.approvalRule.findUniqueOrThrow({ where: { id: inactiveId } })).requiresApproval).toBe(true)
    expect(await requiresApproval(INACTIVE_CODE)).toBe(true)
    expect(await auditsFor(inactiveId)).toHaveLength(0)
  })

  it('§28 a missing value or non-boolean is rejected, and an unknown rule is not found', async () => {
    expect((await patch(ruleId, {})).status).toBe(400)
    expect((await patch(ruleId, { requiresApproval: 'false' })).status).toBe(400)
    expect((await patch('no-such-rule', { requiresApproval: false })).status).toBe(404)
    expect((await prisma.approvalRule.findUniqueOrThrow({ where: { id: ruleId } })).requiresApproval).toBe(true)
  })
})
