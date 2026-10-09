import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue({ messageId: 'test' }) }))

import { prisma } from '@/lib/prisma'
import { p5Fixtures, actAs, json, png, photoForm, type Person } from '../p5/fixtures'
import { GET as dashboard } from '@/app/api/reports/dashboard/route'
import { GET as myData } from '@/app/api/my/data/route'
import { POST as askDeletion, DELETE as cancelDeletion } from '@/app/api/my/deletion-request/route'
import { GET as deletionQueue } from '@/app/api/admin/deletion-requests/route'
import { POST as processDeletion } from '@/app/api/admin/deletion-requests/[id]/route'
import { GET as consents } from '@/app/api/admin/consents/route'
import { GET as globalStats } from '@/app/api/admin/stats/route'
import { POST as memberPhoto } from '@/app/api/members/[id]/photos/route'
import { toCsv } from '@/lib/dashboard'

const fx = p5Fixtures('p6r')
let geo: Awaited<ReturnType<typeof fx.geography>>
let admin: Person, districtTeam: Person, exporter: Person, stateTeam: Person, plain: Person
let k: Person, son: Person, famId: string

const report = async (as: Person, qs = '') => { actAs(as); return dashboard(json(`http://x/api/reports/dashboard${qs}`, 'GET')) }

beforeAll(async () => {
  geo = await fx.geography()
  admin = await fx.person('admin', { roles: [{ code: 'ADMIN' }] })
  districtTeam = await fx.person('dt', { roles: [{ code: 'MEMBER' }, { code: 'DISTRICT_TEAM', areaId: geo.district }] })
  exporter = await fx.person('dx', { roles: [{ code: 'MEMBER' }, { code: 'DISTRICT_TEAM', areaId: geo.district }, { code: 'DATA_EXPORT' }] })
  stateTeam = await fx.person('st', { roles: [{ code: 'MEMBER' }, { code: 'STATE_TEAM', areaId: geo.state2 }] })
  plain = await fx.adult('plain', { villageId: geo.village })
  k = await fx.adult('k', { villageId: geo.village, dob: '1960-05-05' })
  son = await fx.adult('son', { villageId: geo.village, dob: '1995-05-05' })
  await fx.adult('far1', { villageId: geo.village2 })
  await fx.adult('far2', { villageId: geo.village2, dob: '2015-01-01' })
  famId = await fx.family('Report', k, [{ p: son, role: 'son' }], { villageId: geo.village })
  await prisma.educationRecord.create({ data: { memberId: son.memberId, level: 'UG', isHighest: true } })
})
afterAll(() => fx.cleanup())

describe('F39 Dashboards and reports', () => {
  it('F39 each team sees only its own area; plain members see nothing', async () => {
    const dt = await (await report(districtTeam)).json()
    expect(dt.districts.map((r: any) => r.districtId)).toEqual([geo.district])
    expect(dt.districts[0]).toMatchObject({ members: 3, families: 1 })
    expect(dt.sla).toBeNull() // the SLA report is Admin only

    const st = await (await report(stateTeam)).json()
    expect(st.districts.map((r: any) => r.districtId)).toEqual([geo.district2])
    expect(st.totals.members).toBe(2)

    const all = await (await report(admin)).json()
    expect(all.districts.map((r: any) => r.districtId)).toEqual(expect.arrayContaining([geo.district, geo.district2]))
    expect(Array.isArray(all.sla)).toBe(true)

    expect((await report(plain)).status).toBe(403)
  })

  it('F39 the global counts (/api/admin/stats) are Admin only; Operators and teams are refused', async () => {
    const op = await fx.operator('op', geo.district)
    const stats = async (as: Person) => { actAs(as); return globalStats(json('http://x/api/admin/stats', 'GET') as any) }
    for (const p of [op, districtTeam, stateTeam, plain]) expect((await stats(p)).status).toBe(403)
    const ok = await stats(admin)
    expect(ok.status).toBe(200)
    expect(Object.keys(await ok.json())).toEqual(['families', 'members', 'matrimonial', 'pendingApprovals', 'posts'])
  })

  it('F39 age and education distributions respect the scope', async () => {
    const st = await (await report(stateTeam)).json()
    expect(st.age.find((b: any) => b.band === 'Under 18').members).toBe(1)
    const dt = await (await report(districtTeam)).json()
    expect(dt.education.find((e: any) => e.level === 'Graduate').members).toBe(1)
    expect(dt.age.reduce((s: number, b: any) => s + b.members, 0)).toBe(3)
  })

  it('F39 Excel (CSV) export needs DATA_EXPORT; the SLA report is Admin only; every export is audited', async () => {
    expect((await report(districtTeam, '?export=districts')).status).toBe(403)
    const res = await report(exporter, '?export=districts')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    const bytes = Buffer.from(await res.arrayBuffer())
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]) // UTF-8 BOM: Excel opens it correctly
    const text = bytes.toString('utf8')
    expect(text).toContain('p6r District')
    expect(text).not.toContain('p6r District Two')
    expect((await report(exporter, '?export=sla')).status).toBe(403)
    expect((await report(admin, '?export=sla')).status).toBe(200)
    expect(await prisma.auditLog.count({ where: { actorId: exporter.userId, action: 'report.export' } })).toBe(1)
  })

  it('CSV cells cannot smuggle spreadsheet formulas', () => {
    expect(toCsv([{ name: '=HYPERLINK("http://evil")', n: 1 }])).toContain(`"'=HYPERLINK(""http://evil"")"`)
  })
})

