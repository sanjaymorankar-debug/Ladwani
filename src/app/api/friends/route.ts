import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireActiveAccount } from '@/lib/account-state'
import { notifyUser } from '@/lib/notify'
import { friendshipBetween } from '@/lib/friends'

async function names(ids: string[]) {
  const rows = await prisma.member.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, memberNumber: true } })
  return new Map(rows.map((m) => [m.id, { memberId: m.id, name: [m.firstName, m.lastName].filter(Boolean).join(' '), memberNumber: m.memberNumber }]))
}

/** F35: my friends, requests both ways, and my named lists. */
export async function GET() {
  const session = await getServerSession(authOptions)
  const me = (session?.user as any)?.memberId as string | null
  if (!session?.user?.id || !me) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const rows = await prisma.friendship.findMany({ where: { status: { in: ['PENDING', 'ACCEPTED'] }, OR: [{ requesterMemberId: me }, { addresseeMemberId: me }] } })
  const lists = await prisma.friendList.findMany({ where: { ownerMemberId: me }, orderBy: { name: 'asc' } })
  const listMembers = await prisma.friendListMember.findMany({ where: { listId: { in: lists.map((l) => l.id) } } })
  const other = (r: { requesterMemberId: string; addresseeMemberId: string }) => (r.requesterMemberId === me ? r.addresseeMemberId : r.requesterMemberId)
  const who = await names([...rows.map(other), ...listMembers.map((m) => m.friendMemberId)])
  return NextResponse.json({
    friends: rows.filter((r) => r.status === 'ACCEPTED').map((r) => ({ friendshipId: r.id, ...who.get(other(r)) })),
    incoming: rows.filter((r) => r.status === 'PENDING' && r.addresseeMemberId === me).map((r) => ({ friendshipId: r.id, ...who.get(r.requesterMemberId) })),
    outgoing: rows.filter((r) => r.status === 'PENDING' && r.requesterMemberId === me).map((r) => ({ friendshipId: r.id, ...who.get(r.addresseeMemberId) })),
    lists: lists.map((l) => ({ id: l.id, name: l.name, members: listMembers.filter((m) => m.listId === l.id).map((m) => who.get(m.friendMemberId)) })),
  })
}

/** F35: send a friend request; the other person accepts. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const me = (session?.user as any)?.memberId as string | null
  if (!session?.user?.id || !me) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const notActive = await requireActiveAccount(session.user.id)
  if (notActive) return notActive
  const { memberId } = await req.json().catch(() => ({}))
  if (!memberId || memberId === me) return NextResponse.json({ message: 'Choose someone else' }, { status: 400 })
  const target = await prisma.member.findFirst({ where: { id: String(memberId), deletedAt: null, status: 'ACTIVE', user: { status: 'ACTIVE' } }, select: { id: true, userId: true } })
  if (!target) return NextResponse.json({ message: 'Friends must be active registered members' }, { status: 400 })
  const existing = await friendshipBetween(me, target.id)
  if (existing?.status === 'ACCEPTED') return NextResponse.json({ message: 'Already friends' }, { status: 409 })
  if (existing?.status === 'PENDING') {
    return NextResponse.json({ message: existing.requesterMemberId === me ? 'Request already sent' : 'They have already asked you — accept their request' }, { status: 409 })
  }
  // Re-asking after a decline or an ended friendship reuses the row in this direction.
  const row = existing && existing.requesterMemberId === me
    ? await prisma.friendship.update({ where: { id: existing.id }, data: { status: 'PENDING', respondedAt: null } })
    : existing
      ? await prisma.friendship.update({ where: { id: existing.id }, data: { requesterMemberId: me, addresseeMemberId: target.id, status: 'PENDING', respondedAt: null } })
      : await prisma.friendship.create({ data: { requesterMemberId: me, addresseeMemberId: target.id } })
  const from = await prisma.member.findUnique({ where: { id: me }, select: { firstName: true, lastName: true } })
  await notifyUser({ userId: target.userId!, type: 'FRIEND_REQUEST', title: `${[from?.firstName, from?.lastName].filter(Boolean).join(' ')} sent you a friend request`, body: 'Accept or decline on the Friends page.', data: { friendshipId: row.id } })
  return NextResponse.json({ message: 'Friend request sent', friendshipId: row.id }, { status: 201 })
}
