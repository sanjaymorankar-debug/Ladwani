import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue({ messageId: 'test' }) }))

import { prisma } from '@/lib/prisma'
import { p1Fixtures, actAs, json, idProofForm, type Person } from './fixtures'
import { PATCH as patchMember } from '@/app/api/members/[id]/route'
import { PUT as putMulGaon } from '@/app/api/members/[id]/mul-gaon/route'
import { POST as uploadProof } from '@/app/api/verification/id-proof/route'
import { POST as decide } from '@/app/api/verification/tasks/[id]/route'

const fx = p1Fixtures('p1chg')
let geo: Awaited<ReturnType<typeof fx.geography>>
let opA: Person, opB: Person, admin: Person
const ALL = { name: true, dob: true, address: true, photo: true }

const patch = (p: Person, body: unknown) => { actAs(p); return patchMember(json('http://x', 'PATCH', body), { params: { id: p.memberId } }) }
const member = (p: Person) => prisma.member.findUniqueOrThrow({ where: { id: p.memberId } })
const pending = (p: Person) => prisma.profileChangeRequest.findFirst({ where: { memberId: p.memberId, status: 'PENDING' }, include: { tasks: true } })
async function decideAll(p: Person, decision: string) {
  const cr = (await pending(p))!
  for (const t of cr.tasks) {
    const op = [opA, opB].find((o) => o.userId === t.operatorUserId)!
    actAs(op)
    const res = await decide(json('http://x', 'POST', decision === 'APPROVED'
      ? { decision, checklist: ALL } : { decision, remarks: 'Does not match the ID proof' }), { params: { id: t.id } })
    expect(res.status).toBe(200)
  }
  return cr.id
}

beforeAll(async () => {
  geo = await fx.geography()
  opA = await fx.operator('opa', geo.district)
  opB = await fx.operator('opb', geo.district)
  admin = await fx.person('admin', { roles: [{ code: 'ADMIN' }] })
})
afterAll(() => fx.cleanup())

