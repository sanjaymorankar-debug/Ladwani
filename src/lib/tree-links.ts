import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'
import { mergePersons } from '@/lib/merge'
import { kartaUserIdOf, familyDistrict, districtResponders } from '@/lib/family-rules'

/**
 * F22 — "this person in our tree is that person in your tree". The target
 * Karta accepts or rejects. Fields that differ (name spelling, DOB, gender)
 * are shown side by side: the requester proposes which value is right, the
 * target Karta answers; if they agree the two records merge into one person
 * shown in both trees, otherwise an Operator of either family's district
 * decides.
 */
export const LINK_FIELDS = ['firstName', 'lastName', 'gender', 'dateOfBirth'] as const
export type LinkField = (typeof LINK_FIELDS)[number]
export type Side = 'from' | 'to'
export interface Conflict { field: LinkField; from: string | null; to: string | null }

const value = (m: Record<string, any>, f: LinkField) =>
  m[f] instanceof Date ? (m[f] as Date).toISOString().slice(0, 10) : m[f] ?? null

/** Both sides filled and different (a blank on one side is just filled in). */
export function conflictsBetween(a: Record<string, any>, b: Record<string, any>): Conflict[] {
  const out: Conflict[] = []
  for (const f of LINK_FIELDS) {
    const x = value(a, f)
    const y = value(b, f)
    if (x === null || y === null || x === 'NOT_STATED' || y === 'NOT_STATED') continue
    if (String(x).trim().toLowerCase() !== String(y).trim().toLowerCase()) out.push({ field: f, from: x, to: y })
  }
  return out
}

/** A choice of side for every conflicting field, or null if incomplete. */
export function completeResolution(conflicts: Conflict[], r: unknown): Record<string, Side> | null {
  if (!conflicts.length) return {}
  if (!r || typeof r !== 'object') return null
  const out: Record<string, Side> = {}
  for (const c of conflicts) {
    const side = (r as any)[c.field]
    if (side !== 'from' && side !== 'to') return null
    out[c.field] = side
  }
  return out
}

const personSelect = { id: true, firstName: true, lastName: true, gender: true, dateOfBirth: true, userId: true, status: true, deletedAt: true } as const

export async function linkPeopleOf(id: string) {
  const link = await prisma.treeLinkRequest.findUniqueOrThrow({ where: { id } })
  const [from, to] = await Promise.all([
    prisma.member.findUnique({ where: { id: link.fromMemberId }, select: personSelect }),
    link.toMemberId ? prisma.member.findUnique({ where: { id: link.toMemberId }, select: personSelect }) : null,
  ])
  return { link, from, to }
}

/** Merge the two records per the agreed resolution, mark the link ACCEPTED. */
export async function applyLink(id: string, resolution: Record<string, Side>, actorId: string, actorRole: string) {
  const { link, from, to } = await linkPeopleOf(id)
  if (!from || !to) throw new Error('Link is incomplete')
  // Keep the record with a login (one person = one record; the login is theirs); otherwise the target's.
  const keep = from.userId ? from : to
  const retire = keep.id === from.id ? to : from
  const values: Record<string, unknown> = {}
  for (const [field, side] of Object.entries(resolution)) values[field] = value(side === 'from' ? from : to, field as LinkField)

  await prisma.$transaction(async (tx) => {
    const merged = await mergePersons(tx, keep.id, retire.id, actorId, values)
    await tx.treeLinkRequest.update({
      where: { id }, data: { status: 'ACCEPTED', resolution, decidedBy: actorId, decidedAt: new Date() },
    })
    await recordAudit({
      actorId, actorRole, action: 'family.tree.link.merge', entityType: 'member', entityId: keep.id,
      oldValue: merged.old, newValue: { mergedFrom: retire.id, values },
      metadata: { linkId: id, fromFamilyId: link.fromFamilyId, toFamilyId: link.toFamilyId },
    }, undefined, tx)
  })
  return { memberId: keep.id }
}

export async function familyName(id: string) {
  return (await prisma.family.findUnique({ where: { id }, select: { name: true } }))?.name ?? ''
}

export async function alertTargetKarta(linkId: string) {
  const link = await prisma.treeLinkRequest.findUniqueOrThrow({ where: { id: linkId } })
  const karta = await kartaUserIdOf(link.toFamilyId)
  if (!karta) return
  await notifyUser({
    userId: karta, type: 'TREE_LINK_REQUEST', title: `Link request from the ${await familyName(link.fromFamilyId)} family`,
    body: 'They say a person in their tree is the same person as one in yours. Review it in your family requests.',
    data: { linkId, familyId: link.toFamilyId },
  })
}

export async function alertRequester(linkId: string, outcome: string) {
  const link = await prisma.treeLinkRequest.findUniqueOrThrow({ where: { id: linkId } })
  await notifyUser({
    userId: link.requestedBy, type: 'TREE_LINK_RESULT', title: `Tree link ${outcome}`,
    body: `Your link to the ${await familyName(link.toFamilyId)} family was ${outcome}.${link.reason ? ` Reason: ${link.reason}` : ''}`,
    data: { linkId, familyId: link.fromFamilyId },
  })
}

/** The two Kartas disagree on a conflicting field: Operators of both districts (and Admins) are told. */
export async function alertOperators(linkId: string) {
  const link = await prisma.treeLinkRequest.findUniqueOrThrow({ where: { id: linkId } })
  const ids = new Set<string>()
  for (const f of [link.fromFamilyId, link.toFamilyId]) for (const u of await districtResponders(await familyDistrict(f))) ids.add(u)
  for (const userId of Array.from(ids)) {
    await notifyUser({
      userId, type: 'TREE_LINK_REVIEW', title: 'Tree link needs a decision',
      body: `The ${await familyName(link.fromFamilyId)} and ${await familyName(link.toFamilyId)} Kartas disagree about a person's details.`,
      data: { linkId },
    })
  }
}
