import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canViewPost } from '@/lib/posts'
import { canViewPhoto } from '@/lib/photo-access'
import { fileReport, REPORTABLE, type Reportable } from '@/lib/reports'

const isModerator = (s: any) => ((s?.user?.roles ?? []) as string[]).some((r) => r === 'ADMIN' || r === 'OPERATOR')

/** What the reporter is reporting must be something they can see, and not their own. */
async function reportable(session: any, type: Reportable, id: string) {
  if (type === 'post') {
    const post = await prisma.post.findUnique({ where: { id } })
    return post && post.authorId !== session.user.id && (await canViewPost(session, post)) ? post : null
  }
  if (type === 'comment') {
    const c = await prisma.comment.findUnique({ where: { id }, include: { post: true } })
    return c && !c.deletedAt && c.authorId !== session.user.id && (await canViewPost(session, c.post)) ? c : null
  }
  const p = await prisma.photo.findUnique({ where: { id } })
  return p && p.uploadedBy !== session.user.id && (await canViewPhoto(session, p)) ? p : null
}

/** F34 / F36 report abuse on a post, comment or photo. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const type = String(body.type) as Reportable
  if (!REPORTABLE.includes(type)) return NextResponse.json({ message: 'Unknown item' }, { status: 400 })
  const reason = String(body.reason ?? '').trim()
  if (reason.length < 3) return NextResponse.json({ message: 'Say what is wrong' }, { status: 400 })
  if (!(await reportable(session, type, String(body.id ?? '')))) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  const result = await fileReport(type, String(body.id), session.user.id, reason.slice(0, 191), body.description ? String(body.description).slice(0, 2000) : null)
  if (result.duplicate) return NextResponse.json({ message: 'You have already reported this' }, { status: 409 })
  return NextResponse.json({ message: 'Thank you. A moderator will review it.', hidden: result.hidden }, { status: 201 })
}

/** Moderation queue: items with open reports (hidden ones first). */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  if (!isModerator(session)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const open = await prisma.report.findMany({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } }, orderBy: { createdAt: 'asc' }, take: 500 })
  const items = new Map<string, { type: string; id: string; reasons: string[]; count: number; hidden: boolean }>()
  for (const r of open) {
    const key = `${r.reportableType}:${r.reportableId}`
    const item = items.get(key) ?? { type: r.reportableType, id: r.reportableId, reasons: [], count: 0, hidden: false }
    item.count++; item.reasons.push(r.reason); item.hidden ||= r.status === 'UNDER_REVIEW'
    items.set(key, item)
  }
  return NextResponse.json({ items: Array.from(items.values()).sort((a, b) => Number(b.hidden) - Number(a.hidden) || b.count - a.count) })
}
