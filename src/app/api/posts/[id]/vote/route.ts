import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { json } from '@/lib/additional-details/http'
import { getPostAccess } from '@/lib/interest-groups'

/** One vote per person per poll; voting again changes the vote. body: { optionId } */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const { post, allowed } = await getPostAccess(session, params.id)
  if (!post || !allowed || post.status !== 'PUBLISHED') return json({ message: 'Not found' }, 404)
  if (post.groupPostKind !== 'POLL') return json({ message: 'Not a poll' }, 400)
  const body = await req.json().catch(() => ({}))
  const option = body.optionId ? await prisma.postPollOption.findUnique({ where: { id: String(body.optionId) } }) : null
  if (!option || option.postId !== post.id) return json({ message: 'Choose an option' }, 400)
  const userId = session.user.id as string
  await prisma.postPollVote.upsert({
    where: { postId_userId: { postId: post.id, userId } },
    update: { optionId: option.id },
    create: { postId: post.id, optionId: option.id, userId },
  })
  return json({ message: 'Vote recorded' })
}
