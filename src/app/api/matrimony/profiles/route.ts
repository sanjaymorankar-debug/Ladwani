import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { tooManyRequests, LIMITS } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'
import { visibleMatrimonyWhere } from '@/lib/matrimony'
import { requireActiveAccount } from '@/lib/account-state'
import { canBrowse, bureauEligibility, workbookRules, profileCards } from '@/lib/bureau'
import { profileFields } from '@/lib/bureau-fields'

/**
 * F38 search: age, education, occupation, district, Gotra (plus gender, city).
 * Returns limited cards only — no contact details, income as a band, same-Gotra
 * matches flagged.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const limited = tooManyRequests([`search:${session.user?.id}`, LIMITS.search])
  if (limited) return limited
  if (!(await canBrowse(session))) {
    return NextResponse.json({ message: 'Only members listed in the marriage bureau, and their Karta, can browse it.' }, { status: 403 })
  }

  const url = new URL(req.url)
  const p = (k: string) => url.searchParams.get(k)
  const memberWhere: any = { status: 'ACTIVE' }
  if (p('gender')) memberWhere.gender = p('gender')
  if (p('city')) memberWhere.currentCity = { contains: p('city') }
  if (p('minAge') || p('maxAge')) {
    const now = new Date()
    memberWhere.dateOfBirth = {}
    if (p('maxAge')) memberWhere.dateOfBirth.gte = new Date(now.getFullYear() - parseInt(p('maxAge')!) - 1, now.getMonth(), now.getDate() + 1)
    if (p('minAge')) memberWhere.dateOfBirth.lte = new Date(now.getFullYear() - parseInt(p('minAge')!), now.getMonth(), now.getDate())
  }
  if (p('education')) memberWhere.education = { some: { level: p('education') } }
  if (p('occupation')) memberWhere.OR = [{ occupationCategory: { contains: p('occupation') } }, { employmentStatus: { contains: p('occupation') } }]
  if (p('gotra')) memberWhere.families = { some: { leftAt: null, family: { gotra: { contains: p('gotra') } } } }
  if (p('district')) {
    const talukas = await prisma.area.findMany({ where: { parentId: p('district')! }, select: { id: true } })
    const villages = await prisma.area.findMany({ where: { parentId: { in: talukas.map((t) => t.id) } }, select: { id: true } })
    memberWhere.memberAreas = { some: { isPrimary: true, areaId: { in: [p('district')!, ...talukas.map((t) => t.id), ...villages.map((v) => v.id)] } } }
  }

  // Only members who opted in AND are still eligible appear here.
  const rows = await prisma.matrimonialProfile.findMany({
    where: { ...visibleMatrimonyWhere, member: { ...(visibleMatrimonyWhere.member as object), ...memberWhere } },
    select: { id: true, memberId: true },
    orderBy: { updatedAt: 'desc' },
    take: 60,
  })
  const strict = await workbookRules()
  const ids: string[] = []
  for (const r of rows) {
    if (ids.length >= 30) break
    if (!strict || (await bureauEligibility(r.memberId)).ok) ids.push(r.id)
  }
  return NextResponse.json({ profiles: await profileCards(ids, (session.user as any).memberId ?? null) })
}

/** F37: create one's bureau profile (hidden until the member turns it on). */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  // F01: a DRAFT / unapproved account may only fill in its own profile.
  const notActive = await requireActiveAccount(session.user?.id as string)
  if (notActive) return notActive

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { member: true } })
  if (!user?.member) return NextResponse.json({ message: 'Member profile required' }, { status: 400 })

  const eligible = await bureauEligibility(user.member.id)
  if (!eligible.ok) return NextResponse.json({ message: eligible.reason }, { status: 403 })

  const existing = await prisma.matrimonialProfile.findUnique({ where: { memberId: user.member.id } })
  if (existing) return NextResponse.json({ message: 'Profile already exists', profileId: existing.id })

  const fields = profileFields(await req.json().catch(() => ({})))
  if ('error' in fields) return NextResponse.json({ message: fields.error }, { status: 400 })
  const profile = await prisma.matrimonialProfile.create({
    data: {
      memberId: user.member.id,
      // Opt-in is explicit: a new profile is hidden until the member chooses to publish it.
      isVisible: false,
      ...fields.data,
      languages: (fields.data.languages as any) ?? [],
      createdBy: session.user.id as string,
    },
  })
  return NextResponse.json({ profileId: profile.id }, { status: 201 })
}

