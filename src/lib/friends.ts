import { prisma } from '@/lib/prisma'

/** F35 — friendships are between members (with logins) and work both ways once accepted. */
export async function friendshipBetween(a: string, b: string) {
  return prisma.friendship.findFirst({
    where: { OR: [{ requesterMemberId: a, addresseeMemberId: b }, { requesterMemberId: b, addresseeMemberId: a }] },
  })
}

export async function areFriends(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b || a === b) return false
  const f = await friendshipBetween(a, b)
  return f?.status === 'ACCEPTED'
}

export async function friendIdsOf(memberId: string) {
  const rows = await prisma.friendship.findMany({
    where: { status: 'ACCEPTED', OR: [{ requesterMemberId: memberId }, { addresseeMemberId: memberId }] },
    select: { requesterMemberId: true, addresseeMemberId: true },
  })
  return rows.map((r) => (r.requesterMemberId === memberId ? r.addresseeMemberId : r.requesterMemberId))
}

/** Is `memberId` in the friend list `listId` (owned by `ownerId`) and still a friend? */
export async function inFriendList(listId: string, ownerId: string, memberId: string | null | undefined) {
  if (!memberId) return false
  const list = await prisma.friendList.findUnique({ where: { id: listId } })
  if (!list || list.ownerMemberId !== ownerId) return false
  const row = await prisma.friendListMember.findUnique({ where: { listId_friendMemberId: { listId, friendMemberId: memberId } } })
  return !!row && (await areFriends(ownerId, memberId))
}

/** Removing a friend removes them from all lists silently — both people's lists. */
export async function dropFromLists(a: string, b: string) {
  const lists = await prisma.friendList.findMany({ where: { ownerMemberId: { in: [a, b] } }, select: { id: true, ownerMemberId: true } })
  for (const l of lists) {
    await prisma.friendListMember.deleteMany({ where: { listId: l.id, friendMemberId: l.ownerMemberId === a ? b : a } })
  }
}

/** F12: an expired person is removed from friend lists (and their friendships end). */
export async function removeAllFriendships(memberId: string) {
  const friends = await friendIdsOf(memberId)
  await prisma.friendship.updateMany({
    where: { status: { in: ['ACCEPTED', 'PENDING'] }, OR: [{ requesterMemberId: memberId }, { addresseeMemberId: memberId }] },
    data: { status: 'CANCELLED', respondedAt: new Date() },
  })
  for (const f of friends) await dropFromLists(memberId, f)
}
