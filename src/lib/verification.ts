import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { notifyUser } from '@/lib/notify'
import { recordAudit } from '@/lib/audit'
import { districtOf, areaChain, chainText } from '@/lib/locations'

/**
 * P1 dual blind approval (F04–F08).
 *
 *  F04  Two different Operators mapped to the subject's district get one task
 *       row each (slot 1 and slot 2), picked by lowest open workload, then
 *       least-recently assigned (round robin). Never the subject themself or
 *       anyone in a family the subject belongs to.
 *  F05  An Operator only ever reads and decides their own row. Decisions are
 *       final; only an Admin can reopen (which adds a new row for the slot).
 *  F06  When both live rows are decided: both approved → ACTIVE; any reject →
 *       REJECTED; otherwise any send-back → CORRECTION_REQUIRED. The reason
 *       shown to the user never names the operators. Overdue rows escalate.
 *  F07  Admin may reassign an undecided row or reopen a decided one.
 *  F08  Sensitive profile changes run through the same two-slot process.
 *
 * A "live" row is one with supersededAt = null; there is exactly one per slot.
 */
export const KIND = { REGISTRATION: 'REGISTRATION', PROFILE_CHANGE: 'PROFILE_CHANGE' } as const
export type TaskKind = (typeof KIND)[keyof typeof KIND]
export const DECISIONS = ['APPROVED', 'REJECTED', 'SENT_BACK'] as const
export type Decision = (typeof DECISIONS)[number]
export const UNDECIDED = ['OPEN', 'ESCALATED']
export const CHECKLIST_ITEMS = [
  { key: 'name', label: 'Name matches the ID proof' },
  { key: 'dob', label: 'Date of birth matches the ID proof' },
  { key: 'address', label: 'Address / Mul Gaon is plausible and matches' },
  { key: 'photo', label: 'Photo matches the person on the ID proof' },
] as const

/** F06: SLA in days — Setting `approval.sla_days`, default 7. */
export async function slaDays(): Promise<number> {
  const s = await prisma.setting.findUnique({ where: { key: 'approval.sla_days' } })
  const n = Number(typeof s?.value === 'string' ? JSON.parse(s.value) : s?.value)
  return Number.isFinite(n) && n > 0 ? n : 7
}
const dueFrom = async (from = new Date()) => new Date(from.getTime() + (await slaDays()) * 86400000)

/** The subject's Mul Gaon (primary member_areas row). */
export async function mulGaonOf(memberId: string) {
  const row = await prisma.memberArea.findFirst({ where: { memberId, isPrimary: true }, select: { areaId: true } })
  return row?.areaId ?? null
}

/** F04: the subject and every account holder in any family the subject belongs to. */
export async function conflictedUserIds(subjectUserId: string, subjectMemberId: string): Promise<Set<string>> {
  const families = await prisma.familyMember.findMany({
    where: { memberId: subjectMemberId, leftAt: null }, select: { familyId: true },
  })
  const relatives = families.length
    ? await prisma.familyMember.findMany({
        where: { familyId: { in: families.map((f) => f.familyId) }, leftAt: null },
        select: { member: { select: { userId: true } } },
      })
    : []
  const ids = new Set<string>([subjectUserId])
  for (const r of relatives) if (r.member.userId) ids.add(r.member.userId)
  return ids
}

/** F04: Operators mapped to the district, least busy first, then round robin. */
export async function eligibleOperators(districtId: string | null, exclude: Set<string>): Promise<string[]> {
  if (!districtId) return []
  const grants = await prisma.userRole.findMany({
    where: {
      areaId: districtId,
      role: { code: 'OPERATOR' },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      user: { status: 'ACTIVE', deletedAt: null },
    },
    select: { userId: true },
  })
  const ids = Array.from(new Set(grants.map((g) => g.userId))).filter((id) => !exclude.has(id))
  if (!ids.length) return []
  const [open, last] = await Promise.all([
    prisma.approvalTask.groupBy({
      by: ['operatorUserId'], where: { operatorUserId: { in: ids }, status: { in: UNDECIDED }, supersededAt: null },
      _count: { _all: true },
    }),
    prisma.approvalTask.groupBy({ by: ['operatorUserId'], where: { operatorUserId: { in: ids } }, _max: { createdAt: true } }),
  ])
  const openBy = new Map(open.map((o) => [o.operatorUserId, o._count._all]))
  const lastBy = new Map(last.map((l) => [l.operatorUserId, l._max.createdAt?.getTime() ?? 0]))
  return ids.sort((a, b) =>
    (openBy.get(a) ?? 0) - (openBy.get(b) ?? 0) || (lastBy.get(a) ?? 0) - (lastBy.get(b) ?? 0) || a.localeCompare(b))
}

