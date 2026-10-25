import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { areFriends } from '@/lib/friends'

async function ownList(session: any, id: string) {
  const me = session?.user?.memberId as string | null
  const list = await prisma.friendList.findUnique({ where: { id } })
  return list && me && list.ownerMemberId === me ? list : null
}

/** F35: add a friend to a list (only friends can be in a list). */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  const list = await ownList(session, params.id)
  if (!list) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  const { memberId } = await req.json().catch(() => ({}))
  if (!(await areFriends(list.ownerMemberId, String(memberId ?? '')))) return NextResponse.json({ message: 'Only friends can be added to a list' }, { status: 400 })
  await prisma.friendListMember.upsert({
    where: { listId_friendMemberId: { listId: list.id, friendMemberId: String(memberId) } },
    update: {}, create: { listId: list.id, friendMemberId: String(memberId) },
  })
  return NextResponse.json({ message: 'Added' }, { status: 201 })
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  const list = await ownList(session, params.id)
  if (!list) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  const memberId = new URL(req.url).searchParams.get('memberId') ?? ''
  await prisma.friendListMember.deleteMany({ where: { listId: list.id, friendMemberId: memberId } })
  return NextResponse.json({ message: 'Removed' })
}
