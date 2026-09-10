import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function loadGroup(id: string) {
  return prisma.communityGroup.findUnique({
    where: { id },
    include: {
      area: { select: { id: true, name: true, type: true } },
      convener: { select: { id: true, firstName: true, lastName: true } },
      members: {
        where: { leftAt: null },
        include: { member: { select: { id: true, firstName: true, lastName: true, mobilePrimary: true } } },
        orderBy: { joinedAt: 'asc' },
      },
    },
  })
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const roles = ((session.user as any).roles ?? []) as string[]
  const isStaff = roles.includes('ADMIN') || roles.includes('OPERATOR')
  const memberId = (session.user as any).memberId as string | null

  const group = await loadGroup(params.id)
  if (!group || group.deletedAt) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  const isConvener = memberId === group.convenerMemberId
  const visible = group.status === 'ACTIVE' || isConvener || isStaff
  if (!visible) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  // Roster-review due when it has never been reviewed, or the interval elapsed.
  const reviewDue =
    !group.lastRosterReviewAt ||
    Date.now() - group.lastRosterReviewAt.getTime() > group.rosterReviewIntervalDays * 86400000

  return NextResponse.json({ group: { ...group, reviewDue }, canManage: isConvener || isStaff })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const roles = ((session.user as any).roles ?? []) as string[]
  const isStaff = roles.includes('ADMIN') || roles.includes('OPERATOR')
  const memberId = (session.user as any).memberId as string | null

  const existing = await prisma.communityGroup.findUnique({ where: { id: params.id } })
  if (!existing || existing.deletedAt) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  const isConvener = memberId === existing.convenerMemberId
  if (!isConvener && !isStaff) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const set = <T,>(key: string, transform: (v: any) => T) =>
    body[key] !== undefined ? { [key]: transform(body[key]) } : {}
  const text = (v: any) => (v === '' || v === null ? null : v)

  // Only staff can flip status/isActive directly (e.g. deactivate a stale
  // group). A convener edits the group's own details; approval status
  // itself is changed only through the Approval workflow, not here.
  const staffOnly = isStaff
    ? {
        ...set('isActive', (v: any) => !!v),
        ...(body.status && ['ACTIVE', 'INACTIVE'].includes(body.status) ? { status: body.status } : {}),
      }
    : {}

  const updated = await prisma.communityGroup.update({
    where: { id: params.id },
    data: {
      ...set('name', String),
      ...set('code', text),
      ...set('groupType', String),
      ...set('description', text),
      ...set('areaId', text),
      ...set('meetingSchedule', text),
      ...set('maxMembers', (v: any) => (v === null ? null : parseInt(v, 10))),
      ...set('rosterReviewIntervalDays', (v: any) => parseInt(v, 10)),
      ...(body.convenerMemberId !== undefined && isStaff ? { convenerMemberId: body.convenerMemberId } : {}),
      ...staffOnly,
    },
  })

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id as string,
      action: 'group.update',
      entityType: 'group',
      entityId: params.id,
      newValue: body,
    },
  })

  return NextResponse.json({ message: 'Updated', group: updated })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const roles = ((session.user as any).roles ?? []) as string[]
  const isStaff = roles.includes('ADMIN') || roles.includes('OPERATOR')
  const memberId = (session.user as any).memberId as string | null

  const existing = await prisma.communityGroup.findUnique({ where: { id: params.id } })
  if (!existing || existing.deletedAt) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  const isConvener = memberId === existing.convenerMemberId
  if (!isConvener && !isStaff) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  await prisma.communityGroup.update({ where: { id: params.id }, data: { deletedAt: new Date(), isActive: false } })

  await prisma.auditLog.create({
    data: { actorId: session.user.id as string, action: 'group.delete', entityType: 'group', entityId: params.id },
  })

  return NextResponse.json({ message: 'Group removed' })
}
