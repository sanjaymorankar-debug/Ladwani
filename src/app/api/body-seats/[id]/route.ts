import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'
import { isPresidentOf, bodyConfirmers, confirmSeat, endSeat, userIdOfMember } from '@/lib/organisations'

/**
 * F28–F30 decisions on a nomination:
 *   accept | decline  — the nominee
 *   confirm | reject  — the receiving body's President (or an Admin while it has none)
 *   end               — the nominating unit's President (or the seat holder resigning)
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const actorId = session.user.id
  const seat = await prisma.bodySeat.findUnique({ where: { id: params.id } })
  if (!seat) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const self = (session.user as any).memberId === seat.memberId
  const roles = ((session.user as any).roles ?? []) as string[]

  if (body.action === 'accept' || body.action === 'decline') {
    if (!self) return NextResponse.json({ message: 'Only the nominee answers' }, { status: 403 })
    if (seat.status !== 'NOMINATED') return NextResponse.json({ message: 'Already answered' }, { status: 409 })
    const status = body.action === 'accept' ? 'ACCEPTED' : 'DECLINED'
    await prisma.bodySeat.update({ where: { id: seat.id }, data: { status, acceptedAt: status === 'ACCEPTED' ? new Date() : null } })
    await recordAudit({ actorId, action: `body_seat.${body.action}`, entityType: 'body_seat', entityId: seat.id, oldValue: { status: 'NOMINATED' }, newValue: { status } }, req)
    const to = status === 'ACCEPTED' ? await bodyConfirmers(seat.toOrganisationId) : [seat.nominatedBy]
    const bodyName = (await prisma.organisation.findUnique({ where: { id: seat.toOrganisationId }, select: { name: true } }))?.name
    for (const userId of to) {
      await notifyUser({ userId, type: 'BODY_SEAT', title: status === 'ACCEPTED' ? `A nomination to the ${bodyName} needs confirming` : 'A nominee declined', body: status === 'ACCEPTED' ? 'Confirm or reject it on the body page.' : 'Nominate someone else.', data: { seatId: seat.id } })
    }
    return NextResponse.json({ message: status === 'ACCEPTED' ? 'Accepted. The body will confirm.' : 'Declined' })
  }

  if (body.action === 'confirm' || body.action === 'reject') {
    const confirmer = roles.includes('ADMIN') || (await isPresidentOf(session, seat.toOrganisationId))
    if (!confirmer) return NextResponse.json({ message: "Only the body's President or an Admin confirms" }, { status: 403 })
    if (seat.status !== 'ACCEPTED') return NextResponse.json({ message: 'The nominee has not accepted yet' }, { status: 409 })
    if (body.action === 'confirm') {
      await confirmSeat(seat.id, actorId)
      return NextResponse.json({ message: 'Seat confirmed' })
    }
    const reason = String(body.reason ?? '').trim()
    if (!reason) return NextResponse.json({ message: 'Give a reason' }, { status: 400 })
    await prisma.bodySeat.update({ where: { id: seat.id }, data: { status: 'REJECTED', endReason: reason, endedAt: new Date() } })
    await recordAudit({ actorId, action: 'body_seat.reject', entityType: 'body_seat', entityId: seat.id, oldValue: { status: 'ACCEPTED' }, newValue: { status: 'REJECTED', reason } }, req)
    for (const userId of [await userIdOfMember(seat.memberId), seat.nominatedBy]) {
      if (userId) await notifyUser({ userId, type: 'BODY_SEAT', title: 'Nomination not confirmed', body: reason, data: { seatId: seat.id } })
    }
    return NextResponse.json({ message: 'Nomination rejected' })
  }

  if (body.action === 'end') {
    if (!self && !(await isPresidentOf(session, seat.fromOrganisationId))) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    await endSeat(seat.id, self ? 'RESIGNED' : String(body.reason ?? 'ENDED'), actorId)
    return NextResponse.json({ message: 'Seat ended' })
  }
  return NextResponse.json({ message: 'Unknown action' }, { status: 400 })
}
