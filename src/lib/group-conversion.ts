import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'
import { areaChain, chainLevel } from '@/lib/locations'
import { createRound, KIND } from '@/lib/verification'
import { OFFICES } from '@/lib/organisations'

/**
 * P4 follow-up (owner's decisions): copy each ACTIVE community group into a
 * local organisation. The group itself is left exactly as it is.
 *   - Convener → President, Secretary → Secretary, Treasurer → Chairman,
 *     everyone else → Member. A missing office stays vacant; an Admin or the
 *     organisation's President / Secretary fills it by hand-over.
 *   - Taluka: the group's own taluka, or the one above its village / town
 *     (which becomes the town). Groups placed at district level or higher, or
 *     with no place, are listed for the Admin instead.
 *   - Start date: the date the group was created.
 *   - Only registered members (active, with an active login) are carried over.
 *   - Each copy goes through the usual two-Operator check; members are
 *     invited and accept, as for a new organisation.
 */

const ROLE_TO_OFFICE: Record<string, (typeof OFFICES)[number]> = { CONVENER: 'PRESIDENT', SECRETARY: 'SECRETARY', TREASURER: 'CHAIRMAN' }

type Person = { memberId: string; userId: string | null; name: string }
export type GroupPlan = {
  groupId: string
  name: string
  status: 'READY' | 'NEEDS_TALUKA' | 'NO_MEMBERS' | 'CONVERTED'
  reason: string | null
  talukaAreaId: string | null
  taluka: string | null
  town: string | null
  startedOn: string
  offices: Record<string, Person | null>
  members: Person[]
  skipped: (Person & { reason: string })[]
  organisationId: string | null
}

export async function planGroupConversion(): Promise<{ groups: GroupPlan[]; notActive: number }> {
  const groups = await prisma.communityGroup.findMany({
    where: { status: 'ACTIVE', isActive: true, deletedAt: null },
    orderBy: { name: 'asc' },
    include: {
      members: {
        where: { leftAt: null }, orderBy: { joinedAt: 'asc' },
        include: { member: { select: { id: true, firstName: true, lastName: true, status: true, deletedAt: true, userId: true, user: { select: { status: true } } } } },
      },
    },
  })
  const notActive = await prisma.communityGroup.count({ where: { NOT: { id: { in: groups.map((g) => g.id) } } } })
  const copies = new Map((await prisma.organisation.findMany({ where: { sourceGroupId: { in: groups.map((g) => g.id) } }, select: { id: true, sourceGroupId: true } })).map((o) => [o.sourceGroupId!, o.id]))

  const plans: GroupPlan[] = []
  for (const g of groups) {
    const offices: Record<string, Person | null> = Object.fromEntries(OFFICES.map((o) => [o, null]))
    const members: Person[] = []
    const skipped: GroupPlan['skipped'] = []
    for (const row of g.members) {
      const m = row.member
      const person = { memberId: m.id, userId: m.userId, name: `${m.firstName} ${m.lastName ?? ''}`.trim() }
      if (m.deletedAt || m.status !== 'ACTIVE' || !m.userId || m.user?.status !== 'ACTIVE') {
        skipped.push({ ...person, reason: !m.userId ? 'No login (not a registered member)' : 'Not an active member' })
        continue
      }
      const office = ROLE_TO_OFFICE[row.roleInGroup]
      if (office && !offices[office]) offices[office] = person
      else members.push(person)
    }

    let talukaAreaId: string | null = null, taluka: string | null = null, town: string | null = null, reason: string | null = null
    const chain = g.areaId ? await areaChain(g.areaId) : []
    const t = chain.find((a) => a.type === 'TALUKA' || a.type === 'CITY')
    if (!g.areaId) reason = 'The group has no place set. Set it to its taluka, village or town, then convert again.'
    else if (!t || !chainLevel(chain, 'DISTRICT') || !chainLevel(chain, 'STATE')) reason = `The group is placed at ${chain[0]?.name ?? 'an unknown place'} (${chain[0]?.type ?? '?'}), above taluka level. Set it to its taluka, village or town, then convert again.`
    else { talukaAreaId = t.id; taluka = t.name; town = chain[0].name }

    const anyone = Object.values(offices).some(Boolean) || members.length > 0
    plans.push({
      groupId: g.id, name: g.name,
      status: copies.has(g.id) ? 'CONVERTED' : reason ? 'NEEDS_TALUKA' : anyone ? 'READY' : 'NO_MEMBERS',
      reason: copies.has(g.id) ? null : reason ?? (anyone ? null : 'No registered members on the roster'),
      talukaAreaId, taluka, town, startedOn: g.createdAt.toISOString().slice(0, 10),
      offices, members, skipped, organisationId: copies.get(g.id) ?? null,
    })
  }
  return { groups: plans, notActive }
}

