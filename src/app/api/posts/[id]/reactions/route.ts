import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireActiveAccount } from '@/lib/account-state'
import { canSeePost } from '@/lib/post-access'

const REACTIONS = ['LIKE', 'LOVE', 'SUPPORT', 'CELEBRATE', 'CONDOLENCE']

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  // F01: a DRAFT / unapproved account may only fill in its own profile.
  const notActive = await requireActiveAccount(session.user?.id as string)
  if (notActive) return notActive
  const { reactionType = 'LIKE' } = await req.json().catch(() => ({}))
  if (!REACTIONS.includes(reactionType)) return NextResponse.json({ message: 'Unknown reaction' }, { status: 400 })

  // F36: only the post's audience (or the interest group's members) can react, and only to a live post.
  const post = await prisma.post.findUnique({ where: { id: params.id } })
  if (!post || post.status !== 'PUBLISHED' || !(await canSeePost(session, post))) {
    return NextResponse.json({ message: 'Post not found' }, { status: 404 })
  }
  const existing = await prisma.reaction.findFirst({ where: { postId: post.id, userId: session.user.id as string } })
  if (existing) return NextResponse.json({ message: 'Already reacted' }, { status: 409 })
  await prisma.reaction.create({ data: { postId: post.id, userId: session.user.id as string, reactionType } })
  return NextResponse.json({ message: 'Reacted' })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  await prisma.reaction.deleteMany({
    where: { postId: params.id, userId: session.user.id as string },
  })
  return NextResponse.json({ message: 'Removed' })
}
