import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { json } from '@/lib/additional-details/http'

/** Hobby / sport master for the pickers, grouped by category. ?sports=true for sports only. */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const sportsOnly = new URL(req.url).searchParams.get('sports') === 'true'
  const interests = await prisma.interest.findMany({
    where: { status: 'APPROVED', isActive: true, ...(sportsOnly ? { isSport: true } : {}) },
    select: { id: true, name: true, category: true, isSport: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  const categories: Record<string, { id: string; name: string; isSport: boolean | null }[]> = {}
  for (const i of interests) (categories[i.category ?? 'Other'] ??= []).push({ id: i.id, name: i.name, isSport: i.isSport })
  return json({ categories })
}
