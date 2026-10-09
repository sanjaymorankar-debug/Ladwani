import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue({ messageId: 'test' }) }))

import { prisma } from '@/lib/prisma'
import { p1Fixtures, actAs, json, idProofForm, type Person } from './fixtures'
import { POST as uploadProof } from '@/app/api/verification/id-proof/route'
import { POST as submit } from '@/app/api/verification/submit/route'
import { GET as getStatus } from '@/app/api/verification/route'
import { GET as myTasks } from '@/app/api/verification/tasks/route'
import { GET as getTask, POST as decide } from '@/app/api/verification/tasks/[id]/route'
import { GET as monitor } from '@/app/api/approval-monitor/route'
import { POST as monitorAction } from '@/app/api/approval-monitor/tasks/[id]/route'
import { GET as cron } from '@/app/api/cron/approval-sla/route'
import { GET as getMember } from '@/app/api/members/[id]/route'
import { PATCH as patchMember } from '@/app/api/members/[id]/route'

const fx = p1Fixtures('p1ap')
let geo: Awaited<ReturnType<typeof fx.geography>>
let opA: Person, opB: Person, opC: Person, opFar: Person
let admin: Person, stateTeam: Person, otherStateTeam: Person, districtTeam: Person, nationalTeam: Person

const ALL_TICKED = { name: true, dob: true, address: true, photo: true }

async function submitted(tag: string) {
  const p = await fx.applicant(tag, geo.village)
  actAs(p)
  expect((await uploadProof(idProofForm('PAN', 'ABCDE1234F'))).status).toBe(201)
  await fx.declare(p)
  const res = await submit(json('http://x', 'POST'))
  expect(res.status).toBe(200)
  return p
}
const live = (p: Person) => prisma.approvalTask.findMany({ where: { subjectUserId: p.userId, supersededAt: null }, orderBy: { slot: 'asc' } })
const taskOf = async (subject: Person, op: Person) =>
  prisma.approvalTask.findFirstOrThrow({ where: { subjectUserId: subject.userId, operatorUserId: op.userId, supersededAt: null } })
async function decideAs(op: Person, taskId: string, body: Record<string, unknown>) {
  actAs(op)
  return decide(json('http://x', 'POST', body), { params: { id: taskId } })
}
const userStatus = async (p: Person) => (await prisma.user.findUniqueOrThrow({ where: { id: p.userId } })).status
const opsOf = async (p: Person) => (await live(p)).map((t) => t.operatorUserId)
/** The applicant's two operators, as Person objects. */
async function pair(p: Person) {
  const ids = await opsOf(p)
  return [opA, opB, opC].filter((o) => ids.includes(o.userId))
}

beforeAll(async () => {
  geo = await fx.geography()
  opA = await fx.operator('opa', geo.district)
  opB = await fx.operator('opb', geo.district)
  opC = await fx.operator('opc', geo.district)
  opFar = await fx.operator('opfar', geo.district2)
  admin = await fx.person('admin', { roles: [{ code: 'ADMIN' }] })
  stateTeam = await fx.person('steam', { roles: [{ code: 'STATE_TEAM', areaId: geo.state }] })
  otherStateTeam = await fx.person('steam2', { roles: [{ code: 'STATE_TEAM', areaId: geo.state2 }] })
  districtTeam = await fx.person('dteam', { roles: [{ code: 'DISTRICT_TEAM', areaId: geo.district }] })
  nationalTeam = await fx.person('nteam', { roles: [{ code: 'NATIONAL_TEAM' }] })
  process.env.CRON_SECRET = 'p1-cron-secret-0123456789'
})
afterAll(() => fx.cleanup())