async function adminUserIds() {
  const admins = await prisma.user.findMany({
    where: { status: 'ACTIVE', deletedAt: null, userRoles: { some: { role: { code: 'ADMIN' } } } }, select: { id: true },
  })
  return admins.map((a) => a.id)
}

async function districtTeamUserIds(districtId: string | null) {
  if (!districtId) return []
  const rows = await prisma.userRole.findMany({
    where: { areaId: districtId, role: { code: 'DISTRICT_TEAM' }, user: { status: 'ACTIVE', deletedAt: null } },
    select: { userId: true },
  })
  return Array.from(new Set(rows.map((r) => r.userId)))
}

const taskLabel = (kind: string) => (kind === KIND.REGISTRATION ? 'registration' : 'profile change')

async function alertOperator(operatorUserId: string, taskId: string, kind: string) {
  // The alert names the task only — never the other operator (F05).
  await notifyUser({
    userId: operatorUserId, type: 'APPROVAL_TASK',
    title: `New ${taskLabel(kind)} verification task`,
    body: 'A verification task is waiting in your queue.',
    data: { taskId }, also: ['EMAIL'],
  })
}

interface RoundKey {
  kind: TaskKind
  subjectUserId: string
  subjectMemberId: string
  changeRequestId?: string | null
  round: number
}

/** F04: open both slots of a round. `preferred` carries the previous round's operators (F06 "both tasks reopen"). */
export async function createRound(key: RoundKey, preferred: (string | null)[] = []) {
  const districtId = await districtOf(await mulGaonOf(key.subjectMemberId))
  const exclude = await conflictedUserIds(key.subjectUserId, key.subjectMemberId)
  const candidates = await eligibleOperators(districtId, exclude)
  const chosen: (string | null)[] = []
  for (const p of preferred) if (p && candidates.includes(p) && !chosen.includes(p) && chosen.length < 2) chosen.push(p)
  for (const c of candidates) if (chosen.length < 2 && !chosen.includes(c)) chosen.push(c)
  while (chosen.length < 2) chosen.push(null)

  const dueAt = await dueFrom()
  const tasks = await prisma.$transaction(chosen.map((operatorUserId, i) =>
    prisma.approvalTask.create({
      data: {
        kind: key.kind, subjectUserId: key.subjectUserId, subjectMemberId: key.subjectMemberId,
        changeRequestId: key.changeRequestId ?? null, round: key.round, slot: i + 1,
        operatorUserId, districtAreaId: districtId, dueAt,
      },
    })))

  for (const t of tasks) if (t.operatorUserId) await alertOperator(t.operatorUserId, t.id, t.kind)
  if (tasks.some((t) => !t.operatorUserId)) {
    for (const adminId of await adminUserIds()) {
      await notifyUser({
        userId: adminId, type: 'APPROVAL_TASK',
        title: `A ${taskLabel(key.kind)} needs an Operator`,
        body: 'Fewer than two eligible Operators are mapped to this district. Assign one from the Approval Monitor.',
        data: { subjectUserId: key.subjectUserId }, also: ['EMAIL'],
      })
    }
  }
  return tasks
}

export async function liveTasks(key: Omit<RoundKey, 'subjectMemberId'>) {
  return prisma.approvalTask.findMany({
    where: {
      kind: key.kind, subjectUserId: key.subjectUserId, round: key.round,
      changeRequestId: key.changeRequestId ?? null, supersededAt: null,
    },
    orderBy: { slot: 'asc' },
  })
}

export async function currentRound(kind: TaskKind, subjectUserId: string, changeRequestId: string | null = null) {
  const agg = await prisma.approvalTask.aggregate({
    where: { kind, subjectUserId, changeRequestId }, _max: { round: true },
  })
  return agg._max.round ?? 0
}

// ── F05: operator decision ───────────────────────────────────────

export type DecideResult =
  | { ok: true; outcome: string }
  | { ok: false; status: number; message: string }

