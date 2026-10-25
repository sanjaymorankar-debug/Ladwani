import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireActiveAccount } from '@/lib/account-state'
import { AUTHOR_SELECT } from '@/lib/posts'
import { canSeePost } from '@/lib/post-access'

// Comments follow the post: only its audience (or, in an interest group, its
// members) reads or writes them, and only authors' names are returned.
async function visiblePost(session: any, id: string) {
  const post = await prisma.post.findUnique({ where: { id } })
  return post && (await canSeePost(session, post)) ? post : null
}

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  if (!(await visiblePost(session, params.id))) return NextResponse.json({ message: 'Post not found' }, { status: 404 })

  const comments = await prisma.comment.findMany({
    where: { postId: params.id, status: 'ACTIVE', deletedAt: null, parentId: null },
    include: {
      author: AUTHOR_SELECT,
      replies: {
        where: { status: 'ACTIVE', deletedAt: null },
        include: { author: AUTHOR_SELECT },
        orderBy: { createdAt: 'asc' },
        take: 10,
      },
    },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ comments })
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  // F01: a DRAFT / unapproved account may only fill in its own profile.
  const notActive = await requireActiveAccount(session.user?.id as string)
  if (notActive) return notActive

  const { content, parentId } = await req.json().catch(() => ({}))
  if (typeof content !== 'string' || !content.trim() || content.length > 2000) return NextResponse.json({ message: 'Content required (up to 2000 characters)' }, { status: 400 })

  const post = await visiblePost(session, params.id)
  if (!post || post.status !== 'PUBLISHED') return NextResponse.json({ message: 'Post not found' }, { status: 404 })
  if (parentId && !(await prisma.comment.findFirst({ where: { id: String(parentId), postId: post.id, deletedAt: null } }))) {
    return NextResponse.json({ message: 'The comment you reply to is not on this post' }, { status: 400 })
  }

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
