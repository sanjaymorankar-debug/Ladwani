import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { actAs, jsonReq } from '../uat/helpers'
import { p0Fixtures } from './fixtures'
import { GET as getDirectory } from '@/app/api/directory/route'
import { GET as exportDirectory } from '@/app/api/directory/export/route'
import { PATCH as patchMember } from '@/app/api/members/[id]/route'
import { getViewerScope, expandAreas } from '@/lib/scope'

/**
 *   P0 Country
 *   ├─ State A ─┬─ District A1 ── Taluka A1t ── Village A1v   (inA1: lives here)
 *   │           └─ District A2                                 (inA2)
 *   └─ State B ─── District B1                                 (inB1)
 *   (noArea: no home area on record)
 */
const fx = p0Fixtures('p0f33')
type P = Awaited<ReturnType<typeof fx.person>>
let A: string, A1: string, A1t: string, A1v: string, A2: string, B: string, B1: string
let inA1: P, inA2: P, inB1: P, noArea: P
let districtTeam: P, stateTeam: P, nationalTeam: P, plain: P, operator: P, admin: P

const as = (p: P) => actAs({ userId: p.userId, roles: p.roles, memberId: p.memberId })
async function directory(p: P, query = '') {
  as(p)
  const res = await getDirectory(jsonReq(`http://x/api/directory?${query}`, 'GET') as any)
  return { status: res.status, body: res.status === 200 ? await res.json() : null }
}
const ours = (rows: any[]) => rows.filter((r) => r.memberNumber.startsWith('P0F33-')).map((r) => r.memberNumber).sort()

beforeAll(async () => {
  const c = await fx.area('in', 'P0 Country', 'COUNTRY', null)
  A = await fx.area('a', 'State A', 'STATE', c)
  A1 = await fx.area('a1', 'District A1', 'DISTRICT', A)
  A1t = await fx.area('a1t', 'Taluka A1', 'TALUKA', A1)
  A1v = await fx.area('a1v', 'Village A1', 'VILLAGE', A1t)
  A2 = await fx.area('a2', 'District A2', 'DISTRICT', A)
  B = await fx.area('b', 'State B', 'STATE', c)
  B1 = await fx.area('b1', 'District B1', 'DISTRICT', B)

  inA1 = await fx.person('ina1', { homeAreaId: A1v, mobile: '9811100001' })
  inA2 = await fx.person('ina2', { homeAreaId: A2 })
  inB1 = await fx.person('inb1', { homeAreaId: B1, login: false })
  noArea = await fx.person('noarea')

  districtTeam = await fx.person('dteam', { roles: [{ code: 'MEMBER' }, { code: 'DISTRICT_TEAM', areaId: A1 }] })
  stateTeam = await fx.person('steam', { roles: [{ code: 'MEMBER' }, { code: 'STATE_TEAM', areaId: A }] })
  nationalTeam = await fx.person('nteam', { roles: [{ code: 'MEMBER' }, { code: 'NATIONAL_TEAM' }] })
  plain = await fx.person('plain')
  operator = await fx.person('oper', { roles: [{ code: 'OPERATOR', areaId: A1 }] })
  admin = await fx.person('admin', { roles: [{ code: 'ADMIN' }] })

  // An open review on the in-state member, for the approval-status column.
  await prisma.approval.create({
    data: { actionCode: 'member.address.change', entityType: 'member', entityId: inA1.memberId, status: 'SUBMITTED', submittedBy: inA1.userId },
  })
})
afterAll(async () => {
  await prisma.approval.deleteMany({ where: { entityId: { in: fx.memberIds } } })
  await fx.cleanup()
})

describe('F33 Scoped data views — who sees whom', () => {
  it('F33 District team sees only members of its own district (incl. talukas and villages under it)', async () => {
    const { status, body } = await directory(districtTeam)
    expect(status).toBe(200)
    expect(ours(body.members)).toEqual(['P0F33-INA1'])
  })

  it('F33 State team sees all members of its own state, not of another state', async () => {
    const { body } = await directory(stateTeam)
    expect(ours(body.members)).toEqual(['P0F33-INA1', 'P0F33-INA2'])
  })

  it('F33 National team sees all members, including those with no area and no login', async () => {
    const { body } = await directory(nationalTeam, 'q=P0F33')
    expect(ours(body.members)).toEqual(['P0F33-INA1', 'P0F33-INA2', 'P0F33-INB1', 'P0F33-NOAREA'].concat(
      ['P0F33-ADMIN', 'P0F33-DTEAM', 'P0F33-NTEAM', 'P0F33-OPER', 'P0F33-PLAIN', 'P0F33-STEAM']).sort())
  })

  it('F33 Admin sees all members', async () => {
    const { body } = await directory(admin, 'q=P0F33-IN')
    expect(ours(body.members)).toEqual(['P0F33-INA1', 'P0F33-INA2', 'P0F33-INB1'])
  })

  it('F33 a plain member and an Operator get no directory access', async () => {
    expect((await directory(plain)).status).toBe(403)
    expect((await directory(operator)).status).toBe(403)
  })
})