export async function decideTask(
  taskId: string,
  operatorUserId: string,
  input: { decision: unknown; checklist?: unknown; remarks?: unknown },
  req?: Request
): Promise<DecideResult> {
  const task = await prisma.approvalTask.findUnique({ where: { id: taskId } })
  // Someone else's task reads exactly like a missing one.
  if (!task || task.operatorUserId !== operatorUserId) return { ok: false, status: 404, message: 'Task not found' }
  if (task.supersededAt || !UNDECIDED.includes(task.status)) {
    return { ok: false, status: 409, message: 'This task has already been decided. Only an Admin can reopen it.' }
  }
  if ((await conflictedUserIds(task.subjectUserId, task.subjectMemberId)).has(operatorUserId)) {
    return { ok: false, status: 403, message: 'You cannot verify your own record or a member of your own family.' }
  }

  const decision = String(input.decision ?? '') as Decision
  if (!DECISIONS.includes(decision)) return { ok: false, status: 400, message: 'Choose Approve, Reject or Send back' }
  const checklist = Object.fromEntries(CHECKLIST_ITEMS.map((c) => [c.key, !!(input.checklist as any)?.[c.key]]))
  const remarks = typeof input.remarks === 'string' ? input.remarks.trim() : ''
  if (decision === 'APPROVED' && !Object.values(checklist).every(Boolean)) {
    return { ok: false, status: 400, message: 'Tick every checklist item before approving' }
  }
  if (decision !== 'APPROVED' && remarks.length < 5) {
    return { ok: false, status: 400, message: 'Give the reason in the remarks (at least 5 characters)' }
  }

  // Conditional update: a double submit or a race with an Admin action loses.
  const done = await prisma.approvalTask.updateMany({
    where: { id: task.id, status: { in: UNDECIDED }, supersededAt: null },
    data: { status: decision, checklist, remarks: remarks || null, decidedAt: new Date() },
  })
  if (done.count !== 1) return { ok: false, status: 409, message: 'This task has already been decided.' }

  await recordAudit({
    actorId: operatorUserId, actorRole: 'OPERATOR', action: 'approval_task.decide',
    entityType: 'approval_task', entityId: task.id,
    oldValue: { status: task.status }, newValue: { status: decision, checklist, remarks: remarks || null },
    metadata: { kind: task.kind, subjectUserId: task.subjectUserId, round: task.round, slot: task.slot },
  }, req)

  return { ok: true, outcome: await evaluateOutcome(task) }
}

// ── F06: final outcome ───────────────────────────────────────────

export async function evaluateOutcome(task: {
  kind: string; subjectUserId: string; round: number; changeRequestId: string | null
}): Promise<string> {
  const live = await liveTasks({ kind: task.kind as TaskKind, subjectUserId: task.subjectUserId, round: task.round, changeRequestId: task.changeRequestId })
  if (live.length < 2 || live.some((t) => !DECISIONS.includes(t.status as Decision))) return 'PENDING'

  const outcome: Decision = live.some((t) => t.status === 'REJECTED') ? 'REJECTED'
    : live.some((t) => t.status === 'SENT_BACK') ? 'SENT_BACK' : 'APPROVED'
  // Combined reason, operator names withheld.
  const note = live.filter((t) => t.status !== 'APPROVED' && t.remarks).map((t) => `• ${t.remarks}`).join('\n') || null

  if (task.kind === KIND.REGISTRATION) {
    const status = outcome === 'APPROVED' ? 'ACTIVE' : outcome === 'REJECTED' ? 'REJECTED' : 'CORRECTION_REQUIRED'
    const moved = await prisma.user.updateMany({
      where: { id: task.subjectUserId, status: 'PENDING_APPROVAL' },
      data: { status, registrationDecidedAt: new Date(), registrationNote: note },
    })
    if (moved.count !== 1) return outcome
    await recordAudit({
      actorId: task.subjectUserId, action: 'registration.outcome', entityType: 'user', entityId: task.subjectUserId,
      oldValue: { status: 'PENDING_APPROVAL' }, newValue: { status }, metadata: { round: task.round },
    })
    const title = status === 'ACTIVE' ? 'Your LadWani registration is approved'
      : status === 'REJECTED' ? 'Your LadWani registration was not approved'
      : 'Your LadWani registration needs a correction'
    await notifyUser({
      userId: task.subjectUserId, type: 'REGISTRATION_RESULT', title,
      body: status === 'ACTIVE' ? 'Welcome! Your account is now active.' : `Reason:\n${note ?? 'See your verification page.'}`,
      data: { status }, also: ['EMAIL', 'SMS'],
    })
    return outcome
  }

  // PROFILE_CHANGE: approve applies the change; anything else rejects it.
  const request = task.changeRequestId
    ? await prisma.profileChangeRequest.findUnique({ where: { id: task.changeRequestId } })
    : null
  if (!request || request.status !== 'PENDING') return outcome
  if (outcome === 'APPROVED') {
    await applyProfileChange(request.id)
  } else {
    await prisma.profileChangeRequest.update({
      where: { id: request.id }, data: { status: 'REJECTED', reason: note, decidedAt: new Date() },
    })
    await prisma.idProof.updateMany({ where: { memberId: request.memberId, status: 'PENDING_CHANGE' }, data: { status: 'REJECTED' } })
    await recordAudit({
      actorId: request.userId, action: 'profile_change.rejected', entityType: 'member', entityId: request.memberId,
      oldValue: { status: 'PENDING' }, newValue: { status: 'REJECTED' }, metadata: { changeRequestId: request.id },
    })
  }
  await notifyUser({
    userId: request.userId, type: 'PROFILE_CHANGE_RESULT',
    title: outcome === 'APPROVED' ? 'Your profile change is approved' : 'Your profile change was not approved',
    body: outcome === 'APPROVED' ? 'The new details are now on your profile.' : `Reason:\n${note ?? '—'}`,
    data: { changeRequestId: request.id }, also: ['EMAIL'],
  })
  return outcome
}