/** Copies every READY group. Safe to run again: a group is copied once (organisations.sourceGroupId is unique). */
export async function applyGroupConversion(actorUserId: string, req?: Request) {
  const { groups } = await planGroupConversion()
  const created: { groupId: string; organisationId: string }[] = []
  for (const plan of groups.filter((p) => p.status === 'READY')) {
    const president = plan.offices.PRESIDENT
    // The convener is the applicant (and accepts at once, like naming oneself
    // on the form); with no convener, the Admin running this.
    const applicantUserId = president?.userId ?? actorUserId
    const subject = president ?? Object.values(plan.offices).find(Boolean) ?? plan.members[0]
    let orgId: string
    try {
      orgId = await prisma.$transaction(async (tx) => {
        const org = await tx.organisation.create({
          data: {
            kind: 'LOCAL', name: plan.name, areaId: plan.talukaAreaId, startedOn: new Date(plan.startedOn), town: plan.town,
            status: 'PENDING_APPROVAL', applicantUserId, sourceGroupId: plan.groupId,
            purpose: (await tx.communityGroup.findUnique({ where: { id: plan.groupId }, select: { description: true } }))?.description ?? null,
          },
        })
        for (const [office, p] of Object.entries(plan.offices)) {
          if (!p) continue
          const self = p.userId === applicantUserId
          await tx.organisationMember.create({ data: { organisationId: org.id, memberId: p.memberId, designation: office, status: self ? 'ACTIVE' : 'INVITED', invitedBy: actorUserId, joinedAt: self ? new Date() : null, termStart: self ? new Date() : null } })
        }
        for (const p of plan.members) {
          await tx.organisationMember.create({ data: { organisationId: org.id, memberId: p.memberId, status: 'INVITED', invitedBy: actorUserId } })
        }
        await recordAudit({
          actorId: actorUserId, action: 'organisation.convert_from_group', entityType: 'organisation', entityId: org.id,
          newValue: { groupId: plan.groupId, name: plan.name, taluka: plan.talukaAreaId, town: plan.town, startedOn: plan.startedOn },
          metadata: { vacant: Object.entries(plan.offices).filter(([, p]) => !p).map(([o]) => o), skipped: plan.skipped.map((s) => ({ memberId: s.memberId, reason: s.reason })) },
        }, req, tx)
        return org.id
      })
    } catch (e: any) {
      if (e?.code === 'P2002') continue // copied meanwhile by another run
      throw e
    }
    created.push({ groupId: plan.groupId, organisationId: orgId })
    for (const [office, p] of [...Object.entries(plan.offices), ...plan.members.map((m) => ['MEMBER', m] as const)]) {
      if (!p?.userId || p.userId === applicantUserId) continue
      await notifyUser({
        userId: p.userId, type: 'ORGANISATION_INVITE',
        title: office === 'MEMBER' ? `${plan.name} is becoming an organisation: you are named a member` : `${plan.name} is becoming an organisation: you are nominated ${office.toLowerCase()}`,
        body: 'Your community group is being registered as a local organisation. Accept or decline on the Organisations page.', data: { organisationId: orgId },
      })
    }
    await createRound({ kind: KIND.ORGANISATION, subjectUserId: applicantUserId, subjectMemberId: subject!.memberId, organisationId: orgId, round: 1 })
  }
  return created
}

/**
 * Removes the copies that are not ACTIVE yet (with their invitations and
 * verification tasks). An ACTIVE copy is kept: it is a real organisation
 * now, with seats on the District body, and is ended like any other.
 */
export async function undoGroupConversion(actorUserId: string, req?: Request) {
  const copies = await prisma.organisation.findMany({ where: { sourceGroupId: { not: null } }, select: { id: true, name: true, status: true, sourceGroupId: true } })
  const removed: string[] = []
  const kept: { id: string; name: string }[] = []
  for (const o of copies) {
    if (o.status === 'ACTIVE') { kept.push({ id: o.id, name: o.name }); continue }
    await prisma.$transaction(async (tx) => {
      await tx.approvalTask.deleteMany({ where: { organisationId: o.id } })
      await tx.organisationMember.deleteMany({ where: { organisationId: o.id } })
      await tx.organisation.delete({ where: { id: o.id } })
      await recordAudit({ actorId: actorUserId, action: 'organisation.convert_from_group.undo', entityType: 'organisation', entityId: o.id, oldValue: { name: o.name, status: o.status, groupId: o.sourceGroupId } }, req, tx)
    })
    removed.push(o.id)
  }
  return { removed, kept }
}
