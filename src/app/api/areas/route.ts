import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * F01/F02: public read of the location master for the cascading
 * State > District > Taluka > Village pickers (used before sign-in, at
 * registration). Active locations only, names and ids only.
 *   ?parentId=<id>  children of an area
 *   (none)          the states
 */
const LEVEL_TYPES = ['STATE', 'DISTRICT', 'TALUKA', 'VILLAGE', 'CITY']

export async function GET(req: Request) {
  const parentId = new URL(req.url).searchParams.get('parentId')
  const areas = await prisma.area.findMany({
    where: parentId
      ? { parentId, isActive: true, type: { in: LEVEL_TYPES } }
      : { isActive: true, type: 'STATE' },
    select: { id: true, name: true, type: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json({ areas }, { headers: { 'Cache-Control': 'public, max-age=300' } })
}
