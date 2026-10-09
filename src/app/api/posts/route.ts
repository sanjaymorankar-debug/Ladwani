import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireActiveAccount } from '@/lib/account-state'
import { resolveAudience, feedWhere, alertAudience, AUTHOR_SELECT, BODY_MODERATED } from '@/lib/posts'

const MAX_CONTENT = 5000

/** F36 feed: published posts whose audience includes the viewer, newest first (pinned on top). */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const page = Math.max(1, Number(new URL(req.url).searchParams.get('page') ?? 1) || 1)
  const posts = await prisma.post.findMany({
    where: await feedWhere(session),
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    skip: (page - 1) * 30, take: 30,
    include: {
      author: AUTHOR_SELECT, postType: { select: { label: true, icon: true } },
      photos: { where: { status: 'ACTIVE' }, select: { id: true } },
      _count: { select: { comments: true, reactions: true } },
    },
  })
  return NextResponse.json({ posts, page })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  // F01: a DRAFT / unapproved account may only fill in its own profile.
  const notActive = await requireActiveAccount(session.user?.id as string)
  if (notActive) return notActive

  const body = await req.json().catch(() => ({}))
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content || content.length > MAX_CONTENT) return NextResponse.json({ message: `Write the post (up to ${MAX_CONTENT} characters)` }, { status: 400 })
  const postType = body.postTypeId ? await prisma.postType.findFirst({ where: { id: String(body.postTypeId), isActive: true } }) : null
  if (!postType) return NextResponse.json({ message: 'Choose a post category' }, { status: 400 })

  // F36: who the post is for.
  const audience = await resolveAudience(session, String(body.audienceType ?? 'COMMUNITY'), body.audienceId)
  if ('error' in audience) return NextResponse.json({ message: audience.error }, { status: 400 })

  const roles = ((session.user as any).roles ?? []) as string[]
  // Community posts: staff go live, members wait for an Operator / Admin (as
  // before). A family, friend list or organisation post goes straight to that
  // group. District / State / National posts wait for that body (or an Admin).
  const isStaff = roles.includes('ADMIN') || roles.includes('OPERATOR')
  const live = audience.type === 'COMMUNITY' ? isStaff
    : BODY_MODERATED.includes(audience.type) ? roles.includes('ADMIN')
    : true

  const post = await prisma.post.create({
    data: {
      authorId: session.user.id as string,
      postTypeId: postType.id,
      title: typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 191) : null,
      content,
      visibility: typeof body.visibility === 'string' ? body.visibility : 'COMMUNITY',
      audienceType: audience.type, audienceId: audience.id,
      eventDate: body.eventDate ? new Date(body.eventDate) : null,
      status: live ? 'PUBLISHED' : 'PENDING_APPROVAL',
      reviewedBy: live ? (session.user.id as string) : null,
      reviewedAt: live ? new Date() : null,
    },
  })
  if (live) await alertAudience(post)

  return NextResponse.json(
    {
      message: live ? 'Posted.' : 'Submitted. Your post will appear once a moderator approves it.',
      postId: post.id,
      status: post.status,
    },
    { status: 201 }
  )
}
