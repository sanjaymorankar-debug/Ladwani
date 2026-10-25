import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'
import { requiresApproval, createApprovalRecord, applyKartaChange } from '@/lib/approvals'
import { closeKartaTransfer, operatorCoversFamily, kartaUserIdOf } from '@/lib/family-rules'
import { ageOn } from '@/lib/validators'

/**
 * F16 actions on one hand-over:
 *   { action: 'accept' | 'decline' } — the nominee (VOLUNTARY)
 *   { action: 'cancel' }             — the Karta who nominated (VOLUNTARY)
 *   { action: 'confirm', memberId? } — an Operator of the family's district or
 *                                      an Admin, for a vacant family (VACANCY);
 *                                      defaults to the suggested eldest adult.
 * The new Karta must be an ACTIVE adult account holder in the family.
 */
async function eligible(familyId: string, memberId: string) {
  const fm = await prisma.familyMember.findUnique({
    where: { familyId_memberId: { familyId, memberId } },
    include: { member: { select: { userId: true, status: true, dateOfBirth: true, user: { select: { status: true } } } } },
  })
  if (!fm || fm.leftAt) return 'That person is not an active member of this family'
  if (!fm.member.userId || fm.member.user?.status !== 'ACTIVE') return 'The new Karta must be an active, verified account holder'
  if (fm.member.status !== 'ACTIVE') return 'The new Karta must be living and active'
  if (!fm.member.dateOfBirth || ageOn(fm.member.dateOfBirth) < 18) return 'The new Karta must be an adult'
  return null
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const roles = ((session.user as any).roles ?? []) as string[]
  const memberId = (session.user as any).memberId as string | null
  const transfer = await prisma.kartaTransfer.findUnique({ where: { id: params.id } })
  if (!transfer) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const actorId = session.user.id

  if (transfer.kind === 'VOLUNTARY' && (body.action === 'accept' || body.action === 'decline')) {
    if (!memberId || transfer.toMemberId !== memberId) return NextResponse.json({ message: 'Only the nominee can answer' }, { status: 403 })
    if (transfer.status !== 'PENDING') return NextResponse.json({ message: 'This nomination is no longer open' }, { status: 409 })
    const requester = transfer.requestedBy
    if (body.action === 'decline') {
      await prisma.kartaTransfer.update({ where: { id: transfer.id }, data: { status: 'DECLINED', respondedAt: new Date() } })
      await recordAudit({ actorId, action: 'family.karta.decline', entityType: 'karta_transfer', entityId: transfer.id, oldValue: { status: 'PENDING' }, newValue: { status: 'DECLINED' } }, req)
      if (requester) await notifyUser({ userId: requester, type: 'KARTA_NOMINATION', title: 'Karta nomination declined', data: { transferId: transfer.id } })
      return NextResponse.json({ message: 'Nomination declined' })
    }
    const problem = await eligible(transfer.familyId, memberId)
    if (problem) return NextResponse.json({ message: problem }, { status: 400 })
    await prisma.kartaTransfer.update({ where: { id: transfer.id }, data: { status: 'ACCEPTED', respondedAt: new Date() } })
    await recordAudit({ actorId, action: 'family.karta.accept', entityType: 'karta_transfer', entityId: transfer.id, oldValue: { status: 'PENDING' }, newValue: { status: 'ACCEPTED' } }, req)
    const payload = { familyId: transfer.familyId, newKartaMemberId: memberId }
    if (await requiresApproval('family.karta.change')) {
      // §28 (existing): an Admin reviews the accepted hand-over.
      await prisma.$transaction((tx) => createApprovalRecord(tx, {
        actionCode: 'family.karta.change', entityType: 'family', entityId: transfer.familyId,
        newValue: payload, submittedBy: requester ?? actorId,
      }))
      if (requester) await notifyUser({ userId: requester, type: 'KARTA_NOMINATION', title: 'Karta nomination accepted — awaiting Admin review', data: { transferId: transfer.id } })
      return NextResponse.json({ message: 'Accepted. An Admin will confirm the hand-over.' }, { status: 202 })
    }
    await prisma.$transaction((tx) => applyKartaChange(tx, payload, actorId))
    await closeKartaTransfer(transfer.familyId, memberId, actorId)
    return NextResponse.json({ message: 'You are now the Karta' })
  }

  if (transfer.kind === 'VOLUNTARY' && body.action === 'cancel') {
    if (transfer.requestedBy !== actorId) return NextResponse.json({ message: 'Only the Karta who nominated can cancel' }, { status: 403 })
    if (transfer.status !== 'PENDING') return NextResponse.json({ message: 'This nomination is no longer open' }, { status: 409 })
    await prisma.kartaTransfer.update({ where: { id: transfer.id }, data: { status: 'CANCELLED' } })
    await recordAudit({ actorId, action: 'family.karta.cancel', entityType: 'karta_transfer', entityId: transfer.id, oldValue: { status: 'PENDING' }, newValue: { status: 'CANCELLED' } }, req)
    return NextResponse.json({ message: 'Nomination cancelled' })
  }

  if (transfer.kind === 'VACANCY' && body.action === 'confirm') {
    if (!(await operatorCoversFamily(actorId, roles, transfer.familyId))) {
      return NextResponse.json({ message: 'Only an Operator of this family\'s district or an Admin can confirm the new Karta' }, { status: 403 })
    }
    if (transfer.status !== 'PENDING') return NextResponse.json({ message: 'This vacancy has already been filled' }, { status: 409 })
    const newKarta = String(body.memberId ?? transfer.suggestedMemberId ?? '')
    if (!newKarta) return NextResponse.json({ message: 'Choose the new Karta' }, { status: 400 })
    const problem = await eligible(transfer.familyId, newKarta)
    if (problem) return NextResponse.json({ message: problem }, { status: 400 })
    await prisma.$transaction(async (tx) => {
      await applyKartaChange(tx, { familyId: transfer.familyId, newKartaMemberId: newKarta }, actorId)
      await recordAudit({
        actorId, actorRole: roles.includes('ADMIN') ? 'ADMIN' : 'OPERATOR', action: 'family.karta.confirm_vacancy',
        entityType: 'family', entityId: transfer.familyId,
        oldValue: { status: 'KARTA_VACANT', kartaMemberId: null }, newValue: { status: 'ACTIVE', kartaMemberId: newKarta },
        metadata: { transferId: transfer.id, suggestedMemberId: transfer.suggestedMemberId },
      }, req, tx)
    })
    await closeKartaTransfer(transfer.familyId, newKarta, actorId)
    const newKartaUser = await kartaUserIdOf(transfer.familyId)
    if (newKartaUser) await notifyUser({ userId: newKartaUser, type: 'KARTA_CHANGED', title: 'You are now the Karta of your family', also: ['SMS'] })
    return NextResponse.json({ message: 'New Karta confirmed' })
  }

  return NextResponse.json({ message: 'Unknown action' }, { status: 400 })
}
