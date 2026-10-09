import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'
import { canViewPost, canModeratePost, AUTHOR_SELECT, BODY_MODERATED } from '@/lib/posts'

async function load(id: string) {
  return prisma.post.findUnique({ where: { id } })
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const post = await load(params.id)
  if (!post || !(await canViewPost(session, post))) return NextResponse.json({ message: 'Post not found' }, { status: 404 })
  const full = await prisma.post.findUniqueOrThrow({
    where: { id: post.id },
    include: { author: AUTHOR_SELECT, postType: { select: { label: true } }, photos: { where: { status: 'ACTIVE' }, select: { id: true } }, _count: { select: { reactions: true, comments: true } } },
  })
  return NextResponse.json({ post: full })
}

/**
 * F36: the author edits their own post. An edit to a post that needed
 * moderation (a community post by a member, or a District / State / National
 * post) goes back for approval.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const post = await load(params.id)
  if (!post || post.deletedAt || post.authorId !== session.user.id) return NextResponse.json({ message: 'Post not found' }, { status: 404 })
  if (['REMOVED', 'FLAGGED', 'HIDDEN'].includes(post.status)) return NextResponse.json({ message: 'This post is under review or removed' }, { status: 409 })
  const body = await req.json().catch(() => ({}))
  const content = body.content !== undefined ? String(body.content).trim() : post.content
  if (!content || content.length > 5000) return NextResponse.json({ message: 'Write the post (up to 5000 characters)' }, { status: 400 })
  const title = body.title !== undefined ? (String(body.title).trim().slice(0, 191) || null) : post.title
  const roles = ((session.user as any).roles ?? []) as string[]
  const moderated = (post.audienceType === 'COMMUNITY' && !roles.includes('ADMIN') && !roles.includes('OPERATOR'))
    || (BODY_MODERATED.includes(post.audienceType) && !roles.includes('ADMIN'))
  const status = moderated && post.status === 'PUBLISHED' ? 'PENDING_APPROVAL' : post.status
  await prisma.post.update({ where: { id: post.id }, data: { content, title, status } })
  await recordAudit({ actorId: session.user.id, action: 'post.edit', entityType: 'post', entityId: post.id, oldValue: { title: post.title, content: post.content, status: post.status }, newValue: { title, content, status } }, req)
  return NextResponse.json({ message: status === 'PENDING_APPROVAL' && post.status === 'PUBLISHED' ? 'Saved. It will show again once a moderator approves the change.' : 'Saved', status })
}

/** F36: the author deletes their own post (or a moderator removes it). Kept for history. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const post = await load(params.id)
  if (!post || post.deletedAt) return NextResponse.json({ message: 'Post not found' }, { status: 404 })
  if (post.authorId !== session.user.id && !(await canModeratePost(session, post))) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  await prisma.post.update({ where: { id: post.id }, data: { deletedAt: new Date() } })
  await recordAudit({ actorId: session.user.id, action: 'post.delete', entityType: 'post', entityId: post.id, oldValue: { status: post.status } }, req)
  return NextResponse.json({ message: 'Post deleted' })
}