// ── F06: SLA escalation (run from cron) ──────────────────────────

export async function escalateOverdueTasks(now = new Date()) {
  const overdue = await prisma.approvalTask.findMany({
    where: { status: 'OPEN', supersededAt: null, dueAt: { lt: now } },
  })
  let reassigned = 0
  for (const task of overdue) {
    const marked = await prisma.approvalTask.updateMany({ where: { id: task.id, status: 'OPEN' }, data: { status: 'ESCALATED' } })
    if (marked.count !== 1) continue

    const others = await liveTasks({ kind: task.kind as TaskKind, subjectUserId: task.subjectUserId, round: task.round, changeRequestId: task.changeRequestId })
    const exclude = await conflictedUserIds(task.subjectUserId, task.subjectMemberId)
    for (const t of others) if (t.operatorUserId) exclude.add(t.operatorUserId)
    const [replacement] = await eligibleOperators(task.districtAreaId, exclude)
    let newTaskId: string | null = null
    if (replacement) {
      const fresh = await prisma.$transaction(async (tx) => {
        await tx.approvalTask.update({ where: { id: task.id }, data: { supersededAt: now } })
        return tx.approvalTask.create({
          data: {
            kind: task.kind, subjectUserId: task.subjectUserId, subjectMemberId: task.subjectMemberId,
            changeRequestId: task.changeRequestId, round: task.round, slot: task.slot,
            operatorUserId: replacement, districtAreaId: task.districtAreaId, dueAt: await dueFrom(now),
          },
        })
      })
      newTaskId = fresh.id
      reassigned++
      await alertOperator(replacement, fresh.id, fresh.kind)
    }
    await recordAudit({
      actorId: task.subjectUserId, action: 'approval_task.escalate', entityType: 'approval_task', entityId: task.id,
      oldValue: { status: 'OPEN' }, newValue: { status: 'ESCALATED', reassignedTo: newTaskId ? 'another operator' : null },
      metadata: { newTaskId },
    })
    const recipients = new Set([...(await districtTeamUserIds(task.districtAreaId)), ...(await adminUserIds())])
    for (const userId of recipients) {
      await notifyUser({
        userId, type: 'APPROVAL_SLA',
        title: `A ${taskLabel(task.kind)} verification is past its SLA`,
        body: newTaskId ? 'It has been reassigned to another Operator.' : 'No other Operator is available — an Admin needs to reassign it.',
        data: { taskId: newTaskId ?? task.id }, also: ['EMAIL'],
      })
    }
  }
  return { escalated: overdue.length, reassigned }
}

// ── F07: Admin reassign / reopen ─────────────────────────────────

