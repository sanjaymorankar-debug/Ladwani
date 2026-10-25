import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { json } from '@/lib/additional-details/http'
import { GROUP_POST_TYPES, getGroupAccess, groupHasMinors, groupPostTypeId, notifyGroupPost } from '@/lib/interest-groups'

/**
 * Group posts reuse the community `posts` table (and its comments, reactions,
 * photos and moderation) with groupId set. They never appear in the
 * community feed and are readable only by the group's members and staff.
 *
 * GET ?kind=POST|QUESTION|KNOWLEDGE|EVENT|POLL
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const access = await getGroupAccess(session, params.id)
  if (!access.group) return json({ message: 'Not found' }, 404)
  if (!access.isMember && !access.isStaff) return json({ message: 'Join the group to see its posts' }, 403)

  const kind = new URL(req.url).searchParams.get('kind')
  const userId = session.user.id as string
  const canModerate = access.isModerator || access.isStaff
  const posts = await prisma.post.findMany({
    where: {
      groupId: params.id, deletedAt: null,
      ...(kind && GROUP_POST_TYPES[kind] ? { groupPostKind: kind } : {}),
      // Moderators also see posts waiting for them; authors see their own.
      OR: canModerate
        ? [{ status: { in: ['PUBLISHED', 'PENDING_APPROVAL', 'FLAGGED'] } }]
        : [{ status: 'PUBLISHED' }, { authorId: userId, status: 'PENDING_APPROVAL' }],
    },
    include: {
      author: { select: { member: { select: { id: true, firstName: true, lastName: true } } } },
      pollOptions: { orderBy: { sortOrder: 'asc' }, include: { _count: { select: { votes: true } } } },
      pollVotes: { where: { userId }, select: { optionId: true } },
      rsvps: { select: { userId: true, response: true } },
      photos: { where: { status: 'ACTIVE' }, select: { id: true } },
      _count: { select: { comments: { where: { status: 'ACTIVE', deletedAt: null } } } },
    },
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  })

  return json({
    posts: posts.map((p) => ({
      id: p.id, kind: p.groupPostKind, title: p.title, content: p.content, linkUrl: p.linkUrl, status: p.status,
      isPinned: p.isPinned, isSolved: !!p.isSolved, solvedCommentId: p.solvedCommentId, eventDate: p.eventDate, createdAt: p.createdAt,
      isMine: p.authorId === userId,
      author: p.author.member ? { id: p.author.member.id, name: `${p.author.member.firstName} ${p.author.member.lastName ?? ''}`.trim() } : null,
      commentCount: p._count.comments,
      photoIds: p.photos.map((ph) => ph.id),
      poll: p.groupPostKind === 'POLL'
        ? { options: p.pollOptions.map((o) => ({ id: o.id, label: o.label, votes: o._count.votes })), myVote: p.pollVotes[0]?.optionId ?? null }
        : null,
      rsvp: p.groupPostKind === 'EVENT'
        ? {
            going: p.rsvps.filter((r) => r.response === 'GOING').length,
            maybe: p.rsvps.filter((r) => r.response === 'MAYBE').length,
            mine: p.rsvps.find((r) => r.userId === userId)?.response ?? null,
          }
        : null,
    })),
  })
}

/** body: { kind, title?, content, linkUrl?, eventDate?, pollOptions?: string[] } */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const access = await getGroupAccess(session, params.id)
  if (!access.group) return json({ message: 'Not found' }, 404)
  if (!access.isMember && !access.isStaff) return json({ message: 'Join the group to post' }, 403)
  if (access.isMember && !access.membership!.rulesAcceptedAt) return json({ code: 'RULES_REQUIRED', message: 'Please read and accept the group rules first' }, 412)

  const body = await req.json().catch(() => ({}))
  const kind = String(body.kind ?? 'POST')
  if (!GROUP_POST_TYPES[kind]) return json({ message: 'Unknown post type' }, 400)
  const canModerate = access.isModerator || access.isStaff
  if (kind === 'KNOWLEDGE' && !canModerate) return json({ message: 'Only moderators add Knowledge guides — suggest one as a post instead' }, 403)
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 191) : ''
  if (!content && !title) return json({ message: 'Write something first' }, 400)
  if (content.length > 5000) return json({ message: 'Keep posts under 5000 characters' }, 400)
  let linkUrl: string | null = null
  if (body.linkUrl) {
    try {
      const u = new URL(String(body.linkUrl))
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error()
      linkUrl = u.toString()
    } catch {
      return json({ message: 'Enter a valid web link (http or https)' }, 400)
    }
  }
  let eventDate: Date | null = null
  if (kind === 'EVENT') {
    eventDate = body.eventDate ? new Date(body.eventDate) : null
    if (!eventDate || Number.isNaN(eventDate.getTime())) return json({ message: 'Events need a date and time' }, 400)
  }
  let options: string[] = []
  if (kind === 'POLL') {
    options = Array.isArray(body.pollOptions) ? body.pollOptions.map((o: unknown) => String(o).trim()).filter(Boolean) : []
    if (options.length < 2 || options.length > 6 || options.some((o) => o.length > 120)) return json({ message: 'Polls need 2 to 6 short options' }, 400)
  }

  // A child-safe group with members under 18 holds posts for a moderator,
  // like the community feed does; other groups publish straight away and
  // rely on reports + moderators.
  const held = !!access.group.isChildSafe && !canModerate && (await groupHasMinors(params.id))
  const post = await prisma.post.create({
    data: {
      authorId: session.user.id as string,
      postTypeId: await groupPostTypeId(kind),
      groupId: params.id,
      groupPostKind: kind,
      title: title || null,
      content: content || null,
      linkUrl,
      eventDate,
      visibility: 'GROUP',
      isPinned: kind === 'KNOWLEDGE',
      status: held ? 'PENDING_APPROVAL' : 'PUBLISHED',
      reviewedBy: held ? null : (session.user.id as string),
      reviewedAt: held ? null : new Date(),
      pollOptions: options.length ? { create: options.map((label, i) => ({ label, sortOrder: i })) } : undefined,
    },
  })
  if (!held) await notifyGroupPost(post.id)
  return json({ message: held ? 'Sent to the group moderator for approval' : 'Posted', postId: post.id, status: post.status }, 201)
}