describe('F08 Re-approval of sensitive profile changes', () => {
  let p: Person
  beforeAll(async () => { p = await fx.applicant('active', geo.village, { status: 'ACTIVE' }) })

  it('F08 normal fields (education, occupation, photo, address…) save instantly', async () => {
    const res = await patch(p, { biography: 'Teacher', employmentStatus: 'RETIRED' })
    expect(res.status).toBe(200)
    expect((await res.json()).pendingChange).toBe(false)
    expect((await member(p)).employmentStatus).toBe('RETIRED')
  })

  it('F08 a name / DOB / gender change becomes a change request with two operator tasks; the old value stays live', async () => {
    const res = await patch(p, { firstName: 'Ramesh', dateOfBirth: '1991-01-01', biography: 'Teacher and writer' })
    expect(res.status).toBe(200)
    expect((await res.json()).pendingChange).toBe(true)
    const m = await member(p)
    expect(m.firstName).toBe('active')            // unchanged until approved
    expect(m.biography).toBe('Teacher and writer') // normal field saved now
    const cr = (await pending(p))!
    expect(cr.changes).toMatchObject({ firstName: { old: 'active', new: 'Ramesh' }, dateOfBirth: { old: '1990-01-15', new: '1991-01-01' } })
    expect(cr.tasks).toHaveLength(2)
    expect(new Set(cr.tasks.map((t) => t.operatorUserId))).toEqual(new Set([opA.userId, opB.userId]))
  })

  it('F08 only one sensitive change at a time', async () => {
    expect((await patch(p, { lastName: 'Other' })).status).toBe(409)
  })

  it('F08 once both operators approve, the new values go live and the user is told', async () => {
    const id = await decideAll(p, 'APPROVED')
    const m = await member(p)
    expect(m.firstName).toBe('Ramesh')
    expect(m.dateOfBirth!.toISOString().slice(0, 10)).toBe('1991-01-01')
    expect((await prisma.profileChangeRequest.findUniqueOrThrow({ where: { id } })).status).toBe('APPROVED')
    expect(await prisma.notification.count({ where: { recipientId: p.userId, type: 'PROFILE_CHANGE_RESULT' } })).toBe(1)
  })

  it('F08 a rejected change leaves the old value in place', async () => {
    await patch(p, { gender: 'OTHER' })
    await decideAll(p, 'REJECTED')
    expect((await member(p)).gender).toBe('MALE')
  })

  it('F08 every change is kept in history with old and new value, who and when', async () => {
    const logs = await prisma.auditLog.findMany({ where: { entityId: p.memberId }, orderBy: { createdAt: 'asc' } })
    const applied = logs.find((l) => l.action === 'profile_change.applied')!
    expect(applied.oldValue).toMatchObject({ firstName: 'active' })
    expect(applied.newValue).toMatchObject({ firstName: 'Ramesh' })
    const direct = logs.find((l) => l.action === 'member.profile.update' && (l.newValue as any)?.employmentStatus)!
    expect(direct.actorId).toBe(p.userId)
    expect(direct.oldValue).toMatchObject({ employmentStatus: 'STUDENT' })
    expect(direct.createdAt).toBeInstanceOf(Date)
  })

  it('F08 Mul Gaon is sensitive too', async () => {
    actAs(p)
    const res = await putMulGaon(json('http://x', 'PUT', { areaId: geo.village2 }), { params: { id: p.memberId } })
    expect(res.status).toBe(202)
    expect((await prisma.memberArea.findFirstOrThrow({ where: { memberId: p.memberId, isPrimary: true } })).areaId).toBe(geo.village)
    await decideAll(p, 'APPROVED')
    expect((await prisma.memberArea.findFirstOrThrow({ where: { memberId: p.memberId, isPrimary: true } })).areaId).toBe(geo.village2)
    expect((await member(p)).nativeDistrict).toBe('p1chg District Two')
  })

  it('F08 a new ID proof is a change request; the current proof stays in use until approved', async () => {
    const q = await fx.applicant('proof', geo.village, { status: 'ACTIVE' })
    await prisma.idProof.create({
      data: { userId: q.userId, memberId: q.memberId, idType: 'AADHAAR', idLast4: '1111', proofKey: 'x', proofMime: 'image/png', selfSignedKey: 'y', selfSignedMime: 'image/png' },
    })
    actAs(q)
    expect((await uploadProof(idProofForm('PAN', 'ABCDE1234F'))).status).toBe(202)
    expect((await prisma.idProof.findFirstOrThrow({ where: { memberId: q.memberId, status: 'ACTIVE' } })).idLast4).toBe('1111')
    await decideAll(q, 'APPROVED')
    expect((await prisma.idProof.findFirstOrThrow({ where: { memberId: q.memberId, status: 'ACTIVE' } })).idLast4).toBe('234F')
  })
})

describe('F08 edge rules', () => {
  it('before approval (DRAFT) the whole profile is still being filled in — names save directly', async () => {
    const d = await fx.applicant('draft', geo.village)
    const res = await patch(d, { firstName: 'Direct' })
    expect((await res.json()).pendingChange).toBe(false)
    expect((await member(d)).firstName).toBe('Direct')
  })

  it('while under review the sensitive fields are locked', async () => {
    const r = await fx.applicant('review', geo.village, { status: 'PENDING_APPROVAL' })
    expect((await patch(r, { firstName: 'Sneaky' })).status).toBe(409)
    actAs(r)
    expect((await putMulGaon(json('http://x', 'PUT', { areaId: geo.village2 }), { params: { id: r.memberId } })).status).toBe(409)
  })

  it('an Admin edit applies directly (and is audited)', async () => {
    const t = await fx.applicant('admined', geo.village, { status: 'ACTIVE' })
    actAs(admin)
    const res = await patchMember(json('http://x', 'PATCH', { firstName: 'Corrected' }), { params: { id: t.memberId } })
    expect(res.status).toBe(200)
    expect((await member(t)).firstName).toBe('Corrected')
    const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: t.memberId, action: 'member.profile.update', actorId: admin.userId } })
    expect(log.oldValue).toMatchObject({ firstName: 'admined' })
  })
})
