import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { familyDistrict } from '@/lib/family-rules'

/**
 * F16 — Karta hand-overs waiting on the caller: nominations to accept, and
 * (for an Operator / Admin) vacant families in their districts to confirm.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const roles = ((session.user as any).roles ?? []) as string[]
  const memberId = (session.user as any).memberId as string | null

  const nominations = memberId
    ? await prisma.kartaTransfer.findMany({ where: { kind: 'VOLUNTARY', status: 'PENDING', toMemberId: memberId } })
    : []

  let vacancies: Awaited<ReturnType<typeof prisma.kartaTransfer.findMany>> = []
  if (roles.includes('ADMIN') || roles.includes('OPERATOR')) {
    const all = await prisma.kartaTransfer.findMany({ where: { kind: 'VACANCY', status: 'PENDING' }, orderBy: { createdAt: 'asc' } })
    if (roles.includes('ADMIN')) vacancies = all
    else {
      const districts = new Set((await prisma.userRole.findMany({
        where: { userId: session.user.id, role: { code: 'OPERATOR' }, areaId: { not: null } }, select: { areaId: true },
      })).map((r) => r.areaId))
      for (const v of all) if (districts.has(await familyDistrict(v.familyId))) vacancies.push(v)
    }
  }

  const familyIds = Array.from(new Set([...nominations, ...vacancies].map((t) => t.familyId)))
  const memberIds = Array.from(new Set([...nominations, ...vacancies].flatMap((t) => [t.fromMemberId, t.suggestedMemberId]).filter(Boolean) as string[]))
  const [families, members] = await Promise.all([
    prisma.family.findMany({ where: { id: { in: familyIds } }, select: { id: true, name: true, registrationNumber: true } }),
    prisma.member.findMany({ where: { id: { in: memberIds } }, select: { id: true, firstName: true, lastName: true } }),
  ])
  const fam = new Map(families.map((f) => [f.id, f]))
  const mem = new Map(members.map((m) => [m.id, [m.firstName, m.lastName].filter(Boolean).join(' ')]))
  const shape = (t: (typeof nominations)[number]) => ({
    id: t.id, kind: t.kind, createdAt: t.createdAt, family: fam.get(t.familyId) ?? null,
    from: t.fromMemberId ? mem.get(t.fromMemberId) ?? null : null,
    suggested: t.suggestedMemberId ? { id: t.suggestedMemberId, name: mem.get(t.suggestedMemberId) ?? null } : null,
  })
  return NextResponse.json({ nominations: nominations.map(shape), vacancies: vacancies.map(shape) })
}
