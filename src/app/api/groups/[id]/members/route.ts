import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function canManageRoster(groupId: string, memberId: string | null, isStaff: boolean) {
  if (isStaff) return true
  if (!memberId) return false
  const group = await prisma.communityGroup.findUnique({ where: { id: groupId }, select: { convenerMemberId: true, deletedAt: true } })
  return !!group && !group.deletedAt && group.convenerMemberId === memberId
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const roster = await prisma.communityGroupMember.findMany({
    where: { groupId: params.id, leftAt: null },
    include: { member: { select: { id: true, firstName: true, lastName: true, mobilePrimary: true, email: true } } },
    orderBy: [{ roleInGroup: 'asc' }, { joinedAt: 'asc' }],
  })

  return NextResponse.json({ roster })
}

/**
 * Adds a member to the group's roster. Kept as an explicit endpoint (rather
 * than folding into group PATCH) because it's the one operation conveners
 * are expected to run repeatedly — "periodically update the members" — and
 * because it needs its own duplicate/capacity checks.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const roles = ((session.user as any).roles ?? []) as string[]
  const isStaff = roles.includes('ADMIN') || roles.includes('OPERATOR')
  const memberId = (session.user as any).memberId as string | null

  const group = await prisma.communityGroup.findUnique({ where: { id: params.id } })
  if (!group || group.deletedAt) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  if (!(await canManageRoster(params.id, memberId, isStaff))) {
    return NextResponse.json({ message: 'Only the convener or staff can update this roster' }, { status: 403 })
  }

  const body = await req.json()
  if (!body.memberId) return NextResponse.json({ message: 'memberId is required' }, { status: 400 })

  const target = await prisma.member.findUnique({ where: { id: body.memberId } })
  if (!target) return NextResponse.json({ message: 'Member not found' }, { status: 404 })

  const existingActive = await prisma.communityGroupMember.findFirst({
    where: { groupId: params.id, memberId: body.memberId, leftAt: null },
  })
  if (existingActive) return NextResponse.json({ message: 'Already on this roster' }, { status: 409 })

  if (group.maxMembers) {
    const activeCount = await prisma.communityGroupMember.count({ where: { groupId: params.id, leftAt: null } })
    if (activeCount >= group.maxMembers) {
      return NextResponse.json(
        { message: `This group's roster is capped at ${group.maxMembers} members. Raise the limit first if this is intentional.` },
        { status: 409 }
      )
    }
  }

  // Re-joining after having left before keeps one history row rather than
  // creating duplicates, mirroring FamilyMember's leftAt-based history.
  const previous = await prisma.communityGroupMember.findFirst({
    where: { groupId: params.id, memberId: body.memberId, leftAt: { not: null } },
    orderBy: { joinedAt: 'desc' },
  })

  const roster = previous
    ? await prisma.communityGroupMember.update({
        where: { id: previous.id },
        data: { leftAt: null, leftReason: null, joinedAt: new Date(), roleInGroup: body.roleInGroup || 'MEMBER', addedBy: session.user.id as string },
      })
    : await prisma.communityGroupMember.create({
        data: {
          groupId: params.id,
          memberId: body.memberId,
          roleInGroup: body.roleInGroup || 'MEMBER',
          addedBy: session.user.id as string,
        },
      })

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id as string,
      action: 'group.member.add',
      entityType: 'group',
      entityId: params.id,
      newValue: { memberId: body.memberId },
    },
  })

  return NextResponse.json({ message: 'Added to roster', roster }, { status: 201 })
}

/** Retires a member from the roster (kept as history, not deleted). */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const roles = ((session.user as any).roles ?? []) as string[]
  const isStaff = roles.includes('ADMIN') || roles.includes('OPERATOR')
  const memberId = (session.user as any).memberId as string | null

  if (!(await canManageRoster(params.id, memberId, isStaff))) {
    return NextResponse.json({ message: 'Only the convener or staff can update this roster' }, { status: 403 })
  }

  const url = new URL(req.url)
  const targetMemberId = url.searchParams.get('memberId')
  if (!targetMemberId) return NextResponse.json({ message: 'memberId is required' }, { status: 400 })

  const rosterRow = await prisma.communityGroupMember.findFirst({
    where: { groupId: params.id, memberId: targetMemberId, leftAt: null },
  })
  if (!rosterRow) return NextResponse.json({ message: 'Not on this roster' }, { status: 404 })

  await prisma.communityGroupMember.update({
    where: { id: rosterRow.id },
    data: { leftAt: new Date(), leftReason: url.searchParams.get('reason') || null },
  })

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id as string,
      action: 'group.member.remove',
      entityType: 'group',
      entityId: params.id,
      newValue: { memberId: targetMemberId },
    },
  })

  return NextResponse.json({ message: 'Removed from roster' })
}
