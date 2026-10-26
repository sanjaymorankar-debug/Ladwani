import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMemberAccess } from '@/lib/member-auth'
import { validateSettlement, chainText } from '@/lib/locations'
import { mulGaonOf, openChangeRequest } from '@/lib/verification'
import { recordAudit } from '@/lib/audit'

/**
 * F02 / F08 — Mul Gaon (native village), from the location master. It decides
 * which district verifies the member and which teams see them, so it is a
 * sensitive field: once the account is ACTIVE a change goes to two operators;
 * while under review it is locked; before submission it saves directly.
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const place = await validateSettlement(body.areaId)
  if ('error' in place) return NextResponse.json({ message: place.error }, { status: 400 })
  const member = await prisma.member.findUniqueOrThrow({ where: { id: params.id }, include: { user: { select: { id: true, status: true } } } })
  const current = await mulGaonOf(member.id)
  if (current === place.chain[0].id) return NextResponse.json({ message: 'Unchanged' })

  const actorId = session!.user!.id as string
  const status = member.user?.status
  if (access.isOwn && !access.isStaff && status === 'PENDING_APPROVAL') {
    return NextResponse.json({ message: 'Your Mul Gaon is locked while the operators verify your registration.' }, { status: 409 })
  }
  if (access.isOwn && !access.isStaff && status === 'ACTIVE') {
    const opened = await openChangeRequest({
      userId: member.user!.id, memberId: member.id,
      changes: { mulGaonAreaId: { old: current, new: place.chain[0].id } },
    })
    if (!opened.ok) return NextResponse.json({ message: opened.message }, { status: opened.status })
    return NextResponse.json({ message: 'Your Mul Gaon change is waiting for operator approval.', pendingChange: true }, { status: 202 })
  }

  const text = chainText(place.chain)
  await prisma.$transaction(async (tx) => {
    await tx.memberArea.deleteMany({ where: { memberId: member.id, isPrimary: true } })
    await tx.memberArea.upsert({
      where: { memberId_areaId: { memberId: member.id, areaId: place.chain[0].id } },
      update: { isPrimary: true }, create: { memberId: member.id, areaId: place.chain[0].id, isPrimary: true },
    })
    await tx.member.update({
      where: { id: member.id },
      data: { nativeVillage: text.village, nativeDistrict: text.district, nativeState: text.state, updatedBy: actorId },
    })
  })
  await recordAudit({
    actorId, action: 'member.mul_gaon.update', entityType: 'member', entityId: member.id,
    oldValue: { mulGaonAreaId: current }, newValue: { mulGaonAreaId: place.chain[0].id },
  }, req)
  return NextResponse.json({ message: 'Mul Gaon saved' })
}
