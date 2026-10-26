import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyUser } from '@/lib/notify'
import { dropFromLists } from '@/lib/friends'

/**
 * F35: accept | decline (the person asked), cancel (the asker), remove (either
 * friend — they are silently taken out of every friend list).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const me = (session?.user as any)?.memberId as string | null
  if (!session?.user?.id || !me) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const f = await prisma.friendship.findUnique({ where: { id: params.id } })
  if (!f || (f.requesterMemberId !== me && f.addresseeMemberId !== me)) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  const { action } = await req.json().catch(() => ({}))
  const done = (status: string) => prisma.friendship.update({ where: { id: f.id }, data: { status, respondedAt: new Date() } })

  if ((action === 'accept' || action === 'decline') && f.status === 'PENDING' && f.addresseeMemberId === me) {
    await done(action === 'accept' ? 'ACCEPTED' : 'DECLINED')
    if (action === 'accept') {
      const asker = await prisma.member.findUnique({ where: { id: f.requesterMemberId }, select: { userId: true } })
      const meRow = await prisma.member.findUnique({ where: { id: me }, select: { firstName: true } })
      if (asker?.userId) await notifyUser({ userId: asker.userId, type: 'FRIEND_ACCEPTED', title: `${meRow?.firstName ?? 'Someone'} accepted your friend request`, body: '', data: { friendshipId: f.id } })
    }
    return NextResponse.json({ message: action === 'accept' ? 'You are now friends' : 'Declined' })
  }
  if (action === 'cancel' && f.status === 'PENDING' && f.requesterMemberId === me) {
    await done('CANCELLED')
    return NextResponse.json({ message: 'Request cancelled' })
  }
  if (action === 'remove' && f.status === 'ACCEPTED') {
    await done('CANCELLED')
    await dropFromLists(f.requesterMemberId, f.addresseeMemberId)
    return NextResponse.json({ message: 'Friend removed' })
  }
  return NextResponse.json({ message: 'This action is not possible now' }, { status: 409 })
}
