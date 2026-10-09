import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateAge } from '@/lib/utils'
import { areaChain, chainText } from '@/lib/locations'
import { maskIdNumber } from '@/lib/secure-files'
import { decideTask, CHECKLIST_ITEMS, UNDECIDED, mulGaonOf } from '@/lib/verification'

/**
 * F05 — one task, for the Operator it is assigned to and nobody else (an
 * Admin uses the Approval Monitor). The response carries the subject's
 * profile and ID proof — never the other operator's task or decision.
 */
async function ownTask(taskId: string, userId: string) {
  const task = await prisma.approvalTask.findUnique({ where: { id: taskId } })
  return task && task.operatorUserId === userId ? task : null
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const task = await ownTask(params.id, session.user.id)
  if (!task) return NextResponse.json({ message: 'Task not found' }, { status: 404 })

  const member = await prisma.member.findUniqueOrThrow({
    where: { id: task.subjectMemberId },
    include: {
      addresses: { where: { addressType: { in: ['CURRENT', 'PERMANENT'] } } },
      education: true,
      profileDetails: true,
      user: { select: { email: true, mobile: true, status: true } },
    },
  })
  const mulGaonId = await mulGaonOf(member.id)
  const mulGaon = mulGaonId ? chainText(await areaChain(mulGaonId)) : null

  const change = task.changeRequestId
    ? await prisma.profileChangeRequest.findUnique({ where: { id: task.changeRequestId }, select: { changes: true, status: true } })
    : null
  const proofIds = new Set<string>()
  const active = await prisma.idProof.findFirst({ where: { memberId: member.id, status: 'ACTIVE' } })
  if (active) proofIds.add(active.id)
  const changedProofId = (change?.changes as any)?.idProofId?.new as string | undefined
  if (changedProofId) proofIds.add(changedProofId)
  const proofs = await prisma.idProof.findMany({ where: { id: { in: Array.from(proofIds) } } })
  const canOpenFiles = !task.supersededAt && UNDECIDED.includes(task.status)

  return NextResponse.json({
    task: {
      id: task.id, kind: task.kind, status: task.status, round: task.round, dueAt: task.dueAt,
      checklist: task.checklist, remarks: task.remarks, decidedAt: task.decidedAt, superseded: !!task.supersededAt,
    },
    checklistItems: CHECKLIST_ITEMS,
    subject: {
      memberNumber: member.memberNumber,
      firstName: member.firstName, middleName: member.middleName, lastName: member.lastName,
      gender: member.gender, dateOfBirth: member.dateOfBirth, age: calculateAge(member.dateOfBirth),
      maritalStatus: member.maritalStatus, socialStatus: member.employmentStatus,
      mobile: member.user?.mobile ?? member.mobilePrimary, email: member.user?.email ?? member.email,
      mulGaon, addresses: member.addresses, education: member.education, occupation: member.profileDetails,
      profilePhotoId: member.profilePhotoId,
    },
    change: change ? { status: change.status, changes: change.changes } : null,
    idProofs: proofs.map((p) => ({
      id: p.id, idType: p.idType, masked: maskIdNumber(p.idLast4), status: p.status,
      files: canOpenFiles ? { proof: `/api/id-proofs/${p.id}/file?kind=proof`, selfSigned: `/api/id-proofs/${p.id}/file?kind=selfSigned` } : null,
    })),
  })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const result = await decideTask(params.id, session.user.id, body, req)
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: result.status })
  // The operator learns only that their own decision is recorded — not the round's outcome.
  return NextResponse.json({ message: 'Decision recorded' })
}
