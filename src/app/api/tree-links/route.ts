import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageFamily } from '@/lib/family-auth'
import { requireActiveAccount } from '@/lib/account-state'
import { recordAudit } from '@/lib/audit'
import { operatorCoversFamily } from '@/lib/family-rules'
import { conflictsBetween, completeResolution, alertTargetKarta, type Conflict } from '@/lib/tree-links'

const OPEN = ['PLACEHOLDER', 'PENDING', 'OPERATOR_REVIEW']

/** Limited, side-by-side view of the two people (no contact details). */
async function view(links: any[]) {
  const ids = Array.from(new Set(links.flatMap((l) => [l.fromMemberId, l.toMemberId]).filter(Boolean)))
  const fams = Array.from(new Set(links.flatMap((l) => [l.fromFamilyId, l.toFamilyId])))
  const [people, families] = await Promise.all([
    prisma.member.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, gender: true, dateOfBirth: true, status: true } }),
    prisma.family.findMany({ where: { id: { in: fams } }, select: { id: true, name: true } }),
  ])
  const p = (id: string | null) => {
    const m = people.find((x) => x.id === id)
    return m ? { ...m, dateOfBirth: m.dateOfBirth?.toISOString().slice(0, 10) ?? null, late: m.status === 'DECEASED' } : null
  }
  const f = (id: string) => families.find((x) => x.id === id) ?? { id, name: '' }
  return links.map((l) => ({
    id: l.id, status: l.status, conflicts: l.conflicts ?? [], proposedResolution: l.proposedResolution, resolution: l.resolution,
    note: l.note, reason: l.reason, createdAt: l.createdAt,
    from: { family: f(l.fromFamilyId), person: p(l.fromMemberId) },
    to: { family: f(l.toFamilyId), person: p(l.toMemberId) },
  }))
}

/**
 * GET ?familyId= — the Karta's link inbox (incoming), sent links and
 * placeholders (outgoing). Operators also get the links awaiting their
 * decision in their districts.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const roles = ((session.user as any).roles ?? []) as string[]
  const familyId = new URL(req.url).searchParams.get('familyId')

  let incoming: any[] = []
  let outgoing: any[] = []
  if (familyId) {
    if (!(await canManageFamily(session, familyId))) return NextResponse.json({ message: 'Only the Karta sees link requests' }, { status: 403 })
    incoming = await prisma.treeLinkRequest.findMany({ where: { toFamilyId: familyId, status: { in: ['PENDING', 'OPERATOR_REVIEW'] } }, orderBy: { createdAt: 'asc' } })
    outgoing = await prisma.treeLinkRequest.findMany({ where: { fromFamilyId: familyId, status: { in: OPEN } }, orderBy: { createdAt: 'asc' } })
  }
  let review: any[] = []
  if (roles.includes('OPERATOR') || roles.includes('ADMIN')) {
    const waiting = await prisma.treeLinkRequest.findMany({ where: { status: 'OPERATOR_REVIEW' }, orderBy: { createdAt: 'asc' }, take: 100 })
    for (const l of waiting) {
      if (await operatorCoversFamily(session.user.id, roles, l.fromFamilyId) || await operatorCoversFamily(session.user.id, roles, l.toFamilyId)) review.push(l)
    }
  }
  return NextResponse.json({ incoming: await view(incoming), outgoing: await view(outgoing), review: await view(review) })
}

/**
 * POST — the Karta of the family whose tree holds `fromMemberId` asks the
 * Karta of `toFamilyId` to link it to `toMemberId`. When fields conflict,
 * the requester proposes which side is right for each.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const notActive = await requireActiveAccount(session.user.id)
  if (notActive) return notActive
  const body = await req.json().catch(() => ({}))
  const { fromFamilyId, fromMemberId, toFamilyId, toMemberId } = body as Record<string, string>
  if (!fromFamilyId || !(await canManageFamily(session, fromFamilyId))) {
    return NextResponse.json({ message: "Only this family's Karta can link its tree to another family" }, { status: 403 })
  }
  if (!toFamilyId || toFamilyId === fromFamilyId) return NextResponse.json({ message: 'Choose another family' }, { status: 400 })
  const [fromM, toM] = await Promise.all([
    prisma.familyMember.findFirst({ where: { familyId: fromFamilyId, memberId: fromMemberId ?? '', leftAt: null }, include: { member: true } }),
    prisma.familyMember.findFirst({ where: { familyId: toFamilyId, memberId: toMemberId ?? '', leftAt: null }, include: { member: true } }),
  ])
  if (!fromM) return NextResponse.json({ message: 'Choose a person from your tree' }, { status: 400 })
  if (!toM) return NextResponse.json({ message: 'Choose the matching person in the other family' }, { status: 400 })
  if (fromM.memberId === toM.memberId) return NextResponse.json({ message: 'These are already the same person' }, { status: 409 })
  if (fromM.member.userId && toM.member.userId) {
    return NextResponse.json({ message: 'Both records have their own login. Ask an Admin to check them.' }, { status: 409 })
  }
  const open = await prisma.treeLinkRequest.findFirst({
    where: { status: { in: ['PENDING', 'OPERATOR_REVIEW'] }, OR: [{ fromMemberId: fromM.memberId }, { toMemberId: fromM.memberId }, { fromMemberId: toM.memberId }, { toMemberId: toM.memberId }] },
  })
  if (open) return NextResponse.json({ message: 'A link for one of these people is already waiting' }, { status: 409 })

  const conflicts: Conflict[] = conflictsBetween(fromM.member, toM.member)
  const proposed = completeResolution(conflicts, body.proposedResolution)
  if (!proposed) {
    return NextResponse.json({ message: 'The two records differ. Choose the correct value for each difference.', conflicts }, { status: 422 })
  }

  const actorId = session.user.id
  const placeholder = await prisma.treeLinkRequest.findFirst({
    where: { fromFamilyId, fromMemberId: fromM.memberId, toFamilyId, status: 'PLACEHOLDER' },
  })
  const data = {
    toMemberId: toM.memberId, status: 'PENDING', conflicts: conflicts as any, proposedResolution: proposed,
    note: body.note ? String(body.note) : null, requestedBy: actorId,
  }
  const link = placeholder
    ? await prisma.treeLinkRequest.update({ where: { id: placeholder.id }, data })
    : await prisma.treeLinkRequest.create({ data: { fromFamilyId, fromMemberId: fromM.memberId, toFamilyId, ...data } })
  await recordAudit({
    actorId, actorRole: 'KARTA', action: 'family.tree.link.request', entityType: 'tree_link_request', entityId: link.id,
    newValue: { fromFamilyId, fromMemberId: fromM.memberId, toFamilyId, toMemberId: toM.memberId, conflicts, proposed },
  }, req)
  await alertTargetKarta(link.id)
  return NextResponse.json({ message: 'Link request sent to the other Karta', linkId: link.id, conflicts }, { status: 201 })
}
