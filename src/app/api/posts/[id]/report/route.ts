import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { json } from '@/lib/additional-details/http'
import { getPostAccess } from '@/lib/interest-groups'

const FLAG_AFTER_REPORTS = 3

/**
 * Report abuse. Uses the existing `reports` table; after three distinct
 * reports the post is FLAGGED (hidden) and lands in the existing moderation
 * queue at /admin/moderation, where it is approved back or hidden as usual.
 * body: { reason, description? }
 */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const { post, allowed } = await getPostAccess(session, params.id)
  if (!post || !allowed) return json({ message: 'Not found' }, 404)
  const body = await req.json().catch(() => ({}))
  const reason = String(body.reason ?? '').trim()
  if (!reason || reason.length > 191) return json({ message: 'Say briefly what is wrong' }, 400)
  const userId = session.user.id as string
  const already = await prisma.report.findFirst({ where: { reportableType: 'post', reportableId: post.id, reporterId: userId } })
  if (already) return json({ message: 'You have already reported this post' }, 409)

  await prisma.report.create({
    data: { reportableType: 'post', reportableId: post.id, reporterId: userId, reason, description: typeof body.description === 'string' ? body.description.slice(0, 2000) : null },
  })
  const count = await prisma.report.count({ where: { reportableType: 'post', reportableId: post.id, status: 'PENDING' } })
  if (count >= FLAG_AFTER_REPORTS && post.status === 'PUBLISHED') {
    await prisma.post.update({ where: { id: post.id }, data: { status: 'FLAGGED' } })
  }
  if (post.groupId) {
    const mods = await prisma.communityGroupMember.findMany({
      where: { groupId: post.groupId, leftAt: null, roleInGroup: 'MODERATOR' },
      include: { member: { select: { userId: true } } },
    })
    const ids = mods.map((m) => m.member.userId).filter((u): u is string => !!u && u !== userId)
    if (ids.length) {
      await prisma.notification.createMany({
        data: ids.map((recipientId) => ({ recipientId, type: 'MODERATION', title: 'A post in your group was reported', body: reason, data: { postId: post.id, groupId: post.groupId } })),
      })
    }
  }
  return json({ message: 'Thank you — moderators will review it' }, 201)
}
