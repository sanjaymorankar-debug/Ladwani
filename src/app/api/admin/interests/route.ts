import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { json } from '@/lib/additional-details/http'

/** Admin: the whole hobby master, pending "Other" suggestions first, with usage counts. */
export async function GET() {
  const session = await getServerSession(authOptions)
  const roles = (((session?.user as any)?.roles ?? []) as string[])
  if (!roles.includes('ADMIN')) return json({ message: 'Forbidden' }, 403)
  const interests = await prisma.interest.findMany({
    include: { _count: { select: { hobbies: true, sports: true } } },
    orderBy: [{ status: 'asc' }, { category: 'asc' }, { sortOrder: 'asc' }],
  })
  const rank = (s: string | null) => (s === 'PENDING' ? 0 : s === 'APPROVED' ? 1 : 2)
  interests.sort((a, b) => rank(a.status) - rank(b.status))
  return json({ interests })
}

/** Admin adds a hobby directly. body: { name, category, isSport?, isChildSafe? } */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const roles = (((session?.user as any)?.roles ?? []) as string[])
  if (!roles.includes('ADMIN')) return json({ message: 'Forbidden' }, 403)
  const body = await req.json().catch(() => ({}))
  const name = String(body.name ?? '').trim()
  if (name.length < 2) return json({ message: 'Name is required' }, 400)
  const { slugify } = await import('@/lib/interest-master')
  const slug = slugify(name)
  if (await prisma.interest.findUnique({ where: { slug } })) return json({ message: 'A hobby with this name already exists' }, 409)
  const interest = await prisma.interest.create({
    data: {
      name, slug, category: String(body.category ?? 'Other'), isSport: !!body.isSport, isChildSafe: !!body.isChildSafe,
      status: 'APPROVED', reviewedBy: session!.user!.id as string, reviewedAt: new Date(),
    },
  })
  await prisma.auditLog.create({ data: { actorId: session!.user!.id as string, actorRole: 'ADMIN', action: 'interest.create', entityType: 'interest', entityId: interest.id, newValue: { name } } })
  return json({ interest }, 201)
}
