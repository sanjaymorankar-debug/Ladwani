import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const comments = await prisma.comment.findMany({
    where: { postId: params.id, status: 'ACTIVE', deletedAt: null, parentId: null },
    include: {
      author: { include: { member: { select: { firstName: true, lastName: true } } } },
      replies: {
        where: { status: 'ACTIVE', deletedAt: null },
        include: { author: { include: { member: { select: { firstName: true, lastName: true } } } } },
        orderBy: { createdAt: 'asc' },
        take: 10,
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
  })

  return NextResponse.json({ comments })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { content, parentId } = await req.json()
  if (!content?.trim()) return NextResponse.json({ message: 'Content required' }, { status: 400 })

  const post = await prisma.post.findUnique({ where: { id: params.id, status: 'PUBLISHED' } })
  if (!post) return NextResponse.json({ message: 'Post not found' }, { status: 404 })

  const comment = await prisma.comment.create({
    data: {
      postId: params.id,
      authorId: session.user.id as string,
      content: content.trim(),
      parentId: parentId ?? null,
    },
  })

  return NextResponse.json({ message: 'Comment added', commentId: comment.id }, { status: 201 })
}
