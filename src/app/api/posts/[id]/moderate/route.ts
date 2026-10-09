import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canModeratePost, alertAudience } from '@/lib/posts'

/**
 * Approve or reject a submitted post, or hide a published one. Community
 * posts: Operator / Admin (as before). F36: District / State / National posts
 * are moderated by that LadWani body's President or Secretary, or an Admin.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const roles = ((session.user as any).roles ?? []) as string[]
  const body = await req.json()
  const action = body.action as 'approve' | 'reject' | 'hide'
  if (!['approve', 'reject', 'hide'].includes(action)) {
    return NextResponse.json({ message: 'action must be approve, reject or hide' }, { status: 400 })
  }

  const post = await prisma.post.findUnique({ where: { id: params.id } })
  if (!post || post.deletedAt) return NextResponse.json({ message: 'Post not found' }, { status: 404 })
  if (!(await canModeratePost(session, post))) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  // Only a waiting post is approved or rejected; only a live one is hidden.
  const from = action === 'hide' ? ['PUBLISHED'] : ['PENDING_APPROVAL']
  if (!from.includes(post.status)) return NextResponse.json({ message: `A ${post.status.toLowerCase().replace('_', ' ')} post cannot be ${action}d` }, { status: 409 })

  const status = action === 'approve' ? 'PUBLISHED' : action === 'reject' ? 'REJECTED' : 'HIDDEN'

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.post.update({
      where: { id: post.id },
      data: {
        status,
        reviewedBy: session.user!.id as string,
        reviewedAt: new Date(),
        reviewNote: body.note ?? null,
      },
    })

    // Tell the author what happened to their post.
    await tx.notification.create({
      data: {
        recipientId: post.authorId,
        senderId: session.user!.id as string,
        type: 'APPROVAL_STATUS',
        title: action === 'approve' ? 'Your post is live' : action === 'reject' ? 'Your post was not approved' : 'Your post was hidden',
        body: body.note ?? null,
        data: { postId: post.id, status },
      },
    })

    await tx.auditLog.create({
      data: {
        actorId: session.user!.id as string,
        actorRole: roles.includes('ADMIN') ? 'ADMIN' : roles.includes('OPERATOR') ? 'OPERATOR' : 'BODY_OFFICER',
        action: `post.${action}`,
        entityType: 'post',
        entityId: post.id,
        oldValue: { status: post.status },
        newValue: { status, note: body.note ?? null },
      },
    })

    return result
  })

  if (updated.status === 'PUBLISHED') await alertAudience(updated)
  return NextResponse.json({ message: `Post ${action}d`, status: updated.status })
}
