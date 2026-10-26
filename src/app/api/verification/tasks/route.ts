import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasActiveRole } from '@/lib/scope'

/**
 * F05 — an Operator's own queue. The query is pinned to operatorUserId = the
 * caller: there is no parameter that widens it, and nothing about the other
 * slot (its operator, status or decision) is selected.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  if (!(await hasActiveRole(session.user.id, 'OPERATOR'))) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const tasks = await prisma.approvalTask.findMany({
    where: { operatorUserId: session.user.id, supersededAt: null },
    select: {
      id: true, kind: true, status: true, round: true, dueAt: true, createdAt: true, decidedAt: true, organisationId: true,
      subject: { select: { member: { select: { firstName: true, lastName: true, memberNumber: true } } } },
    },
    orderBy: [{ decidedAt: { sort: 'asc', nulls: 'first' } }, { dueAt: 'asc' }],
    take: 200,
  })
  const orgNames = new Map((await prisma.organisation.findMany({
    where: { id: { in: tasks.map((t) => t.organisationId).filter(Boolean) as string[] } }, select: { id: true, name: true },
  })).map((o) => [o.id, o.name]))
  return NextResponse.json({
    tasks: tasks.map((t) => ({
      organisationName: t.organisationId ? orgNames.get(t.organisationId) ?? null : null,
      id: t.id, kind: t.kind, status: t.status, round: t.round, dueAt: t.dueAt, createdAt: t.createdAt, decidedAt: t.decidedAt,
      subjectName: [t.subject.member?.firstName, t.subject.member?.lastName].filter(Boolean).join(' '),
      memberNumber: t.subject.member?.memberNumber ?? null,
    })),
  })
}
