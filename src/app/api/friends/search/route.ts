import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { areaChain, chainLevel } from '@/lib/locations'

/**
 * F35 step 1: find members by name, Gotra, Mul Gaon or district. Shows name,
 * Person ID, Mul Gaon and family name only — no contact details.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  const me = (session?.user as any)?.memberId as string | null
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const p = new URL(req.url).searchParams
  const q = (p.get('q') ?? '').trim()
  const gotra = (p.get('gotra') ?? '').trim()
  const mulGaon = (p.get('mulGaon') ?? '').trim()
  const district = (p.get('district') ?? '').trim()
  if (!q && !gotra && !mulGaon && !district) return NextResponse.json({ people: [] })

  let areaIds: string[] | null = null
  if (mulGaon || district) {
    const areas = await prisma.area.findMany({ where: { name: { contains: mulGaon || district, mode: 'insensitive' }, type: mulGaon ? { in: ['VILLAGE', 'CITY'] } : 'DISTRICT' }, select: { id: true } })
    areaIds = areas.map((a) => a.id)
    if (district) {
      // Villages / cities under those districts (two levels of talukas at most).
      const talukas = await prisma.area.findMany({ where: { parentId: { in: areaIds } }, select: { id: true } })
      const villages = await prisma.area.findMany({ where: { parentId: { in: talukas.map((t) => t.id) } }, select: { id: true } })
      areaIds = [...areaIds, ...talukas.map((t) => t.id), ...villages.map((v) => v.id)]
    }
  }
  const people = await prisma.member.findMany({
    where: {
      id: me ? { not: me } : undefined, deletedAt: null, status: 'ACTIVE', user: { status: 'ACTIVE' },
      ...(q ? { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }] } : {}),
      ...(gotra ? { families: { some: { leftAt: null, family: { gotra: { contains: gotra, mode: 'insensitive' } } } } } : {}),
      ...(areaIds ? { memberAreas: { some: { isPrimary: true, areaId: { in: areaIds } } } } : {}),
    },
    select: {
      id: true, firstName: true, lastName: true, memberNumber: true,
      memberAreas: { where: { isPrimary: true }, select: { areaId: true } },
      families: { where: { leftAt: null }, select: { family: { select: { name: true, gotra: true } } }, take: 2 },
    },
    take: 30,
  })
  const out = []
  for (const m of people) {
    const chain = m.memberAreas[0] ? await areaChain(m.memberAreas[0].areaId) : []
    out.push({
      memberId: m.id, name: [m.firstName, m.lastName].filter(Boolean).join(' '), memberNumber: m.memberNumber,
      mulGaon: chain[0]?.name ?? null, district: chainLevel(chain, 'DISTRICT')?.name ?? null,
      families: m.families.map((f) => f.family.name), gotra: m.families[0]?.family.gotra ?? null,
    })
  }
  return NextResponse.json({ people: out })
}