describe('F04 Assignment of two approvers', () => {
  it('F04 creates two separate OPEN tasks for two different Operators of the subject\'s district, and alerts each', async () => {
    const p = await submitted('assign')
    const tasks = await live(p)
    expect(tasks).toHaveLength(2)
    expect(tasks.map((t) => t.status)).toEqual(['OPEN', 'OPEN'])
    expect(tasks[0].operatorUserId).not.toBe(tasks[1].operatorUserId)
    for (const t of tasks) {
      expect([opA.userId, opB.userId, opC.userId]).toContain(t.operatorUserId)
      expect(t.districtAreaId).toBe(geo.district)
      expect(await prisma.notification.count({ where: { recipientId: t.operatorUserId!, type: 'APPROVAL_TASK', data: { path: '$.taskId', equals: t.id } } })).toBe(1)
    }
    expect(tasks.map((t) => t.operatorUserId)).not.toContain(opFar.userId)
  })

  it('F04 round robin by workload: the least busy Operators get the next registration', async () => {
    // The previous test's applicant holds two of the three Operators; the
    // third is now the least busy and must be in the next pair.
    const previous = await prisma.user.findUniqueOrThrow({ where: { email: 'p1ap-assign@p0.example.test' } })
    const busy = await opsOf({ userId: previous.id } as Person)
    const p = await submitted('rr1')
    const free = [opA, opB, opC].map((o) => o.userId).filter((id) => !busy.includes(id))
    expect(await opsOf(p)).toEqual(expect.arrayContaining(free))
  })

  it('F04 an Operator never verifies themself or a member of their own family', async () => {
    const p = await fx.applicant('kin', geo.village)
    await fx.family('kinfam', [p.memberId, opA.memberId])
    actAs(p)
    await uploadProof(idProofForm('PAN', 'ABCDE1234F'))
    await fx.declare(p)
    await submit(json('http://x', 'POST'))
    expect(await opsOf(p)).not.toContain(opA.userId)
    expect(new Set(await opsOf(p))).toEqual(new Set([opB.userId, opC.userId]))
  })

  it('F04 with fewer than two eligible Operators the open slot waits for an Admin, who is alerted', async () => {
    const lonely = await fx.applicant('far', geo.village2)
    actAs(lonely)
    await uploadProof(idProofForm('PAN', 'ABCDE1234F'))
    await fx.declare(lonely)
    await submit(json('http://x', 'POST'))
    const tasks = await live(lonely)
    expect(tasks.map((t) => t.operatorUserId)).toEqual([opFar.userId, null])
    expect(await prisma.notification.count({ where: { recipientId: admin.userId, type: 'APPROVAL_TASK' } })).toBeGreaterThan(0)
  })
})

describe('F05 Blind verification — an Operator sees only their own task', () => {
  let p: Person, mine: Person, other: Person, myTask: string, otherTask: string
  beforeAll(async () => {
    p = await submitted('blind')
    ;[mine, other] = await pair(p)
    myTask = (await taskOf(p, mine)).id
    otherTask = (await taskOf(p, other)).id
  })

  it('F05 the queue lists only the caller\'s own tasks', async () => {
    actAs(mine)
    const { tasks } = await (await myTasks()).json()
    const ids = tasks.map((t: any) => t.id)
    expect(ids).toContain(myTask)
    expect(ids).not.toContain(otherTask)
    expect(JSON.stringify(tasks)).not.toContain(other.userId)
  })

  it('F05 the other Operator\'s task cannot be read or decided — it looks like it does not exist', async () => {
    actAs(mine)
    expect((await getTask(json('http://x', 'GET'), { params: { id: otherTask } })).status).toBe(404)
    expect((await decideAs(mine, otherTask, { decision: 'APPROVED', checklist: ALL_TICKED })).status).toBe(404)
  })

  it('F05 the task view shows the profile and proof, and nothing about the other task', async () => {
    actAs(mine)
    const body = await (await getTask(json('http://x', 'GET'), { params: { id: myTask } })).json()
    expect(body.subject.memberNumber).toBe('P1AP-BLIND')
    expect(body.idProofs[0].masked).toBe('XXXX XXXX 234F')
    expect(body.idProofs[0].files.proof).toContain('/api/id-proofs/')
    const text = JSON.stringify(body)
    expect(text).not.toContain(otherTask)
    expect(text).not.toContain(other.userId)
  })

  it('F05 Approve needs the full checklist; Reject / Send back need remarks', async () => {
    expect((await decideAs(mine, myTask, { decision: 'APPROVED', checklist: { name: true } })).status).toBe(400)
    expect((await decideAs(mine, myTask, { decision: 'REJECTED', remarks: '' })).status).toBe(400)
    expect((await decideAs(mine, myTask, { decision: 'MAYBE' })).status).toBe(400)
  })

  it('F05 a decision is final — a second submission is refused', async () => {
    expect((await decideAs(mine, myTask, { decision: 'APPROVED', checklist: ALL_TICKED })).status).toBe(200)
    expect((await decideAs(mine, myTask, { decision: 'REJECTED', remarks: 'changed my mind' })).status).toBe(409)
  })

  it('F05 after one decision the other Operator still sees no decision — and the user is still pending', async () => {
    actAs(other)
    const body = await (await getTask(json('http://x', 'GET'), { params: { id: otherTask } })).json()
    expect(body.task.status).toBe('OPEN')
    expect(JSON.stringify(body)).not.toMatch(/APPROVED/)
    expect(await userStatus(p)).toBe('PENDING_APPROVAL')
  })

  it('F05 an Operator cannot reach the Approval Monitor (per-operator status is Admin / State team only)', async () => {
    actAs(mine)
    expect((await monitor(json('http://x', 'GET'))).status).toBe(403)
    expect((await monitorAction(json('http://x', 'POST', { action: 'reopen' }), { params: { id: myTask } })).status).toBe(403)
  })

  it('decision 3: an Operator sees a member\'s full profile only while holding an undecided task for them', async () => {
    actAs(other)
    const withTask = await (await getMember(json('http://x', 'GET'), { params: { id: p.memberId } })).json()
    expect(withTask.mobilePrimary).not.toBeNull()
    actAs(mine) // already decided
    const decided = await (await getMember(json('http://x', 'GET'), { params: { id: p.memberId } })).json()
    expect(decided.mobilePrimary).toBeNull()
    actAs(opFar) // never had a task
    expect((await (await getMember(json('http://x', 'GET'), { params: { id: p.memberId } })).json()).mobilePrimary).toBeNull()
    expect((await patchMember(json('http://x', 'PATCH', { biography: 'operator edit' }), { params: { id: p.memberId } })).status).toBe(403)
  })
})

