import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Explicit "I've checked this roster is current" action. This is what
 * "periodically update the members of these groups" resolves to in the UI —
 * a convener confirms the list on some cadence (rosterReviewIntervalDays)
 * rather than the app assuming a stale roster is still accurate.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const roles = ((session.user as any).roles ?? []) as string[]
  const isStaff = roles.includes('ADMIN') || roles.includes('OPERATOR')
  const memberId = (session.user as any).memberId as string | null

  const group = await prisma.communityGroup.findUnique({ where: { id: params.id } })
  if (!group || group.deletedAt) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  const isConvener = memberId === group.convenerMemberId
  if (!isConvener && !isStaff) {
    return NextResponse.json({ message: 'Only the convener or staff can confirm the roster' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))

  const updated = await prisma.communityGroup.update({
    where: { id: params.id },
    data: {
      lastRosterReviewAt: new Date(),
      lastRosterReviewBy: session.user.id as string,
      reviewNote: body.note ?? group.reviewNote,
    },
  })

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id as string,
      action: 'group.roster.reviewed',
      entityType: 'group',
      entityId: params.id,
    },
  })

  return NextResponse.json({ message: 'Roster marked as current', lastRosterReviewAt: updated.lastRosterReviewAt })
}