export async function reassignTask(taskId: string, newOperatorId: string, actorId: string, req?: Request): Promise<DecideResult> {
  const task = await prisma.approvalTask.findUnique({ where: { id: taskId } })
  if (!task || task.supersededAt) return { ok: false, status: 404, message: 'Task not found' }
  if (!UNDECIDED.includes(task.status)) return { ok: false, status: 409, message: 'A decided task is reopened, not reassigned' }

  const operator = await prisma.user.findFirst({
    where: { id: newOperatorId, status: 'ACTIVE', deletedAt: null, userRoles: { some: { role: { code: 'OPERATOR' } } } },
  })
  if (!operator) return { ok: false, status: 400, message: 'Choose an active Operator' }
  const others = await liveTasks({ kind: task.kind as TaskKind, subjectUserId: task.subjectUserId, round: task.round, changeRequestId: task.changeRequestId })
  if (others.some((t) => t.id !== task.id && t.operatorUserId === newOperatorId)) {
    return { ok: false, status: 400, message: 'The two tasks must go to two different Operators' }
  }
  if ((await conflictedUserIds(task.subjectUserId, task.subjectMemberId)).has(newOperatorId)) {
    return { ok: false, status: 400, message: 'That Operator is the subject or a member of their family' }
  }

  const fresh = await prisma.$transaction(async (tx) => {
    await tx.approvalTask.update({ where: { id: task.id }, data: { supersededAt: new Date(), status: 'REASSIGNED' } })
    return tx.approvalTask.create({
      data: {
        kind: task.kind, subjectUserId: task.subjectUserId, subjectMemberId: task.subjectMemberId,
        changeRequestId: task.changeRequestId, round: task.round, slot: task.slot,
        operatorUserId: newOperatorId, districtAreaId: task.districtAreaId, dueAt: await dueFrom(),
      },
    })
  })
  await recordAudit({
    actorId, actorRole: 'ADMIN', action: 'approval_task.reassign', entityType: 'approval_task', entityId: task.id,
    oldValue: { operatorUserId: task.operatorUserId, status: task.status },
    newValue: { operatorUserId: newOperatorId, status: 'OPEN' }, metadata: { newTaskId: fresh.id },
  }, req)
  await alertOperator(newOperatorId, fresh.id, fresh.kind)
  return { ok: true, outcome: 'REASSIGNED' }
}

export async function reopenTask(taskId: string, actorId: string, req?: Request): Promise<DecideResult> {
  const task = await prisma.approvalTask.findUnique({ where: { id: taskId } })
  if (!task || task.supersededAt) return { ok: false, status: 404, message: 'Task not found' }
  if (!DECISIONS.includes(task.status as Decision)) return { ok: false, status: 409, message: 'Only a decided task can be reopened' }
  if (task.kind === KIND.PROFILE_CHANGE && task.changeRequestId) {
    const cr = await prisma.profileChangeRequest.findUnique({ where: { id: task.changeRequestId } })
    if (cr?.status !== 'PENDING') return { ok: false, status: 409, message: 'That change has already been applied or rejected' }
  }
  if (task.kind === KIND.REGISTRATION) {
    const latest = await currentRound(KIND.REGISTRATION, task.subjectUserId)
    if (task.round !== latest) return { ok: false, status: 409, message: 'Only the latest round can be reopened' }
  }

  const fresh = await prisma.$transaction(async (tx) => {
    await tx.approvalTask.update({ where: { id: task.id }, data: { supersededAt: new Date() } })
    if (task.kind === KIND.REGISTRATION) {
      await tx.user.updateMany({
        where: { id: task.subjectUserId, status: { in: ['ACTIVE', 'REJECTED', 'CORRECTION_REQUIRED'] } },
        data: { status: 'PENDING_APPROVAL', registrationDecidedAt: null, registrationNote: null },
      })
    }
    return tx.approvalTask.create({
      data: {
        kind: task.kind, subjectUserId: task.subjectUserId, subjectMemberId: task.subjectMemberId,
        changeRequestId: task.changeRequestId, round: task.round, slot: task.slot,
        operatorUserId: task.operatorUserId, districtAreaId: task.districtAreaId, dueAt: await dueFrom(),
      },
    })
  })
  await recordAudit({
    actorId, actorRole: 'ADMIN', action: 'approval_task.reopen', entityType: 'approval_task', entityId: task.id,
    oldValue: { status: task.status }, newValue: { status: 'OPEN' }, metadata: { newTaskId: fresh.id },
  }, req)
  if (fresh.operatorUserId) await alertOperator(fresh.operatorUserId, fresh.id, fresh.kind)
  return { ok: true, outcome: 'REOPENED' }
}

// ── F08: sensitive profile changes ───────────────────────────────

