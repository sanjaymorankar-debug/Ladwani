import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const post = await prisma.post.create({
    data: {
      authorId: session.user.id as string,
      postTypeId: body.postTypeId,
      title: body.title || null,
      content: body.content,
      visibility: body.visibility ?? 'COMMUNITY',
      eventDate: body.eventDate ? new Date(body.eventDate) : null,
      status: 'PUBLISHED',
    },
  })
  return NextResponse.json({ message: 'Created', postId: post.id }, { status: 201 })
}