describe('F06 Final approval outcome', () => {
  it('F06 both approve → ACTIVE, and the user is told the result', async () => {
    const p = await submitted('yes')
    for (const op of await pair(p)) await decideAs(op, (await taskOf(p, op)).id, { decision: 'APPROVED', checklist: ALL_TICKED })
    expect(await userStatus(p)).toBe('ACTIVE')
    const n = await prisma.notification.findFirstOrThrow({ where: { recipientId: p.userId, type: 'REGISTRATION_RESULT' } })
    expect(n.title).toMatch(/approved/)
  })

  it('F06 one reject → REJECTED with the combined reason, never the operator names', async () => {
    const p = await submitted('no')
    const [x, y] = await pair(p)
    await decideAs(x, (await taskOf(p, x)).id, { decision: 'APPROVED', checklist: ALL_TICKED })
    await decideAs(y, (await taskOf(p, y)).id, { decision: 'REJECTED', remarks: 'Photo does not match the ID proof' })
    expect(await userStatus(p)).toBe('REJECTED')
    actAs(p)
    const status = await (await getStatus()).json()
    expect(status.note).toContain('Photo does not match the ID proof')
    const visible = JSON.stringify(status)
    for (const op of [x, y]) {
      expect(visible).not.toContain(op.userId)
      expect(visible).not.toContain(`p1ap-op`)
    }
  })

  it('F06 send back → CORRECTION_REQUIRED; resubmitting reopens both tasks for the same Operators', async () => {
    const p = await submitted('fix')
    const [x, y] = await pair(p)
    await decideAs(x, (await taskOf(p, x)).id, { decision: 'SENT_BACK', remarks: 'Upload a clearer proof' })
    await decideAs(y, (await taskOf(p, y)).id, { decision: 'APPROVED', checklist: ALL_TICKED })
    expect(await userStatus(p)).toBe('CORRECTION_REQUIRED')

    actAs(p)
    expect((await submit(json('http://x', 'POST'))).status).toBe(400) // needs a fresh declaration
    await fx.declare(p)
    expect((await submit(json('http://x', 'POST'))).status).toBe(200)
    const round2 = await prisma.approvalTask.findMany({ where: { subjectUserId: p.userId, round: 2 } })
    expect(round2.map((t) => t.status)).toEqual(['OPEN', 'OPEN'])
    expect(new Set(round2.map((t) => t.operatorUserId))).toEqual(new Set([x.userId, y.userId]))
    // Round-1 decisions are kept, unchanged.
    expect(await prisma.approvalTask.count({ where: { subjectUserId: p.userId, round: 1, status: 'SENT_BACK' } })).toBe(1)
  })

  it('F06 past the SLA a task is escalated, reassigned to another Operator, and District team + Admin are alerted', async () => {
    const p = await submitted('slow')
    const [x, y] = await pair(p)
    const stale = await taskOf(p, x)
    await prisma.approvalTask.update({ where: { id: stale.id }, data: { dueAt: new Date(Date.now() - 1000) } })

    expect((await cron(new Request('http://x/api/cron/approval-sla'))).status).toBe(403)
    expect((await cron(new Request('http://x', { headers: { 'x-cron-secret': 'wrong-secret-0123456789' } }))).status).toBe(403)
    const res = await cron(new Request('http://x', { headers: { 'x-cron-secret': process.env.CRON_SECRET! } }))
    expect(res.status).toBe(200)

    const old = await prisma.approvalTask.findUniqueOrThrow({ where: { id: stale.id } })
    expect(old.status).toBe('ESCALATED')
    expect(old.supersededAt).not.toBeNull()
    const fresh = await prisma.approvalTask.findFirstOrThrow({ where: { subjectUserId: p.userId, slot: stale.slot, supersededAt: null } })
    expect(fresh.operatorUserId).not.toBe(x.userId)
    expect(fresh.operatorUserId).not.toBe(y.userId) // still two different people
    expect(await prisma.notification.count({ where: { recipientId: districtTeam.userId, type: 'APPROVAL_SLA' } })).toBeGreaterThan(0)
    expect(await prisma.notification.count({ where: { recipientId: admin.userId, type: 'APPROVAL_SLA' } })).toBeGreaterThan(0)
    // The escalated operator can no longer decide it.
    expect((await decideAs(x, stale.id, { decision: 'APPROVED', checklist: ALL_TICKED })).status).toBe(409)
  })
})