/** Fields whose change needs the 2-operator approval once a user is ACTIVE. */
export const SENSITIVE_FIELDS = ['firstName', 'middleName', 'lastName', 'dateOfBirth', 'gender'] as const

export async function openChangeRequest(params: {
  userId: string; memberId: string; changes: Record<string, { old: unknown; new: unknown }>
}) {
  const pending = await prisma.profileChangeRequest.findFirst({ where: { memberId: params.memberId, status: 'PENDING' } })
  if (pending) return { ok: false as const, status: 409, message: 'A change to your verified details is already awaiting approval.' }
  const request = await prisma.profileChangeRequest.create({
    data: { userId: params.userId, memberId: params.memberId, changes: params.changes as Prisma.InputJsonValue },
  })
  await recordAudit({
    actorId: params.userId, action: 'profile_change.requested', entityType: 'member', entityId: params.memberId,
    oldValue: Object.fromEntries(Object.entries(params.changes).map(([k, v]) => [k, v.old])),
    newValue: Object.fromEntries(Object.entries(params.changes).map(([k, v]) => [k, v.new])),
    metadata: { changeRequestId: request.id },
  })
  await createRound({ kind: KIND.PROFILE_CHANGE, subjectUserId: params.userId, subjectMemberId: params.memberId, changeRequestId: request.id, round: 1 })
  return { ok: true as const, request }
}

/** Applies an approved change request: old values were live until now. */
export async function applyProfileChange(changeRequestId: string) {
  const request = await prisma.profileChangeRequest.findUniqueOrThrow({ where: { id: changeRequestId } })
  const changes = request.changes as Record<string, { old: unknown; new: any }>
  const memberData: Record<string, unknown> = {}
  for (const f of SENSITIVE_FIELDS) {
    if (changes[f]) memberData[f] = f === 'dateOfBirth' ? (changes[f].new ? new Date(changes[f].new) : null) : changes[f].new
  }
  await prisma.$transaction(async (tx) => {
    if (changes.mulGaonAreaId?.new) {
      const chain = await areaChain(String(changes.mulGaonAreaId.new))
      const text = chainText(chain)
      await tx.memberArea.deleteMany({ where: { memberId: request.memberId, isPrimary: true } })
      await tx.memberArea.upsert({
        where: { memberId_areaId: { memberId: request.memberId, areaId: chain[0].id } },
        update: { isPrimary: true },
        create: { memberId: request.memberId, areaId: chain[0].id, isPrimary: true },
      })
      Object.assign(memberData, { nativeVillage: text.village, nativeDistrict: text.district, nativeState: text.state })
    }
    if (changes.idProofId?.new) {
      await tx.idProof.updateMany({ where: { memberId: request.memberId, status: 'ACTIVE' }, data: { status: 'SUPERSEDED', supersededAt: new Date() } })
      await tx.idProof.update({ where: { id: String(changes.idProofId.new) }, data: { status: 'ACTIVE' } })
    }
    if (Object.keys(memberData).length) {
      await tx.member.update({ where: { id: request.memberId }, data: { ...memberData, updatedBy: request.userId } })
    }
    await tx.profileChangeRequest.update({ where: { id: request.id }, data: { status: 'APPROVED', decidedAt: new Date() } })
  })
  await recordAudit({
    actorId: request.userId, action: 'profile_change.applied', entityType: 'member', entityId: request.memberId,
    oldValue: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.old])),
    newValue: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.new])),
    metadata: { changeRequestId: request.id },
  })
}

// ── Who may see an ID proof (rule 7, F33) ────────────────────────

/** Owner, Admin, or an Operator holding an undecided live task for that person. */
export async function canViewIdProof(viewerUserId: string, proof: { userId: string }, viewerIsAdmin: boolean) {
  if (proof.userId === viewerUserId || viewerIsAdmin) return true
  const task = await prisma.approvalTask.findFirst({
    where: { operatorUserId: viewerUserId, subjectUserId: proof.userId, supersededAt: null, status: { in: UNDECIDED } },
    select: { id: true },
  })
  return !!task
}

/** Decision 3: an Operator may see a member's full profile only while holding an undecided task for them. */
export async function operatorHasOpenTaskFor(operatorUserId: string, subjectMemberId: string) {
  const task = await prisma.approvalTask.findFirst({
    where: { operatorUserId, subjectMemberId, supersededAt: null, status: { in: UNDECIDED } },
    select: { id: true },
  })
  return !!task
}
