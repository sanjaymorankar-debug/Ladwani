import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireActiveAccount } from '@/lib/account-state'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  // F01: a DRAFT / unapproved account may only fill in its own profile.
  const notActive = await requireActiveAccount(session.user?.id as string)
  if (notActive) return notActive
  const { reactionType = 'LIKE' } = await req.json()

  try {
    await prisma.reaction.create({
      data: { postId: params.id, userId: session.user.id as string, reactionType },
    })
    return NextResponse.json({ message: 'Reacted' })
  } catch {
    return NextResponse.json({ message: 'Already reacted' }, { status: 409 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  await prisma.reaction.deleteMany({
    where: { postId: params.id, userId: session.user.id as string },
  })
  return NextResponse.json({ message: 'Removed' })
}