describe('F07 Approval monitor', () => {
  let p: Person
  beforeAll(async () => {
    p = await submitted('mon')
    const [x] = await pair(p)
    await decideAs(x, (await taskOf(p, x)).id, { decision: 'APPROVED', checklist: ALL_TICKED })
  })
  const rows = async (viewer: Person, query = '') => {
    actAs(viewer)
    const res = await monitor(json(`http://x/api/approval-monitor?${query}`, 'GET'))
    return { status: res.status, body: res.status === 200 ? await res.json() : null }
  }

  it('F07 Admin sees each Operator\'s decision and timestamp', async () => {
    const { body } = await rows(admin)
    const mine = body.tasks.filter((t: any) => t.subject.memberNumber === 'P1AP-MON')
    expect(mine).toHaveLength(2)
    expect(mine.map((t: any) => t.status).sort()).toEqual(['APPROVED', 'OPEN'])
    expect(mine.find((t: any) => t.status === 'APPROVED').decidedAt).toBeTruthy()
    expect(mine.every((t: any) => t.operator?.name)).toBe(true)
    expect(body.canManage).toBe(true)
  })

  it('F07 State team sees its own state only; filters by district, operator and age work', async () => {
    const { body } = await rows(stateTeam)
    expect(body.tasks.some((t: any) => t.subject.memberNumber === 'P1AP-MON')).toBe(true)
    expect(body.tasks.some((t: any) => t.subject.memberNumber === 'P1AP-FAR')).toBe(false)
    expect(body.canManage).toBe(false)
    expect(body.tasks[0].remarks).toBeUndefined()
    const other = await rows(otherStateTeam)
    expect(other.body.tasks.some((t: any) => t.subject.memberNumber === 'P1AP-MON')).toBe(false)
    expect((await rows(admin, `districtId=${geo.district2}`)).body.tasks.every((t: any) => t.district === 'p1ap District Two')).toBe(true)
    expect((await rows(admin, `operatorId=${opFar.userId}`)).body.tasks.every((t: any) => t.operator?.id === opFar.userId)).toBe(true)
    expect((await rows(admin, 'minAgeDays=30')).body.tasks.filter((t: any) => t.subject.memberNumber?.startsWith('P1AP'))).toHaveLength(0)
  })

  it('F07 District and National teams see final status only — no monitor', async () => {
    expect((await rows(districtTeam)).status).toBe(403)
    expect((await rows(nationalTeam)).status).toBe(403)
  })

  it('F07 Admin can reassign an open task (never to the other slot\'s Operator) and reopen a decided one', async () => {
    const [x, y] = await pair(p)
    const open = await taskOf(p, y)
    actAs(admin)
    expect((await monitorAction(json('http://x', 'POST', { action: 'reassign', operatorUserId: x.userId }), { params: { id: open.id } })).status).toBe(400)
    const spare = [opA, opB, opC].find((o) => o.userId !== x.userId && o.userId !== y.userId)!
    expect((await monitorAction(json('http://x', 'POST', { action: 'reassign', operatorUserId: spare.userId }), { params: { id: open.id } })).status).toBe(200)
    expect((await taskOf(p, spare)).status).toBe('OPEN')

    const decided = await taskOf(p, x)
    expect((await monitorAction(json('http://x', 'POST', { action: 'reopen' }), { params: { id: decided.id } })).status).toBe(200)
    const reopened = await taskOf(p, x)
    expect(reopened.status).toBe('OPEN')
    expect(reopened.id).not.toBe(decided.id)
    expect((await prisma.approvalTask.findUniqueOrThrow({ where: { id: decided.id } })).status).toBe('APPROVED') // history kept

    const trail = await prisma.auditLog.findMany({ where: { entityId: { in: [open.id, decided.id] } }, select: { action: true } })
    expect(trail.map((a) => a.action)).toEqual(expect.arrayContaining(['approval_task.decide', 'approval_task.reassign', 'approval_task.reopen']))
  })

  it('F07 reopening an already-decided registration puts the user back to pending', async () => {
    const q = await submitted('reopen')
    for (const op of await pair(q)) await decideAs(op, (await taskOf(q, op)).id, { decision: 'APPROVED', checklist: ALL_TICKED })
    expect(await userStatus(q)).toBe('ACTIVE')
    const [x] = await pair(q)
    actAs(admin)
    await monitorAction(json('http://x', 'POST', { action: 'reopen' }), { params: { id: (await taskOf(q, x)).id } })
    expect(await userStatus(q)).toBe('PENDING_APPROVAL')
  })
})
