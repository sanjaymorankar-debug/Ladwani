import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** F35: create a named friend list ("School friends"). */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const me = (session?.user as any)?.memberId as string | null
  if (!session?.user?.id || !me) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const name = String((await req.json().catch(() => ({}))).name ?? '').trim().slice(0, 80)
  if (!name) return NextResponse.json({ message: 'Name the list' }, { status: 400 })
  if (await prisma.friendList.findUnique({ where: { ownerMemberId_name: { ownerMemberId: me, name } } })) return NextResponse.json({ message: 'You already have a list with that name' }, { status: 409 })
  const list = await prisma.friendList.create({ data: { ownerMemberId: me, name } })
  return NextResponse.json({ message: 'List created', listId: list.id }, { status: 201 })
}
