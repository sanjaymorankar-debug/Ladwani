import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { homeAreas } from '@/lib/posts'

/** F36: the audiences the signed-in user can post to. */
export async function GET() {
  const session = await getServerSession(authOptions)
  const me = (session?.user as any)?.memberId as string | null
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const [families, lists, orgs, home] = await Promise.all([
    me ? prisma.familyMember.findMany({ where: { memberId: me, leftAt: null }, select: { family: { select: { id: true, name: true } } } }) : [],
    me ? prisma.friendList.findMany({ where: { ownerMemberId: me }, select: { id: true, name: true } }) : [],
    me ? prisma.organisationMember.findMany({ where: { memberId: me, status: 'ACTIVE' }, select: { organisationId: true } }) : [],
    homeAreas(me),
  ])
  const orgRows = await prisma.organisation.findMany({ where: { id: { in: orgs.map((o) => o.organisationId) }, status: 'ACTIVE' }, select: { id: true, name: true } })
  const areas = await prisma.area.findMany({ where: { id: { in: [home.district, home.state].filter(Boolean) as string[] } }, select: { id: true, name: true } })
  const areaName = (id: string | null) => areas.find((a) => a.id === id)?.name
  const options = [
    { type: 'COMMUNITY', id: null, label: 'Entire community (moderated)' },
    ...families.map((f) => ({ type: 'FAMILY', id: f.family.id, label: `${f.family.name} family` })),
    ...lists.map((l) => ({ type: 'FRIEND_LIST', id: l.id, label: `Friends: ${l.name}` })),
    ...orgRows.map((o) => ({ type: 'ORGANISATION', id: o.id, label: o.name })),
    ...(home.district ? [{ type: 'DISTRICT', id: home.district, label: `${areaName(home.district)} district (moderated by the District body)` }] : []),
    ...(home.state ? [{ type: 'STATE', id: home.state, label: `${areaName(home.state)} state (moderated by the State body)` }] : []),
    { type: 'NATIONAL', id: null, label: 'National (moderated by the National body)' },
  ]
  return NextResponse.json({ options })
}
