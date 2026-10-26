import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFamilyAccess } from '@/lib/family-auth'
import { applyKartaChange } from '@/lib/approvals'
import { closeKartaTransfer } from '@/lib/family-rules'
import { notifyUser } from '@/lib/notify'
import { recordAudit } from '@/lib/audit'

/**
 * F16 voluntary hand-over. The current Karta nominates an adult, active,
 * account-holding member; that member must accept (POST
 * /api/karta-transfers/[id]); after acceptance the existing Admin review
 * (ApprovalRule family.karta.change, §28) applies when it is switched on. An
 * Admin acting here applies the change directly.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const access = await getFamilyAccess(session, params.id)
  if (!access.isKarta && !access.isStaff) {
    return NextResponse.json({ message: "Only this family's Karta can request a change of Karta" }, { status: 403 })
  }

  const body = await req.json()
  const newKartaMemberId = body.newKartaMemberId as string
  if (!newKartaMemberId) return NextResponse.json({ message: 'newKartaMemberId is required' }, { status: 400 })

  const target = await prisma.familyMember.findUnique({
    where: { familyId_memberId: { familyId: params.id, memberId: newKartaMemberId } },
    include: { member: { select: { userId: true, status: true, dateOfBirth: true } } },
  })
  if (!target || target.leftAt) return NextResponse.json({ message: 'That person is not an active member of this family' }, { status: 400 })
  if (target.isKarta) return NextResponse.json({ message: 'That member is already the Karta' }, { status: 400 })
  if (!target.member.userId) return NextResponse.json({ message: 'The new Karta needs their own login account — invite them first' }, { status: 400 })
  if (target.member.status !== 'ACTIVE') return NextResponse.json({ message: 'The new Karta must be an active member' }, { status: 400 })
  if (target.member.dateOfBirth) {
    const years = (Date.now() - target.member.dateOfBirth.getTime()) / (365.25 * 24 * 3600 * 1000)
    if (years < 18) return NextResponse.json({ message: 'The new Karta must be an adult' }, { status: 400 })
  }

  const actorId = session.user.id as string
  const payload = { familyId: params.id, newKartaMemberId }

  if (!access.isStaff) {
    const open = await prisma.kartaTransfer.findFirst({ where: { familyId: params.id, status: { in: ['PENDING', 'ACCEPTED'] } } })
    if (open) return NextResponse.json({ message: 'A Karta hand-over for this family is already in progress' }, { status: 409 })
    const transfer = await prisma.kartaTransfer.create({
      data: { familyId: params.id, kind: 'VOLUNTARY', fromMemberId: access.memberId ?? null, toMemberId: newKartaMemberId, requestedBy: actorId },
    })
    await recordAudit({
      actorId, actorRole: 'KARTA', action: 'family.karta.nominate', entityType: 'karta_transfer', entityId: transfer.id,
      newValue: { familyId: params.id, toMemberId: newKartaMemberId, status: 'PENDING' },
    }, req)
    await notifyUser({
      userId: target.member.userId, type: 'KARTA_NOMINATION', title: 'You have been asked to become Karta',
      body: 'The current Karta of your family has nominated you. Accept or decline from your notifications.',
      data: { familyId: params.id, transferId: transfer.id }, also: ['SMS'],
    })
    return NextResponse.json({ message: 'Nomination sent. The new Karta must accept it.', transferId: transfer.id }, { status: 202 })
  }

  await prisma.$transaction(async (tx) => {
    await applyKartaChange(tx, payload, actorId)
    await recordAudit({
      actorId, actorRole: 'ADMIN', action: 'family.karta.change', entityType: 'family', entityId: params.id,
      newValue: payload,
    }, req, tx)
  })
  await closeKartaTransfer(params.id, newKartaMemberId, actorId)
  return NextResponse.json({ message: 'Karta changed.' })
}
