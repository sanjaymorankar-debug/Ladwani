import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { json } from '@/lib/additional-details/http'
import { getPostAccess } from '@/lib/interest-groups'

/** The asker marks their "Problem / need help" question solved. body: { commentId?, solved?: boolean } */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const { post, allowed } = await getPostAccess(session, params.id)
  if (!post || !allowed) return json({ message: 'Not found' }, 404)
  if (post.groupPostKind !== 'QUESTION') return json({ message: 'Only questions can be marked solved' }, 400)
  if (post.authorId !== session.user.id) return json({ message: 'Only the person who asked can mark it solved' }, 403)
  const body = await req.json().catch(() => ({}))
  const solved = body.solved !== false
  let commentId: string | null = null
  if (solved && body.commentId) {
    const c = await prisma.comment.findUnique({ where: { id: String(body.commentId) } })
    if (!c || c.postId !== post.id) return json({ message: 'Answer not found' }, 400)
    commentId = c.id
  }
  await prisma.post.update({
    where: { id: post.id },
    data: { isSolved: solved, solvedAt: solved ? new Date() : null, solvedCommentId: commentId },
  })
  return json({ message: solved ? 'Marked as solved' : 'Re-opened' })
}
