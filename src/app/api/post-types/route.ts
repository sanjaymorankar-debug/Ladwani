import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  // GROUP_* types belong to interest-group posts and are not offered on the community feed.
  const types = await prisma.postType.findMany({ where: { isActive: true, NOT: { code: { startsWith: 'GROUP_' } } }, orderBy: { code: 'asc' } })
  return NextResponse.json({ types })
}
