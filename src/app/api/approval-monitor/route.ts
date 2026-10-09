import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getViewerScope, expandAreas } from '@/lib/scope'

/**
 * F07 — Approval Monitor. Admin sees every task; a State team sees tasks for
 * members whose Mul Gaon is in their state (OP-03). Nobody else — District
 * and National teams see final user status only (Team Directory).
 * Filters: stateId, districtId, operatorId, minAgeDays, status, kind.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const scope = await getViewerScope(session.user.id)
  if (!scope.canSeeApprovalStatus) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const and: Prisma.ApprovalTaskWhereInput[] = []
  if (!scope.isAdmin) and.push({ districtAreaId: { in: scope.approvalAreaIds } })
  const stateId = url.searchParams.get('stateId')
  const districtId = url.searchParams.get('districtId')
  if (stateId) and.push({ districtAreaId: { in: await expandAreas([stateId]) } })
  if (districtId) and.push({ districtAreaId: districtId })
  const operatorId = url.searchParams.get('operatorId')
  if (operatorId) and.push({ operatorUserId: operatorId })
  const status = url.searchParams.get('status')
  if (status) and.push({ status })
  else and.push({ supersededAt: null })
  const kind = url.searchParams.get('kind')
  if (kind) and.push({ kind })
  const minAgeDays = Number(url.searchParams.get('minAgeDays') ?? '')
  if (Number.isFinite(minAgeDays) && minAgeDays > 0) and.push({ createdAt: { lt: new Date(Date.now() - minAgeDays * 86400000) } })

  const tasks = await prisma.approvalTask.findMany({
    where: { AND: and },
    include: {
      subject: { select: { status: true, member: { select: { firstName: true, lastName: true, memberNumber: true } } } },
      operator: { select: { id: true, email: true, member: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: [{ subjectUserId: 'asc' }, { round: 'desc' }, { slot: 'asc' }, { createdAt: 'desc' }],
    take: 500,
  })
  const districts = await prisma.area.findMany({
    where: { id: { in: Array.from(new Set(tasks.map((t) => t.districtAreaId).filter(Boolean) as string[])) } },
    select: { id: true, name: true },
  })
  const districtName = new Map(districts.map((d) => [d.id, d.name]))
  const name = (m?: { firstName: string; lastName: string | null } | null) => (m ? [m.firstName, m.lastName].filter(Boolean).join(' ') : null)

  const operators = scope.isAdmin
    ? (await prisma.user.findMany({
        where: { status: 'ACTIVE', deletedAt: null, userRoles: { some: { role: { code: 'OPERATOR' } } } },
        select: { id: true, email: true, member: { select: { firstName: true, lastName: true } } },
      })).map((o) => ({ id: o.id, name: name(o.member) ?? o.email }))
    : []

  return NextResponse.json({
    canManage: scope.isAdmin,
    operators,
    tasks: tasks.map((t) => ({
      id: t.id, kind: t.kind, round: t.round, slot: t.slot, status: t.status,
      live: !t.supersededAt, createdAt: t.createdAt, dueAt: t.dueAt, decidedAt: t.decidedAt,
      ageDays: Math.floor((Date.now() - t.createdAt.getTime()) / 86400000),
      district: t.districtAreaId ? districtName.get(t.districtAreaId) ?? null : null,
      subject: { name: name(t.subject.member), memberNumber: t.subject.member?.memberNumber ?? null, accountStatus: t.subject.status },
      operator: t.operator ? { id: t.operator.id, name: name(t.operator.member) ?? t.operator.email } : null,
      remarks: scope.isAdmin ? t.remarks : undefined,
    })),
  })
}
