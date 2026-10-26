import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { actAs, jsonReq } from '../uat/helpers'
import { p0Fixtures } from './fixtures'
import { GET as listAreas, POST as createArea } from '@/app/api/admin/areas/route'
import { PATCH as patchArea } from '@/app/api/admin/areas/[id]/route'

const fx = p0Fixtures('p0loc')
type P = Awaited<ReturnType<typeof fx.person>>
let admin: P, operator: P, created: string[] = []

const post = async (body: unknown, who: P = admin) => {
  actAs({ userId: who.userId, roles: who.roles, memberId: who.memberId })
  const res = await createArea(jsonReq('http://x', 'POST', body) as any)
  const json = await res.json()
  if (res.status === 201) { created.push(json.area.id); fx.areaIds.push(json.area.id) }
  return { status: res.status, json }
}

beforeAll(async () => {
  admin = await fx.person('admin', { roles: [{ code: 'ADMIN' }] })
  operator = await fx.person('op', { roles: [{ code: 'OPERATOR' }] })
})
afterAll(() => fx.cleanup())

describe('P0 Location master (State > District > Taluka > Village)', () => {
  it('P0 Admin builds the four levels in order, each create audited', async () => {
    const st = await post({ name: 'P0Loc State', type: 'STATE' })
    expect(st.status).toBe(201)
    const di = await post({ name: 'P0Loc District', type: 'DISTRICT', parentId: st.json.area.id })
    const ta = await post({ name: 'P0Loc Taluka', type: 'TALUKA', parentId: di.json.area.id })
    const vi_ = await post({ name: 'P0Loc Village', type: 'VILLAGE', parentId: ta.json.area.id })
    expect([di.status, ta.status, vi_.status]).toEqual([201, 201, 201])

    const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: vi_.json.area.id, action: 'area.create' } })
    expect(log.newValue).toMatchObject({ name: 'P0Loc Village', type: 'VILLAGE', parentId: ta.json.area.id })

    actAs({ userId: admin.userId, roles: admin.roles, memberId: admin.memberId })
    const list = await (await listAreas(jsonReq(`http://x/api/admin/areas?parentId=${ta.json.area.id}`, 'GET') as any)).json()
    expect(list.areas.map((a: any) => a.name)).toEqual(['P0Loc Village'])
  })

  it('P0 a level must sit under the level above it', async () => {
    const st = await post({ name: 'P0Loc State Two', type: 'STATE' })
    expect((await post({ name: 'Bad Village', type: 'VILLAGE', parentId: st.json.area.id })).status).toBe(400)
    expect((await post({ name: 'Bad Taluka', type: 'TALUKA', parentId: st.json.area.id })).status).toBe(400)
    expect((await post({ name: 'Orphan District', type: 'DISTRICT' })).status).toBe(400)
    expect((await post({ name: 'Nowhere', type: 'GALAXY' })).status).toBe(400)
    expect((await post({ name: 'X', type: 'STATE' })).status).toBe(400)
  })

  it('P0 duplicate names under the same parent are refused', async () => {
    const st = await post({ name: 'P0Loc Dup State', type: 'STATE' })
    expect((await post({ name: 'Same', type: 'DISTRICT', parentId: st.json.area.id })).status).toBe(201)
    expect((await post({ name: 'Same', type: 'DISTRICT', parentId: st.json.area.id })).status).toBe(409)
  })

  it('P0 rename and deactivate are audited with old and new values; there is no delete', async () => {
    const st = await post({ name: 'P0Loc Rename', type: 'STATE' })
    actAs({ userId: admin.userId, roles: admin.roles, memberId: admin.memberId })
    const res = await patchArea(jsonReq('http://x', 'PATCH', { name: 'P0Loc Renamed', isActive: false }) as any, { params: { id: st.json.area.id } })
    expect(res.status).toBe(200)
    const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: st.json.area.id, action: 'area.update' } })
    expect(log.oldValue).toEqual({ name: 'P0Loc Rename', isActive: true })
    expect(log.newValue).toEqual({ name: 'P0Loc Renamed', isActive: false })
  })

  it('P0 only an Admin (checked in the database) manages locations', async () => {
    expect((await post({ name: 'P0Loc Op State', type: 'STATE' }, operator)).status).toBe(403)
    const forged = { ...operator, roles: ['ADMIN'] }
    expect((await post({ name: 'P0Loc Forged', type: 'STATE' }, forged)).status).toBe(403)
    actAs({ userId: operator.userId, roles: ['ADMIN'], memberId: operator.memberId })
    expect((await listAreas(jsonReq('http://x', 'GET') as any)).status).toBe(403)
    expect((await patchArea(jsonReq('http://x', 'PATCH', { name: 'Hacked' }) as any, { params: { id: created[0] } })).status).toBe(403)
  })
})
