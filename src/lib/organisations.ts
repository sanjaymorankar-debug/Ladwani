import { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'
import { areaChain, chainLevel } from '@/lib/locations'

/**
 * P4 — social organisations and the LadWani bodies.
 *   LOCAL organisation ─2 seats→ DISTRICT_BODY ─2→ STATE_BODY ─2→ NATIONAL_BODY
 * Every unit has exactly one President, Secretary and Treasurer (database
 * guard on organisation_members) plus Members. A seat on a body gives the
 * matching data-view role (F30); ending a seat ends every seat above that
 * came from it and removes those roles (F31).
 */
export const OFFICES = ['PRESIDENT', 'SECRETARY', 'TREASURER'] as const
export const DESIGNATIONS = [...OFFICES, 'MEMBER'] as const
export type Designation = (typeof DESIGNATIONS)[number]
export const SEATS_PER_UNIT = 2
const OPEN_SEAT = ['NOMINATED', 'ACCEPTED', 'CONFIRMED']

export const NEXT_BODY: Record<string, string> = { LOCAL: 'DISTRICT_BODY', DISTRICT_BODY: 'STATE_BODY', STATE_BODY: 'NATIONAL_BODY' }
const BODY_ROLE: Record<string, string> = { DISTRICT_BODY: 'DISTRICT_TEAM', STATE_BODY: 'STATE_TEAM', NATIONAL_BODY: 'NATIONAL_TEAM' }
const BODY_AREA: Record<string, string> = { DISTRICT_BODY: 'DISTRICT', STATE_BODY: 'STATE', NATIONAL_BODY: 'COUNTRY' }
const LABEL: Record<string, string> = { DISTRICT_BODY: 'District', STATE_BODY: 'State', NATIONAL_BODY: 'National' }

const memberIdOf = (session: Session | null) => ((session?.user as any)?.memberId ?? null) as string | null
const rolesOf = (session: Session | null) => ((session?.user as any)?.roles ?? []) as string[]

export async function activeMembership(organisationId: string, memberId: string | null) {
  if (!memberId) return null
  const m = await prisma.organisationMember.findUnique({ where: { organisationId_memberId: { organisationId, memberId } } })
  return m && m.status === 'ACTIVE' ? m : null
}

/** F27: President or Secretary of this unit (or an Admin). */
export async function canManageOrganisation(session: Session | null, organisationId: string) {
  if (rolesOf(session).includes('ADMIN')) return true
  const m = await activeMembership(organisationId, memberIdOf(session))
  return !!m && (m.designation === 'PRESIDENT' || m.designation === 'SECRETARY')
}

/** F28–F30: the President of this unit (or an Admin) nominates and confirms. */
export async function isPresidentOf(session: Session | null, organisationId: string) {
  if (rolesOf(session).includes('ADMIN')) return true
  return (await activeMembership(organisationId, memberIdOf(session)))?.designation === 'PRESIDENT'
}

export async function userIdOfMember(memberId: string) {
  return (await prisma.member.findUnique({ where: { id: memberId }, select: { userId: true } }))?.userId ?? null
}

async function officeUserIds(organisationId: string, offices: string[] = ['PRESIDENT', 'SECRETARY']) {
  const rows = await prisma.organisationMember.findMany({ where: { organisationId, status: 'ACTIVE', designation: { in: offices } }, select: { memberId: true } })
  const users = await prisma.member.findMany({ where: { id: { in: rows.map((r) => r.memberId) }, userId: { not: null } }, select: { userId: true } })
  return users.map((u) => u.userId!)
}

async function adminUserIds() {
  return (await prisma.user.findMany({ where: { status: 'ACTIVE', deletedAt: null, userRoles: { some: { role: { code: 'ADMIN' } } } }, select: { id: true } })).map((u) => u.id)
}

async function tell(userIds: (string | null)[], type: string, title: string, body: string, data: Record<string, unknown>) {
  for (const userId of Array.from(new Set(userIds.filter(Boolean) as string[]))) await notifyUser({ userId, type, title, body, data })
}

// ── F26: registration outcome and activation ────────────────────

/** Called by the two-operator round (verification.ts) when both have decided. */
export async function organisationOutcome(organisationId: string, outcome: string, note: string | null, round: number) {
  const org = await prisma.organisation.findUnique({ where: { id: organisationId } })
  if (!org || org.status !== 'PENDING_APPROVAL') return
  if (outcome === 'APPROVED') {
    await prisma.organisation.update({ where: { id: org.id }, data: { approvedAt: new Date(), decisionNote: null } })
    await recordAudit({ actorId: org.applicantUserId!, action: 'organisation.approved', entityType: 'organisation', entityId: org.id, oldValue: { approvedAt: null }, newValue: { approvedAt: new Date() }, metadata: { round } })
    if (!(await maybeActivate(org.id))) {
      await tell([org.applicantUserId], 'ORGANISATION_RESULT', `${org.name} is approved`, 'It becomes active once the President, Secretary and Treasurer have all accepted.', { organisationId: org.id })
    }
    return
  }
  const status = outcome === 'REJECTED' ? 'REJECTED' : 'CORRECTION_REQUIRED'
  await prisma.organisation.update({ where: { id: org.id }, data: { status, decisionNote: note } })
  await recordAudit({ actorId: org.applicantUserId!, action: 'organisation.outcome', entityType: 'organisation', entityId: org.id, oldValue: { status: org.status }, newValue: { status }, metadata: { round } })
  await tell([org.applicantUserId], 'ORGANISATION_RESULT',
    status === 'REJECTED' ? `${org.name} was not approved` : `${org.name} needs a correction`,
    `Reason:\n${note ?? '—'}`, { organisationId: org.id, status })
}

/** ACTIVE once both operators approved and all three office bearers accepted. */
export async function maybeActivate(organisationId: string) {
  const org = await prisma.organisation.findUnique({ where: { id: organisationId } })
  if (!org || org.status !== 'PENDING_APPROVAL' || !org.approvedAt) return false
  const offices = await prisma.organisationMember.count({ where: { organisationId, status: 'ACTIVE', designation: { in: [...OFFICES] } } })
  if (offices < OFFICES.length) return false
  const moved = await prisma.organisation.updateMany({ where: { id: organisationId, status: 'PENDING_APPROVAL' }, data: { status: 'ACTIVE' } })
  if (moved.count !== 1) return false
  await recordAudit({ actorId: org.applicantUserId!, action: 'organisation.activate', entityType: 'organisation', entityId: org.id, oldValue: { status: 'PENDING_APPROVAL' }, newValue: { status: 'ACTIVE' } })
  await tell([org.applicantUserId, ...(await officeUserIds(org.id, [...OFFICES]))], 'ORGANISATION_RESULT', `${org.name} is now active`, 'Your organisation is registered and active.', { organisationId: org.id })
  return true
}

// ── F28–F30: the body chain ─────────────────────────────────────

/** The body the unit nominates to, created on first use (one per area). */
export async function targetBodyFor(organisationId: string) {
  const org = await prisma.organisation.findUniqueOrThrow({ where: { id: organisationId } })
  const kind = NEXT_BODY[org.kind]
  if (!kind || !org.areaId) return null
  const area = chainLevel(await areaChain(org.areaId), BODY_AREA[kind])
  if (!area) return null
  const bodyKey = `${kind}:${area.id}`
  return prisma.organisation.upsert({
    where: { bodyKey },
    update: {},
    create: { kind, bodyKey, areaId: area.id, name: `LadWani ${LABEL[kind]} Body — ${area.name}`, status: 'ACTIVE', approvedAt: new Date() },
  })
}

/** Who confirms a seat on a body: its President, or the Admins while it has none. */
export async function bodyConfirmers(bodyId: string) {
  const presidents = await officeUserIds(bodyId, ['PRESIDENT'])
  return presidents.length ? presidents : adminUserIds()
}

/** F28 step 4 / F30: the nominee joins the body and gets the matching data-view role. */
export async function confirmSeat(seatId: string, actorId: string) {
  const seat = await prisma.bodySeat.findUniqueOrThrow({ where: { id: seatId } })
  const body = await prisma.organisation.findUniqueOrThrow({ where: { id: seat.toOrganisationId } })
  const userId = await userIdOfMember(seat.memberId)
  const roleCode = BODY_ROLE[body.kind]
  const role = roleCode ? await prisma.role.findUnique({ where: { code: roleCode } }) : null
  await prisma.$transaction(async (tx) => {
    await tx.bodySeat.update({ where: { id: seat.id }, data: { status: 'CONFIRMED', confirmedBy: actorId, confirmedAt: new Date() } })
    const existing = await tx.organisationMember.findUnique({ where: { organisationId_memberId: { organisationId: body.id, memberId: seat.memberId } } })
    const data = { status: 'ACTIVE', designation: 'MEMBER', seatId: seat.id, joinedAt: new Date(), endedAt: null, endReason: null, pendingDesignation: null }
    if (existing) await tx.organisationMember.update({ where: { id: existing.id }, data })
    else await tx.organisationMember.create({ data: { organisationId: body.id, memberId: seat.memberId, invitedBy: actorId, ...data } })
    if (role && userId) {
      await tx.userRole.create({
        data: { userId, roleId: role.id, areaId: body.kind === 'NATIONAL_BODY' ? null : body.areaId, grantedBy: actorId, bodySeatId: seat.id },
      })
    }
    await recordAudit({
      actorId, action: 'body_seat.confirm', entityType: 'body_seat', entityId: seat.id,
      oldValue: { status: seat.status }, newValue: { status: 'CONFIRMED', bodyId: body.id, role: roleCode ?? null },
    }, undefined, tx)
  })
  await tell([userId, ...(await officeUserIds(seat.fromOrganisationId, ['PRESIDENT']))], 'BODY_SEAT', `Seat confirmed on the ${body.name}`, 'The nomination is confirmed.', { seatId: seat.id, bodyId: body.id })
}

// ── F31: vacancies ──────────────────────────────────────────────

/**
 * Ends a seat, the body membership it gave, the data-view role, and — up the
 * chain — every seat that came from that body membership. The nominating
 * unit is told the seat is vacant.
 */
export async function endSeat(seatId: string, reason: string, actorId: string, depth = 0): Promise<void> {
  const seat = await prisma.bodySeat.findUnique({ where: { id: seatId } })
  if (!seat || !OPEN_SEAT.includes(seat.status) || depth > 5) return
  const heldPosts = await prisma.organisationMember.findMany({ where: { seatId: seat.id, status: 'ACTIVE', designation: { in: [...OFFICES] } } })
  await prisma.$transaction(async (tx) => {
    await tx.bodySeat.update({ where: { id: seat.id }, data: { status: 'ENDED', endedAt: new Date(), endReason: reason } })
    await tx.organisationMember.updateMany({
      where: { seatId: seat.id, status: 'ACTIVE' },
      data: { status: 'ENDED', endedAt: new Date(), endReason: `SEAT_ENDED: ${reason}`, pendingDesignation: null },
    })
    await tx.userRole.deleteMany({ where: { bodySeatId: seat.id } })
    await recordAudit({ actorId, action: 'body_seat.end', entityType: 'body_seat', entityId: seat.id, oldValue: { status: seat.status }, newValue: { status: 'ENDED', reason } }, undefined, tx)
  })
  for (const p of heldPosts) await alertOfficeVacant(p.organisationId, p.designation)
  // Seats above that came from this body membership.
  const above = await prisma.bodySeat.findMany({ where: { fromOrganisationId: seat.toOrganisationId, memberId: seat.memberId, status: { in: OPEN_SEAT } } })
  for (const a of above) await endSeat(a.id, `Lower seat ended (${reason})`, actorId, depth + 1)
  if (seat.status === 'CONFIRMED' || seat.status === 'ACCEPTED') {
    const body = await prisma.organisation.findUnique({ where: { id: seat.toOrganisationId }, select: { name: true } })
    await tell(await officeUserIds(seat.fromOrganisationId), 'BODY_SEAT_VACANT', `A seat on the ${body?.name ?? 'body'} is vacant`, 'Nominate a replacement.', { seatId: seat.id, organisationId: seat.fromOrganisationId })
  }
}

/** A person leaves a unit (resigned, removed, expired): their seats from it end too. */
export async function endMembership(organisationId: string, memberId: string, reason: string, actorId: string) {
  const m = await prisma.organisationMember.findUnique({ where: { organisationId_memberId: { organisationId, memberId } } })
  if (!m || m.status === 'ENDED') return
  await prisma.organisationMember.update({ where: { id: m.id }, data: { status: 'ENDED', endedAt: new Date(), endReason: reason, pendingDesignation: null } })
  await recordAudit({ actorId, action: 'organisation.member.end', entityType: 'organisation_member', entityId: m.id, oldValue: { status: m.status, designation: m.designation }, newValue: { status: 'ENDED', reason } })
  if (m.seatId) await endSeat(m.seatId, reason, actorId)
  for (const s of await prisma.bodySeat.findMany({ where: { fromOrganisationId: organisationId, memberId, status: { in: OPEN_SEAT } } })) {
    await endSeat(s.id, reason, actorId)
  }
  if (m.status === 'ACTIVE' && (OFFICES as readonly string[]).includes(m.designation)) await alertOfficeVacant(organisationId, m.designation)
}

async function alertOfficeVacant(organisationId: string, designation: string) {
  const org = await prisma.organisation.findUnique({ where: { id: organisationId }, select: { name: true } })
  await tell([...(await officeUserIds(organisationId, [...OFFICES])), ...(await adminUserIds())], 'OFFICE_VACANT',
    `${org?.name ?? 'An organisation'}: the ${designation.toLowerCase()} post is vacant`, 'Appoint a new office bearer.', { organisationId })
}

/** F12 → F31: an expired person leaves every unit and seat. */
export async function onMemberExpired(memberId: string, actorId: string) {
  for (const m of await prisma.organisationMember.findMany({ where: { memberId, status: { in: ['ACTIVE', 'INVITED', 'REQUESTED'] } } })) {
    await endMembership(m.organisationId, memberId, 'EXPIRED', actorId)
  }
  for (const s of await prisma.bodySeat.findMany({ where: { memberId, status: { in: OPEN_SEAT } } })) await endSeat(s.id, 'EXPIRED', actorId)
}

/** F31 daily job: an office bearer whose term has ended steps down; the post is flagged vacant. */
export async function runOrganisationJobs(now = new Date()) {
  const expired = await prisma.organisationMember.findMany({
    where: { status: 'ACTIVE', designation: { in: [...OFFICES] }, termEnd: { lt: now } },
  })
  for (const m of expired) {
    const moved = await prisma.organisationMember.updateMany({ where: { id: m.id, designation: m.designation }, data: { designation: 'MEMBER', termEnd: null, termStart: null } })
    if (moved.count !== 1) continue
    // Audit convention for scheduled changes: the subject is recorded as actor, the job in metadata.
    const subject = await userIdOfMember(m.memberId)
    if (subject) await recordAudit({ actorId: subject, action: 'organisation.term_end', entityType: 'organisation_member', entityId: m.id, oldValue: { designation: m.designation, termEnd: m.termEnd }, newValue: { designation: 'MEMBER' }, metadata: { by: 'daily-cron' } })
    const org = await prisma.organisation.findUnique({ where: { id: m.organisationId }, select: { name: true } })
    await tell([...(await officeUserIds(m.organisationId, [...OFFICES])), await userIdOfMember(m.memberId), ...(await adminUserIds())], 'OFFICE_VACANT',
      `${org?.name ?? 'An organisation'}: the ${m.designation.toLowerCase()}'s term has ended`, 'The post is vacant. Appoint a new office bearer.', { organisationId: m.organisationId })
  }
  return { officeTermsEnded: expired.length }
}
