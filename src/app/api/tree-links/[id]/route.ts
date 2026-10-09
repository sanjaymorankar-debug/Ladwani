import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageFamily } from '@/lib/family-auth'
import { recordAudit } from '@/lib/audit'
import { operatorCoversFamily } from '@/lib/family-rules'
import { applyLink, completeResolution, alertRequester, alertOperators, type Conflict } from '@/lib/tree-links'

/**
 * F22 decisions on one link:
 *   { action: 'accept', resolution } — target Karta. Same choices as the
 *        requester proposed → merged; different → goes to an Operator.
 *   { action: 'reject', reason }     — target Karta.
 *   { action: 'cancel' }             — requesting Karta (also drops a placeholder).
 *   { action: 'resolve', resolution } / { action: 'reject', reason } —
 *        Operator of either family's district (or Admin) once in OPERATOR_REVIEW.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const roles = ((session.user as any).roles ?? []) as string[]
  const actorId = session.user.id
  const link = await prisma.treeLinkRequest.findUnique({ where: { id: params.id } })
  if (!link) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const conflicts = (link.conflicts ?? []) as unknown as Conflict[]
  const audit = (action: string, newValue: object) => recordAudit({
    actorId, action: `family.tree.link.${action}`, entityType: 'tree_link_request', entityId: link.id,
    oldValue: { status: link.status }, newValue,
  }, req)

  if (body.action === 'cancel') {
    if (!['PLACEHOLDER', 'PENDING'].includes(link.status)) return NextResponse.json({ message: 'This link can no longer be cancelled' }, { status: 409 })
    if (!(await canManageFamily(session, link.fromFamilyId))) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    await prisma.treeLinkRequest.update({ where: { id: link.id }, data: { status: 'CANCELLED', decidedBy: actorId, decidedAt: new Date() } })
    await audit('cancel', { status: 'CANCELLED' })
    return NextResponse.json({ message: 'Link cancelled' })
  }

  if (link.status === 'PENDING' && (body.action === 'accept' || body.action === 'reject')) {
    if (!(await canManageFamily(session, link.toFamilyId))) {
      return NextResponse.json({ message: "Only the other family's Karta decides this link" }, { status: 403 })
    }
    if (body.action === 'reject') {
      const reason = String(body.reason ?? '').trim()
      if (!reason) return NextResponse.json({ message: 'Give a reason' }, { status: 400 })
      await prisma.treeLinkRequest.update({ where: { id: link.id }, data: { status: 'REJECTED', reason, decidedBy: actorId, decidedAt: new Date() } })
      await audit('reject', { status: 'REJECTED', reason })
      await alertRequester(link.id, 'rejected')
      return NextResponse.json({ message: 'Link rejected' })
    }
    const answer = completeResolution(conflicts, body.resolution ?? (conflicts.length ? undefined : {}))
    if (!answer) return NextResponse.json({ message: 'Choose the correct value for each difference', conflicts }, { status: 422 })
    const proposed = (link.proposedResolution ?? {}) as Record<string, string>
    const agreed = conflicts.every((c) => proposed[c.field] === answer[c.field])
    if (!agreed) {
      await prisma.treeLinkRequest.update({ where: { id: link.id }, data: { status: 'OPERATOR_REVIEW', resolution: answer } })
      await audit('escalate', { status: 'OPERATOR_REVIEW', targetChoice: answer, requesterChoice: proposed })
      await alertOperators(link.id)
      return NextResponse.json({ message: 'You and the other Karta chose differently. An Operator will decide.' }, { status: 202 })
    }
    const merged = await applyLink(link.id, answer, actorId, 'KARTA')
    await alertRequester(link.id, 'accepted')
    return NextResponse.json({ message: 'Linked. The person now appears in both trees.', ...merged })
  }

  if (link.status === 'OPERATOR_REVIEW' && (body.action === 'resolve' || body.action === 'reject')) {
    const covers = await operatorCoversFamily(actorId, roles, link.fromFamilyId) || await operatorCoversFamily(actorId, roles, link.toFamilyId)
    if (!covers) return NextResponse.json({ message: 'Only an Operator of either family\'s district decides this' }, { status: 403 })
    const role = roles.includes('ADMIN') ? 'ADMIN' : 'OPERATOR'
    if (body.action === 'reject') {
      const reason = String(body.reason ?? '').trim()
      if (!reason) return NextResponse.json({ message: 'Give a reason' }, { status: 400 })
      await prisma.treeLinkRequest.update({ where: { id: link.id }, data: { status: 'REJECTED', reason, decidedBy: actorId, decidedAt: new Date() } })
      await audit('reject', { status: 'REJECTED', reason, by: role })
      await alertRequester(link.id, 'rejected')
      return NextResponse.json({ message: 'Link rejected' })
    }
    const answer = completeResolution(conflicts, body.resolution)
    if (!answer) return NextResponse.json({ message: 'Choose the correct value for each difference', conflicts }, { status: 422 })
    const merged = await applyLink(link.id, answer, actorId, role)
    await alertRequester(link.id, 'accepted')
    return NextResponse.json({ message: 'Linked after review.', ...merged })
  }

  return NextResponse.json({ message: 'This action is not possible now' }, { status: 409 })
}
