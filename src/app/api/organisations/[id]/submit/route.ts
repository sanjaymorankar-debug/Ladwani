import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'
import { createRound, currentRound, liveTasks, KIND } from '@/lib/verification'

/** F26 after a send-back: the applicant resubmits; a new round goes to the same Operators when still eligible. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const org = await prisma.organisation.findUnique({ where: { id: params.id } })
  if (!org || org.applicantUserId !== session.user.id) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  const moved = await prisma.organisation.updateMany({ where: { id: org.id, status: 'CORRECTION_REQUIRED' }, data: { status: 'PENDING_APPROVAL', decisionNote: null } })
  if (moved.count !== 1) return NextResponse.json({ message: 'Only an organisation sent back for correction can be resubmitted' }, { status: 409 })
  const round = await currentRound(KIND.ORGANISATION, session.user.id, null, org.id)
  const previous = await liveTasks({ kind: KIND.ORGANISATION, subjectUserId: session.user.id, round, changeRequestId: null, organisationId: org.id })
  await createRound({
    kind: KIND.ORGANISATION, subjectUserId: session.user.id, subjectMemberId: (session.user as any).memberId, organisationId: org.id, round: round + 1,
  }, previous.map((t) => t.operatorUserId))
  await recordAudit({ actorId: session.user.id, action: 'organisation.resubmit', entityType: 'organisation', entityId: org.id,
    oldValue: { status: 'CORRECTION_REQUIRED' }, newValue: { status: 'PENDING_APPROVAL', round: round + 1 } }, req)
  return NextResponse.json({ message: 'Resubmitted for verification' })
}
