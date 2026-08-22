import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isFamilyKartaOrAdmin } from '@/lib/family-auth'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  if (!(await isFamilyKartaOrAdmin(params.id, session))) {
    return NextResponse.json({ message: 'Only the family Karta can view join requests' }, { status: 403 })
  }

  const requests = await prisma.familyJoinRequest.findMany({
    where: { familyId: params.id },
    include: { member: { select: { id: true, firstName: true, lastName: true, gender: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ requests })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  if (!(await isFamilyKartaOrAdmin(params.id, session))) {
    return NextResponse.json({ message: 'Only the family Karta can add members' }, { status: 403 })
  }

  const body = await req.json()
  const { memberId, relatedToMemberId, relationshipTypeCode } = body
  if (!memberId || !relationshipTypeCode) {
    return NextResponse.json({ message: 'memberId and relationshipTypeCode are required' }, { status: 400 })
  }

  const family = await prisma.family.findUnique({ where: { id: params.id }, select: { id: true, name: true } })
  if (!family) return NextResponse.json({ message: 'Family not found' }, { status: 404 })

  const targetMember = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, userId: true, firstName: true, lastName: true },
  })
  if (!targetMember) return NextResponse.json({ message: 'Member not found' }, { status: 404 })
  if (!targetMember.userId) {
    return NextResponse.json({ message: 'This member has no linked account and cannot approve a join request. Use "Add New Member" instead.' }, { status: 400 })
  }

  const alreadyInFamily = await prisma.familyMember.findFirst({
    where: { familyId: params.id, memberId, leftAt: null },
  })
  if (alreadyInFamily) {
    return NextResponse.json({ message: 'This member is already part of the family' }, { status: 409 })
  }

  const existingPending = await prisma.familyJoinRequest.findFirst({
    where: { familyId: params.id, memberId, status: 'PENDING' },
  })
  if (existingPending) {
    return NextResponse.json({ message: 'A join request is already pending for this member' }, { status: 409 })
  }

  const joinRequest = await prisma.familyJoinRequest.create({
    data: {
      familyId: params.id,
      memberId,
      relatedToMemberId: relatedToMemberId || null,
      relationshipTypeCode,
      requestedBy: session.user.id,
    },
  })

  await prisma.notification.create({
    data: {
      recipientId: targetMember.userId,
      senderId: session.user.id,
      type: 'FAMILY_JOIN_REQUEST',
      title: 'Family join request',
      body: `${family.name} family has invited you to join their family tree.`,
      data: { joinRequestId: joinRequest.id, familyId: family.id, familyName: family.name },
    },
  })

  return NextResponse.json({ joinRequest }, { status: 201 })
}
