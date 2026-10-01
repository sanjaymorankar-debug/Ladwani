import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMemberAccess } from '@/lib/member-auth'
import { requiresApproval, createApprovalRecord, applyMarkDeceased } from '@/lib/approvals'

/**
 * Marks a member as deceased (§28). Gated by ApprovalRule('member.mark_deceased')
 * — the change is irreversible in effect (login deactivated, matrimony
 * withdrawn, spouse widowed), so it is reviewed unless staff do it directly.
 * Nobody may mark themselves.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  if (access.isOwn) return NextResponse.json({ message: 'You cannot mark your own profile as deceased' }, { status: 400 })

  const member = await prisma.member.findUnique({ where: { id: params.id }, select: { status: true, dateOfBirth: true } })
  if (member?.status === 'DECEASED') return NextResponse.json({ message: 'Already marked as deceased' }, { status: 409 })

  const body = await req.json()
  const when = new Date(body.deceasedAt)
  if (!body.deceasedAt || isNaN(when.getTime())) {
    return NextResponse.json({ message: 'Date of death is required' }, { status: 400 })
  }
  if (when.getTime() > Date.now()) return NextResponse.json({ message: 'Date of death cannot be in the future' }, { status: 400 })
  if (member?.dateOfBirth && when < member.dateOfBirth) {
    return NextResponse.json({ message: 'Date of death cannot be before date of birth' }, { status: 400 })
  }

  const actorId = session!.user!.id as string
  const payload = {
    deceasedAt: when.toISOString(),
    deceasedPlace: body.deceasedPlace || null,
    deceasedNotes: body.deceasedNotes || null,
  }

  if (!access.isStaff && (await requiresApproval('member.mark_deceased'))) {
    const pending = await prisma.approval.findFirst({
      where: { actionCode: 'member.mark_deceased', entityId: params.id, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
    })
    if (pending) return NextResponse.json({ message: 'A request for this member is already awaiting review' }, { status: 409 })
    await prisma.$transaction((tx) =>
      createApprovalRecord(tx, {
        actionCode: 'member.mark_deceased', entityType: 'member', entityId: params.id,
        newValue: payload, submittedBy: actorId, reason: body.reason,
      })
    )
    return NextResponse.json({ message: 'Submitted for review. The profile will be updated once approved.' }, { status: 202 })
  }

  await prisma.$transaction(async (tx) => {
    await applyMarkDeceased(tx, params.id, payload, actorId)
    await tx.auditLog.create({ data: { actorId, action: 'member.mark_deceased', entityType: 'member', entityId: params.id } })
  })
  return NextResponse.json({ message: 'Marked as deceased.' })
}
