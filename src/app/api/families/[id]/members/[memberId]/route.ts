import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isFamilyKartaOrAdmin } from '@/lib/family-auth'

const VALID_STATUSES = ['ACTIVE', 'INACTIVE', 'DECEASED', 'SUSPENDED']
const VALID_LEFT_REASONS = ['MARRIED_OUT', 'DECEASED', 'SEPARATED', 'ERROR', 'MERGED']

export async function PATCH(req: Request, { params }: { params: { id: string; memberId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  if (!(await isFamilyKartaOrAdmin(params.id, session))) {
    return NextResponse.json({ message: 'Only the family Karta can manage members' }, { status: 403 })
  }

  const { status } = await req.json()
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ message: `status must be one of ${VALID_STATUSES.join(', ')}` }, { status: 400 })
  }

  const membership = await prisma.familyMember.findFirst({
    where: { familyId: params.id, memberId: params.memberId, leftAt: null },
  })
  if (!membership) return NextResponse.json({ message: 'Member not found in this family' }, { status: 404 })

  const updated = await prisma.member.update({
    where: { id: params.memberId },
    data: { status, updatedBy: session.user.id },
  })

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id as string,
      action: 'family.member.status_change',
      entityType: 'member',
      entityId: params.memberId,
      newValue: { status },
    },
  })

  return NextResponse.json({ member: updated })
}

export async function DELETE(req: Request, { params }: { params: { id: string; memberId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  if (!(await isFamilyKartaOrAdmin(params.id, session))) {
    return NextResponse.json({ message: 'Only the family Karta can manage members' }, { status: 403 })
  }

  const url = new URL(req.url)
  const leftReason = url.searchParams.get('reason') ?? 'ERROR'
  if (!VALID_LEFT_REASONS.includes(leftReason)) {
    return NextResponse.json({ message: `reason must be one of ${VALID_LEFT_REASONS.join(', ')}` }, { status: 400 })
  }

  const membership = await prisma.familyMember.findFirst({
    where: { familyId: params.id, memberId: params.memberId, leftAt: null },
  })
  if (!membership) return NextResponse.json({ message: 'Member not found in this family' }, { status: 404 })
  if (membership.isKarta) {
    return NextResponse.json({ message: 'Cannot remove the Karta. Transfer headship first.' }, { status: 400 })
  }

  await prisma.familyMember.update({
    where: { id: membership.id },
    data: { leftAt: new Date(), leftReason },
  })

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id as string,
      action: 'family.member.remove',
      entityType: 'member',
      entityId: params.memberId,
      newValue: { familyId: params.id, leftReason },
    },
  })

  return NextResponse.json({ message: 'Member removed from family' })
}
