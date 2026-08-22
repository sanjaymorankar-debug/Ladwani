import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const family = await prisma.family.findUnique({
    where: { id: params.id },
    include: {
      members: {
        where: { leftAt: null },
        include: {
          member: {
            include: {
              relationshipsFrom: {
                where: { isActive: true },
                include: { relationshipType: true, toMember: { select: { id: true, firstName: true, lastName: true } } },
              },
            },
          },
        },
      },
    },
  })

  if (!family) return NextResponse.json({ message: 'Family not found' }, { status: 404 })

  // Build nodes + edges for ReactFlow
  const memberIds = new Set((family.members as any[]).map((fm) => fm.memberId))

  const nodes = (family.members as any[]).map((fm) => ({
    id: fm.member.id,
    type: 'memberNode',
    data: {
      id: fm.member.id,
      firstName: fm.member.firstName,
      lastName: fm.member.lastName,
      gender: fm.member.gender,
      maritalStatus: fm.member.maritalStatus,
      status: fm.member.status,
      dateOfBirth: fm.member.dateOfBirth,
      currentCity: fm.member.currentCity,
      isKarta: fm.isKarta,
    },
    position: { x: 0, y: 0 }, // layout computed client-side
  }))

  const edges: any[] = []
  for (const fm of (family.members as any)) {
    for (const rel of (fm.member.relationshipsFrom as any)) {
      if (memberIds.has(rel.toMemberId)) {
        edges.push({
          id: `edge-${rel.id}`,
          source: fm.member.id,
          target: rel.toMemberId,
          label: rel.relationshipType.label,
          type: rel.relationshipType.isSpouse ? 'spouse' : 'default',
          animated: rel.relationshipType.isSpouse,
          style: rel.relationshipType.isSpouse
            ? { stroke: '#f97316', strokeWidth: 2 }
            : { stroke: '#94a3b8', strokeWidth: 1.5 },
          labelStyle: { fontSize: 10, fill: '#64748b' },
        })
      }
    }
  }

  return NextResponse.json({ nodes, edges, familyName: family.name })
}