describe('F33 Scoped data views — scope cannot be bypassed', () => {
  it('F33 forging a team role into the session grants nothing — scope comes from the database', async () => {
    actAs({ userId: plain.userId, roles: ['NATIONAL_TEAM', 'ADMIN'], memberId: plain.memberId })
    expect((await getDirectory(jsonReq('http://x/api/directory', 'GET') as any)).status).toBe(403)
    expect((await exportDirectory(jsonReq('http://x/api/directory/export', 'GET') as any)).status).toBe(403)
  })

  it('F33 an area filter outside the viewer\'s scope is refused, inside it narrows', async () => {
    expect((await directory(districtTeam, `areaId=${A2}`)).status).toBe(403)
    expect((await directory(districtTeam, `areaId=${B}`)).status).toBe(403)
    const inside = await directory(stateTeam, `areaId=${A2}`)
    expect(ours(inside.body.members)).toEqual(['P0F33-INA2'])
  })

  it('F33 a revoked team role stops working on the next request', async () => {
    const temp = await fx.person('tempteam', { roles: [{ code: 'DISTRICT_TEAM', areaId: A1 }] })
    expect((await directory(temp)).status).toBe(200)
    await prisma.userRole.deleteMany({ where: { userId: temp.userId } })
    expect((await directory(temp)).status).toBe(403)
  })

  it('F33 a suspended team member, or an expired grant, has no scope', async () => {
    const suspended = await fx.person('suspteam', { roles: [{ code: 'STATE_TEAM', areaId: A }], status: 'SUSPENDED' })
    expect((await directory(suspended)).status).toBe(403)
    const expired = await fx.person('expteam', { roles: [{ code: 'NATIONAL_TEAM' }] })
    await prisma.userRole.updateMany({ where: { userId: expired.userId }, data: { expiresAt: new Date(Date.now() - 1000) } })
    expect((await directory(expired)).status).toBe(403)
  })

  it('F33 a team grant mapped to the wrong area type gives no scope (fails closed)', async () => {
    const wrong = await fx.person('wrongmap', { roles: [{ code: 'STATE_TEAM', areaId: A1 }] })
    expect((await getViewerScope(wrong.userId)).level).toBe('NONE')
    expect((await directory(wrong)).status).toBe(403)
  })

  it('F33 National team is view only: it cannot edit a member', async () => {
    as(nationalTeam)
    const res = await patchMember(jsonReq('http://x', 'PATCH', { firstName: 'Changed' }) as any, { params: { id: inA2.memberId } })
    expect(res.status).toBe(403)
  })
})

describe('F33 Scoped data views — fields and approval status', () => {
  it('F33 contact details (mobile, email) go to Admin only, never to body teams', async () => {
    const team = (await directory(stateTeam)).body.members.find((r: any) => r.memberNumber === 'P0F33-INA1')
    expect(team).not.toHaveProperty('mobile')
    expect(team).not.toHaveProperty('email')
    const adm = (await directory(admin, 'q=P0F33-INA1')).body.members[0]
    expect(adm.mobile).toBe('9811100001')
  })

  it('F33 age is calculated from date of birth', async () => {
    const row = (await directory(districtTeam)).body.members.find((r: any) => r.memberNumber === 'P0F33-INA1')
    const dob = new Date('1990-01-15'); const now = new Date()
    let age = now.getFullYear() - dob.getFullYear()
    if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) age--
    expect(row.age).toBe(age)
  })

  it('F33 State team and Admin see approval status; District and National teams see final status only', async () => {
    const st = (await directory(stateTeam)).body.members.find((r: any) => r.memberNumber === 'P0F33-INA1')
    expect(st.pendingReviews).toBe(1)
    expect(st.accountStatus).toBe('ACTIVE')
    const adm = (await directory(admin, 'q=P0F33-INA1')).body.members[0]
    expect(adm.pendingReviews).toBe(1)
    const dt = (await directory(districtTeam)).body.members.find((r: any) => r.memberNumber === 'P0F33-INA1')
    expect(dt).not.toHaveProperty('pendingReviews')
    expect(dt.accountStatus).toBe('ACTIVE')
    const nt = (await directory(nationalTeam, 'q=P0F33-INA1')).body.members[0]
    expect(nt).not.toHaveProperty('pendingReviews')
  })
})

describe('F33 Scoped data views — export needs Admin permission', () => {
  const exportAs = async (p: P) => {
    as(p)
    return exportDirectory(jsonReq('http://x/api/directory/export?q=P0F33', 'GET') as any)
  }

  it('F33 team members cannot export without the Admin-granted DATA_EXPORT permission', async () => {
    expect((await exportAs(districtTeam)).status).toBe(403)
    expect((await exportAs(stateTeam)).status).toBe(403)
    expect((await exportAs(nationalTeam)).status).toBe(403)
  })

  it('F33 with DATA_EXPORT a District team exports only its own district, and the export is audited', async () => {
    const exporter = await fx.person('exporter', { roles: [{ code: 'DISTRICT_TEAM', areaId: A1 }, { code: 'DATA_EXPORT' }] })
    const res = await exportAs(exporter)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    const csv = await res.text()
    expect(csv).toContain('P0F33-INA1')
    expect(csv).not.toContain('P0F33-INA2')
    expect(csv).not.toContain('P0F33-INB1')
    expect(csv).not.toContain('9811100001') // no contact columns for teams
    const log = await prisma.auditLog.findFirstOrThrow({ where: { actorId: exporter.userId, action: 'directory.export' } })
    expect((log.metadata as any).rows).toBe(1)
  })

  it('F33 DATA_EXPORT alone, without a team role, grants nothing', async () => {
    const lone = await fx.person('lone', { roles: [{ code: 'DATA_EXPORT' }] })
    expect((await exportAs(lone)).status).toBe(403)
  })

  it('F33 Admin can export everything, including contact details', async () => {
    const res = await exportAs(admin)
    expect(res.status).toBe(200)
    const csv = await res.text()
    expect(csv).toContain('P0F33-INB1')
    expect(csv).toContain('9811100001')
  })
})

describe('P0 scope engine', () => {
  it('expands a state to every district, taluka and village beneath it', async () => {
    expect((await expandAreas([A])).sort()).toEqual([A, A1, A1t, A1v, A2].sort())
    expect((await expandAreas([B1]))).toEqual([B1])
  })
})
