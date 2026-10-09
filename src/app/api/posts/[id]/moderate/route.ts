import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPostAccess } from '@/lib/interest-groups'

/** Operator/Admin approve or reject a submitted post. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const roles = ((session.user as any).roles ?? []) as string[]
  // Staff moderate everything; an interest group's moderators moderate the
  // posts in their own group through this same flow.
  if (!roles.includes('ADMIN') && !roles.includes('OPERATOR') && !(await getPostAccess(session, params.id)).isModerator) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const action = body.action as 'approve' | 'reject' | 'hide'
  if (!['approve', 'reject', 'hide'].includes(action)) {
    return NextResponse.json({ message: 'action must be approve, reject or hide' }, { status: 400 })
  }

  const post = await prisma.post.findUnique({ where: { id: params.id } })
  if (!post || post.deletedAt) return NextResponse.json({ message: 'Post not found' }, { status: 404 })

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

    // Reports on this post are settled by the decision.
    await tx.report.updateMany({
      where: { reportableType: 'post', reportableId: post.id, status: 'PENDING' },
      data: { status: 'RESOLVED', resolvedBy: session.user!.id as string, resolvedAt: new Date(), resolutionNote: body.note ?? null },
    })

    await tx.auditLog.create({
      data: {
        actorId: session.user!.id as string,
        actorRole: roles[0] ?? 'GROUP_MODERATOR',
        action: `post.${action}`,
        entityType: 'post',
        entityId: post.id,
        oldValue: { status: post.status },
        newValue: { status, note: body.note ?? null },
      },
    })

    return result
  })

  return NextResponse.json({ message: `Post ${action}d`, status: updated.status })
}
