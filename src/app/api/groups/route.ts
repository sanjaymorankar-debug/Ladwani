import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Community groups — small local bodies (mandals, yuvak mandals, etc.) that
 * meet in a particular area and keep a roster of roughly 20–25 members.
 *
 * Only ACTIVE groups are visible to members generally; a convener also sees
 * their own groups regardless of status, and staff sees everything so it can
 * be reviewed.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const roles = ((session.user as any).roles ?? []) as string[]
  const isStaff = roles.includes('ADMIN') || roles.includes('OPERATOR')
  const memberId = (session.user as any).memberId as string | null

  const url = new URL(req.url)
  const mine = url.searchParams.get('mine') === 'true'
  const areaId = url.searchParams.get('areaId')

  const where: any = { deletedAt: null }
  if (mine) {
    if (!memberId) return NextResponse.json({ groups: [] })
    where.convenerMemberId = memberId
  } else if (!isStaff) {
    where.status = 'ACTIVE'
    where.isActive = true
  }
  if (areaId) where.areaId = areaId

  const groups = await prisma.communityGroup.findMany({
    where,
    include: {
      area: { select: { id: true, name: true, type: true } },
      convener: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { members: { where: { leftAt: null } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return NextResponse.json({ groups })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const memberId = (session.user as any).memberId as string | null
  if (!memberId) return NextResponse.json({ message: 'Complete your member profile first.' }, { status: 400 })

  const body = await req.json()
  if (!body.name) {
    return NextResponse.json({ message: 'Group name is required' }, { status: 400 })
  }

  const maxMembers = body.maxMembers !== undefined && body.maxMembers !== null
    ? parseInt(body.maxMembers, 10)
    : 25

  const group = await prisma.$transaction(async (tx) => {
    const created = await tx.communityGroup.create({
      data: {
        name: body.name,
        code: body.code || null,
        groupType: body.groupType || 'MANDAL',
        description: body.description || null,
        areaId: body.areaId || null,
        convenerMemberId: memberId,
        meetingSchedule: body.meetingSchedule || null,
        maxMembers: Number.isFinite(maxMembers) ? maxMembers : 25,
        rosterReviewIntervalDays: body.rosterReviewIntervalDays
          ? parseInt(body.rosterReviewIntervalDays, 10)
          : 180,
        // Submitted for review — a group isn't listed to the community until
        // an Operator or Admin approves it, same pattern as assets.
        status: 'PENDING_APPROVAL',
        createdBy: session.user!.id as string,
      },
    })

    // The convener is automatically the group's first roster member.
    await tx.communityGroupMember.create({
      data: {
        groupId: created.id,
        memberId,
        roleInGroup: 'CONVENER',
        addedBy: session.user!.id as string,
      },
    })

    await tx.approval.create({
      data: {
        actionCode: 'group.create',
        entityType: 'group',
        entityId: created.id,
        newValue: { name: created.name, groupType: created.groupType },
        status: 'SUBMITTED',
        submittedBy: session.user!.id as string,
      },
    })

    await tx.auditLog.create({
      data: {
        actorId: session.user!.id as string,
        action: 'group.create',
        entityType: 'group',
        entityId: created.id,
        newValue: { name: created.name },
      },
    })

    return created
  })

  return NextResponse.json(
    { message: 'Group submitted for approval. It becomes visible once approved.', groupId: group.id },
    { status: 201 }
  )
}
