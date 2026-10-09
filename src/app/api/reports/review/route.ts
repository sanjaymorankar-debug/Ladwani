import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canModeratePost } from '@/lib/posts'
import { reviewItem, itemExists, REPORTABLE, type Reportable } from '@/lib/reports'
import { notifyUser } from '@/lib/notify'

/** A moderator restores a reported item (reports dismissed) or removes it. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const type = String(body.type) as Reportable
  const id = String(body.id ?? '')
  const action = body.action === 'remove' ? 'remove' : body.action === 'restore' ? 'restore' : null
  if (!REPORTABLE.includes(type) || !action) return NextResponse.json({ message: 'type and action (restore / remove) are required' }, { status: 400 })
  if (!(await itemExists(type, id))) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  const roles = ((session.user as any).roles ?? []) as string[]
  let allowed = roles.includes('ADMIN') || roles.includes('OPERATOR')
  // A District / State / National post may also be reviewed by that body.
  if (!allowed && type === 'post') allowed = await canModeratePost(session, await prisma.post.findUniqueOrThrow({ where: { id } }))
  if (!allowed) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  await reviewItem(type, id, action, session.user.id, body.note ?? null)
  const owner = type === 'post' ? (await prisma.post.findUnique({ where: { id } }))?.authorId
    : type === 'comment' ? (await prisma.comment.findUnique({ where: { id } }))?.authorId
    : (await prisma.photo.findUnique({ where: { id } }))?.uploadedBy
  if (owner && action === 'remove') {
    await notifyUser({ userId: owner, type: 'CONTENT_REMOVED', title: `Your ${type} was removed`, body: body.note ?? 'It broke the community guidelines.', data: { type, id } })
  }
  return NextResponse.json({ message: action === 'remove' ? 'Removed' : 'Restored' })
}
