import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

  const updated = await prisma.approval.update({
    where: { id: params.id },
    data: {
      status: statusMap[action] as any,
      reviewedBy: session.user?.id as string,
      reviewedAt: new Date(),
      reviewNote: note,
    },
  })

  await prisma.auditLog.create({
    data: {
      actorId: session.user?.id as string,
      actorRole: roles[0],
      action: `approval.${action}`,
      entityType: 'approval',
      entityId: params.id,
      newValue: { status: statusMap[action], note },
    },
  })

  return NextResponse.json({ message: 'Updated', approval: updated })
}
