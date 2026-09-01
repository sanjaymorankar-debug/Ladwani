import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { applySpouseLink } from '@/lib/approvals'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const approval = await prisma.approval.findUnique({
    where: { id: params.id },
    include: {
      submitter: { include: { member: { select: { firstName: true, lastName: true } } } },
      reviewer: { include: { member: { select: { firstName: true, lastName: true } } } },
    },
  })
  if (!approval) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  return NextResponse.json(approval)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const roles: string[] = (session.user as any)?.roles ?? []
  if (!roles.includes('ADMIN') && !roles.includes('OPERATOR')) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { action, note } = body // action: 'approve' | 'reject' | 'return' | 'escalate'

  const statusMap: Record<string, string> = {
    approve: 'APPROVED',
    reject: 'REJECTED',
    return: 'RETURNED',
    escalate: 'ESCALATED',
  }

  const existing = await prisma.approval.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (existing.status !== 'SUBMITTED' && existing.status !== 'UNDER_REVIEW') {
    return NextResponse.json({ message: 'This request has already been reviewed' }, { status: 409 })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const approval = await tx.approval.update({
      where: { id: params.id },
      data: {
        status: statusMap[action] as any,
        reviewedBy: session.user?.id as string,
        reviewedAt: new Date(),
        reviewNote: note,
      },
    })

    // Apply the actual side effect on the entity this approval gates —
    // flipping Approval.status alone doesn't change anything the rest of
    // the app looks at (e.g. Family.verificationStatus).
    if (approval.entityId && (action === 'approve' || action === 'reject')) {
      if (approval.actionCode === 'family.create' && approval.entityType === 'family') {
        await tx.family.update({
          where: { id: approval.entityId },
          data: action === 'approve'
            ? {
                status: 'ACTIVE',
                verificationStatus: 'VERIFIED',
                verifiedBy: session.user?.id as string,
                verifiedAt: new Date(),
              }
            : {
                verificationStatus: 'REJECTED',
              },
        })
      }

      if (approval.actionCode === 'member.marital_status_change' && approval.entityType === 'member' && action === 'approve') {
        const payload = (approval.newValue ?? {}) as { spouseMemberId?: string | null; externalSpouseName?: string | null }
        await applySpouseLink(tx, approval.entityId, payload, session.user?.id as string, approval.id)
      }
    }

    await tx.auditLog.create({
      data: {
        actorId: session.user?.id as string,
        actorRole: roles[0],
        action: `approval.${action}`,
        entityType: 'approval',
        entityId: params.id,
        newValue: { status: statusMap[action], note },
      },
    })

    return approval
  })

  return NextResponse.json({ message: 'Updated', approval: updated })
}
