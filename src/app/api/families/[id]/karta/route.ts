import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFamilyAccess } from '@/lib/family-auth'
import { requiresApproval, createApprovalRecord, applyKartaChange } from '@/lib/approvals'

/**
 * Hands the Karta role to another member of the family (§28). Requested by the
 * current Karta (or staff); gated by ApprovalRule('family.karta.change'), whose
 * default approver is an Admin.
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

  if (!access.isStaff && (await requiresApproval('family.karta.change'))) {
    const pending = await prisma.approval.findFirst({
      where: { actionCode: 'family.karta.change', entityId: params.id, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
    })
    if (pending) return NextResponse.json({ message: 'A Karta change for this family is already awaiting review' }, { status: 409 })
    await prisma.$transaction((tx) =>
      createApprovalRecord(tx, {
        actionCode: 'family.karta.change', entityType: 'family', entityId: params.id,
        newValue: payload, submittedBy: actorId, reason: body.reason,
      })
    )
    return NextResponse.json({ message: 'Karta change submitted for Admin review.' }, { status: 202 })
  }

  await prisma.$transaction(async (tx) => {
    await applyKartaChange(tx, payload, actorId)
    await tx.auditLog.create({ data: { actorId, action: 'family.karta.change', entityType: 'family', entityId: params.id } })
  })
  return NextResponse.json({ message: 'Karta changed.' })
}
