import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const roles = ((session.user as any).roles ?? []) as string[]
  // Staff posts (announcements, moderation notices) go live immediately;
  // everything a member writes is held until an Operator or Admin approves it.
  const isStaff = roles.includes('ADMIN') || roles.includes('OPERATOR')

  const post = await prisma.post.create({
    data: {
      authorId: session.user.id as string,
      postTypeId: body.postTypeId,
      title: body.title || null,
      content: body.content,
      visibility: body.visibility ?? 'COMMUNITY',
      eventDate: body.eventDate ? new Date(body.eventDate) : null,
      status: isStaff ? 'PUBLISHED' : 'PENDING_APPROVAL',
      reviewedBy: isStaff ? (session.user.id as string) : null,
      reviewedAt: isStaff ? new Date() : null,
    },
  })

  return NextResponse.json(
    {
      message: isStaff
        ? 'Posted.'
        : 'Submitted. Your post will appear once a moderator approves it.',
      postId: post.id,
      status: post.status,
    },
    { status: 201 }
  )
}
