import { BASE_PATH } from '@/lib/api-path'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateAge } from '@/lib/utils'
import { areaChain, chainText } from '@/lib/locations'
import { maskIdNumber } from '@/lib/secure-files'
import { decideTask, checklistFor, UNDECIDED, mulGaonOf } from '@/lib/verification'
import { OFFICES } from '@/lib/organisations'

/**
 * F05 — one task, for the Operator it is assigned to and nobody else (an
 * Admin uses the Approval Monitor). The response carries the subject's
 * profile and ID proof — never the other operator's task or decision.
 */
async function ownTask(taskId: string, userId: string) {
  const task = await prisma.approvalTask.findUnique({ where: { id: taskId } })
  return task && task.operatorUserId === userId ? task : null
}

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
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

  // F26: an organisation registration — the subject above is the applicant.
  let organisation = null
  if (task.organisationId) {
    const org = await prisma.organisation.findUniqueOrThrow({ where: { id: task.organisationId } })
    const body = await prisma.organisationMember.findMany({ where: { organisationId: org.id, status: { in: ['ACTIVE', 'INVITED'] } } })
    const officers = body.filter((o) => (OFFICES as readonly string[]).includes(o.designation))
    const names = new Map((await prisma.member.findMany({ where: { id: { in: body.map((o) => o.memberId) } }, select: { id: true, firstName: true, lastName: true, memberNumber: true, currentCity: true } }))
      .map((m) => [m.id, `${[m.firstName, m.lastName].filter(Boolean).join(' ')} (${m.memberNumber})${m.currentCity ? ` — ${m.currentCity}` : ''}`]))
    organisation = {
      id: org.id, name: org.name, registrationNumber: org.registrationNumber, addressLine: org.addressLine, purpose: org.purpose,
      startedOn: org.startedOn, town: org.town,
      district: org.areaId ? chainText(await areaChain(org.areaId)) : null,
      officers: officers.map((o) => ({ designation: o.designation, name: names.get(o.memberId) ?? '', accepted: o.status === 'ACTIVE' })),
      members: body.filter((o) => o.designation === 'MEMBER').map((o) => ({ name: names.get(o.memberId) ?? '', accepted: o.status === 'ACTIVE' })),
      certificate: canOpenFiles && org.certificateKey ? `${BASE_PATH}/api/organisations/${org.id}/certificate` : null,
    }
  }

  return NextResponse.json({
    task: {
      id: task.id, kind: task.kind, status: task.status, round: task.round, dueAt: task.dueAt,
      checklist: task.checklist, remarks: task.remarks, decidedAt: task.decidedAt, superseded: !!task.supersededAt,
    },
    checklistItems: checklistFor(task.kind),
    organisation,
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
      files: canOpenFiles ? { proof: `${BASE_PATH}/api/id-proofs/${p.id}/file?kind=proof`, selfSigned: `${BASE_PATH}/api/id-proofs/${p.id}/file?kind=selfSigned` } : null,
    })),
  })
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const result = await decideTask(params.id, session.user.id, body, req)
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: result.status })
  // The operator learns only that their own decision is recorded — not the round's outcome.
  return NextResponse.json({ message: 'Decision recorded' })
}
