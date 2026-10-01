import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** Active skills from the master list, optionally filtered by ?q= - feeds the profile picker (section 20). */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const q = new URL(req.url).searchParams.get('q')?.trim()
  const skills = await prisma.skill.findMany({
    where: { isActive: true, ...(q ? { name: { contains: q } } : {}) },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    take: 50,
    select: { id: true, name: true, category: true },
  })
  return NextResponse.json({ skills })
}
