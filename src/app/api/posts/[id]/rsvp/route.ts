import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { json } from '@/lib/additional-details/http'
import { getPostAccess } from '@/lib/interest-groups'

/** RSVP to a group event or meet-up. body: { response: 'GOING' | 'MAYBE' | 'NOT_GOING' } */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const { post, allowed } = await getPostAccess(session, params.id)
  if (!post || !allowed || post.status !== 'PUBLISHED') return json({ message: 'Not found' }, 404)
  if (post.groupPostKind !== 'EVENT') return json({ message: 'Not an event' }, 400)
  const body = await req.json().catch(() => ({}))
  if (!['GOING', 'MAYBE', 'NOT_GOING'].includes(body.response)) return json({ message: 'Choose Going, Maybe or Not going' }, 400)
  const userId = session.user.id as string
  await prisma.postRsvp.upsert({
    where: { postId_userId: { postId: post.id, userId } },
    update: { response: body.response },
    create: { postId: post.id, userId, response: body.response },
  })
  return json({ message: 'RSVP saved' })
}
