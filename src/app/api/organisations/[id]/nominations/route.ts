import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'
import { isPresidentOf, targetBodyFor, endSeat, userIdOfMember, SEATS_PER_UNIT } from '@/lib/organisations'

/**
 * F28 / F29 / F30 — the President of a unit nominates its members to the next
 * body up (local organisation → District body → State body → National body).
 * Exactly two open seats per unit: with none open, name two; with one, name
 * one. `replaceSeatId` ends that seat first (replacing a nominee ends the old seat).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const org = await prisma.organisation.findUnique({ where: { id: params.id } })
  if (!org || org.status !== 'ACTIVE') return NextResponse.json({ message: 'Organisation not found or not active' }, { status: 404 })
  if (!(await isPresidentOf(session, org.id))) return NextResponse.json({ message: 'Only the President nominates' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const ids: string[] = Array.isArray(body.memberIds) ? Array.from(new Set(body.memberIds.map(String))) : []
  const target = await targetBodyFor(org.id)
  if (!target) return NextResponse.json({ message: 'There is no body above this one, or its area is not set' }, { status: 400 })
  const actorId = session.user.id

  if (body.replaceSeatId) {
    const old = await prisma.bodySeat.findUnique({ where: { id: String(body.replaceSeatId) } })
    if (!old || old.fromOrganisationId !== org.id) return NextResponse.json({ message: 'Seat not found' }, { status: 404 })
    await endSeat(old.id, 'REPLACED', actorId)
  }

  const inUnit = await prisma.organisationMember.findMany({ where: { organisationId: org.id, memberId: { in: ids }, status: 'ACTIVE' }, select: { memberId: true } })
  const eligible = await prisma.member.findMany({
    where: { id: { in: inUnit.map((m) => m.memberId) }, deletedAt: null, status: 'ACTIVE', user: { status: 'ACTIVE' } }, select: { id: true },
  })
  if (!ids.length || eligible.length !== ids.length) return NextResponse.json({ message: 'Nominees must be active members of this organisation' }, { status: 400 })

  try {
    const seats = await prisma.$transaction(async (tx) => {
      // Serialise nominations for this unit so two Presidents' clicks cannot make three seats.
      await tx.$queryRaw`SELECT id FROM organisations WHERE id = ${org.id} FOR UPDATE`
      const open = await tx.bodySeat.findMany({ where: { fromOrganisationId: org.id, status: { in: ['NOMINATED', 'ACCEPTED', 'CONFIRMED'] } } })
      const need = SEATS_PER_UNIT - open.length
      if (need <= 0) throw new Error(`This unit already has ${SEATS_PER_UNIT} seats. Replace a nominee instead.`)
      if (ids.length !== need) throw new Error(`Nominate exactly ${need} member${need > 1 ? 's' : ''} (${SEATS_PER_UNIT} seats per unit)`)
      if (open.some((s) => ids.includes(s.memberId))) throw new Error('That member already holds a seat from this unit')
      const created = []
      for (const memberId of ids) {
        created.push(await tx.bodySeat.create({ data: { fromOrganisationId: org.id, toOrganisationId: target.id, memberId, nominatedBy: actorId } }))
      }
      await recordAudit({ actorId, action: 'body_seat.nominate', entityType: 'organisation', entityId: org.id, newValue: { toOrganisationId: target.id, memberIds: ids } }, req, tx)
      return created
    })
    for (const s of seats) {
      const userId = await userIdOfMember(s.memberId)
      if (userId) await notifyUser({ userId, type: 'BODY_SEAT', title: `You are nominated to the ${target.name}`, body: 'Accept or decline on the organisation page.', data: { seatId: s.id, organisationId: org.id } })
    }
    return NextResponse.json({ message: 'Nominated. The nominees must accept.', seatIds: seats.map((s) => s.id), body: { id: target.id, name: target.name } }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 400 })
  }
}