describe('F40 Audit log and data rights', () => {
  it('F40 a member downloads their own data (never the password hash); audited', async () => {
    await prisma.consentRecord.create({ data: { userId: son.userId, consentType: 'DECLARATION', granted: true, version: 'v1', declarationText: 'I declare' } })
    actAs(son)
    const res = await myData(json('http://x', 'GET'))
    expect(res.headers.get('content-disposition')).toContain('attachment')
    const text = await res.text()
    expect(text).not.toMatch(/passwordHash/)
    const data = JSON.parse(text)
    expect(data.profile.id).toBe(son.memberId)
    expect(data.consents[0]).toMatchObject({ consentType: 'DECLARATION', declarationText: 'I declare' })
    expect(await prisma.auditLog.count({ where: { actorId: son.userId, action: 'data.export.self' } })).toBe(1)
  })

  it('F40 deletion: request → Admin anonymises; the tree keeps an anonymous node; login closed; consents kept', async () => {
    actAs(son)
    await memberPhoto(photoForm(await png(), { visibility: 'REGISTERED_MEMBERS' }), { params: { id: son.memberId } })
    actAs(son)
    expect((await askDeletion(json('http://x', 'POST', { reason: 'Leaving' }))).status).toBe(201)
    actAs(son)
    expect((await askDeletion(json('http://x', 'POST', {}))).status).toBe(409)
    expect(await prisma.notification.count({ where: { recipientId: admin.userId, type: 'DATA_DELETION' } })).toBe(1)

    actAs(plain)
    expect((await deletionQueue()).status).toBe(403)
    actAs(admin)
    const { requests } = await (await deletionQueue()).json()
    const mine = requests.find((r: any) => r.userId === son.userId)
    actAs(admin)
    expect((await processDeletion(json('http://x', 'POST', { action: 'complete' }), { params: { id: mine.id } })).status).toBe(200)

    const node = await prisma.member.findUniqueOrThrow({ where: { id: son.memberId } })
    expect(node).toMatchObject({ firstName: 'Former member', lastName: null, userId: null, email: null, mobilePrimary: null, dateOfBirthApprox: true })
    expect(node.dateOfBirth?.getUTCFullYear()).toBe(1995)
    expect(await prisma.familyMember.count({ where: { familyId: famId, memberId: son.memberId, leftAt: null } })).toBe(1) // tree intact
    const user = await prisma.user.findUniqueOrThrow({ where: { id: son.userId } })
    expect(user).toMatchObject({ status: 'DEACTIVATED', email: null, mobile: null })
    expect(user.deletedAt).not.toBeNull()
    expect(await prisma.userRole.count({ where: { userId: son.userId } })).toBe(0)
    expect(await prisma.photo.count({ where: { uploadedBy: son.userId } })).toBe(0)
    expect(await prisma.educationRecord.count({ where: { memberId: son.memberId } })).toBe(0)
    expect(await prisma.consentRecord.count({ where: { userId: son.userId } })).toBe(1) // legal record kept
    expect(await prisma.auditLog.count({ where: { action: 'data.deletion.complete', entityId: son.userId } })).toBe(1)
  })

  it('F40 a Karta must hand over first; a request can be cancelled or rejected with a reason', async () => {
    actAs(k)
    await askDeletion(json('http://x', 'POST', {}))
    const req = await prisma.dataDeletionRequest.findFirstOrThrow({ where: { userId: k.userId, status: 'PENDING' } })
    actAs(admin)
    const refused = await processDeletion(json('http://x', 'POST', { action: 'complete' }), { params: { id: req.id } })
    expect(refused.status).toBe(409)
    expect((await refused.json()).message).toMatch(/Karta/)
    actAs(admin)
    expect((await processDeletion(json('http://x', 'POST', { action: 'reject' }), { params: { id: req.id } })).status).toBe(400)
    actAs(admin)
    expect((await processDeletion(json('http://x', 'POST', { action: 'reject', note: 'Hand over the family first' }), { params: { id: req.id } })).status).toBe(200)
    actAs(plain)
    await askDeletion(json('http://x', 'POST', {}))
    actAs(plain)
    expect((await cancelDeletion(json('http://x', 'DELETE'))).status).toBe(200)
    expect(await prisma.dataDeletionRequest.count({ where: { userId: plain.userId, status: 'CANCELLED' } })).toBe(1)
  })

  it('F40 consent records are searchable by the Admin (and exportable)', async () => {
    await prisma.consentRecord.create({ data: { userId: plain.userId, consentType: 'DECLARATION', granted: true, version: 'v1' } })
    const personId = (await prisma.member.findUniqueOrThrow({ where: { id: plain.memberId } })).memberNumber
    actAs(admin)
    const found = await (await consents(json(`http://x/api/admin/consents?q=${personId}&type=DECLARATION`, 'GET'))).json()
    expect(found.consents).toHaveLength(1)
    expect(found.consents[0]).toMatchObject({ personId, type: 'DECLARATION', granted: true })
    actAs(plain)
    expect((await consents(json('http://x/api/admin/consents', 'GET'))).status).toBe(403)
    actAs(admin)
    expect((await consents(json(`http://x/api/admin/consents?q=${personId}&export=csv`, 'GET'))).headers.get('content-type')).toContain('text/csv')
  })
})
