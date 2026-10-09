import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'
import { canModeratePost } from '@/lib/posts'

/** F36: delete one's own comment (or a moderator removes it). */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const comment = await prisma.comment.findUnique({ where: { id: params.id }, include: { post: true } })
  if (!comment || comment.deletedAt) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (comment.authorId !== session.user.id && !(await canModeratePost(session, comment.post))) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }
  await prisma.comment.update({ where: { id: comment.id }, data: { deletedAt: new Date() } })
  await recordAudit({ actorId: session.user.id, action: 'comment.delete', entityType: 'comment', entityId: comment.id, oldValue: { content: comment.content } }, req)
  return NextResponse.json({ message: 'Comment deleted' })
}
