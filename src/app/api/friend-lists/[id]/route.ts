import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function ownList(session: any, id: string) {
  const me = session?.user?.memberId as string | null
  const list = await prisma.friendList.findUnique({ where: { id } })
  return list && me && list.ownerMemberId === me ? list : null
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!(await ownList(session, params.id))) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  const name = String((await req.json().catch(() => ({}))).name ?? '').trim().slice(0, 80)
  if (!name) return NextResponse.json({ message: 'Name the list' }, { status: 400 })
  await prisma.friendList.update({ where: { id: params.id }, data: { name } }).catch(() => null)
  return NextResponse.json({ message: 'Renamed' })
}

/** Deleting a list leaves the friendships; posts and photos shared with it stay visible only to their owner. */
export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!(await ownList(session, params.id))) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  await prisma.friendListMember.deleteMany({ where: { listId: params.id } })
  await prisma.friendList.delete({ where: { id: params.id } })
  return NextResponse.json({ message: 'List deleted' })
}
