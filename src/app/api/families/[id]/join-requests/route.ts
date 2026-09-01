import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageFamily } from '@/lib/family-auth'

// Karta/staff view of pending requests to join this family.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  if (!(await canManageFamily(session, params.id))) {
    return NextResponse.json({ message: "Only this family's Karta can view join requests" }, { status: 403 })
  }

  const requests = await prisma.familyJoinRequest.findMany({
    where: { familyId: params.id, status: 'PENDING' },
    include: {
      member: {
        select: { id: true, firstName: true, lastName: true, mobilePrimary: true, email: true, currentCity: true, dateOfBirth: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ requests })
}

// Any authenticated member (not yet in a family) requests to join this one.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const memberId = (session.user as any).memberId as string | null
  if (!memberId) {
    return NextResponse.json({ message: 'Complete your member profile first.' }, { status: 400 })
  }

  const family = await prisma.family.findUnique({ where: { id: params.id } })
  if (!family) return NextResponse.json({ message: 'Family not found' }, { status: 404 })

  const existingMembership = await prisma.familyMember.findFirst({ where: { memberId, leftAt: null } })
  if (existingMembership) {
    return NextResponse.json({ message: 'You are already linked to a family.' }, { status: 409 })
  }

  const body = await req.json().catch(() => ({}))

  try {
    const joinRequest = await prisma.familyJoinRequest.create({
      data: {
        familyId: params.id,
        memberId,
        relatedToMemberId: body.relatedToMemberId ?? null,
        relationshipTypeCode: body.relationshipTypeCode ?? null,
        requestedBy: session.user.id,
        status: 'PENDING',
      },
    })

    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: 'family.join_request.create',
        entityType: 'family_join_request',
        entityId: joinRequest.id,
        newValue: { familyId: params.id },
      },
    })

    return NextResponse.json(
      { message: 'Join request sent. The family head will be notified.', requestId: joinRequest.id },
      { status: 201 }
    )
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ message: 'You already have a pending request for this family.' }, { status: 409 })
    }
    throw e
  }
}
