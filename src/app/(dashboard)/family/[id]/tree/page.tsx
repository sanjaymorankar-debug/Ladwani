import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import FamilyTreeClient from './TreeClient'

export default async function FamilyTreePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return null

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
                include: { relationshipType: true },
              },
            },
          },
        },
      },
    },
  })

  if (!family) notFound()

  const memberIds = new Set(family.members.map((fm: any) => fm.memberId))

  const nodes = family.members.map((fm: any) => ({
    id: fm.member.id,
    type: 'memberNode' as const,
    data: {
      id: fm.member.id,
      firstName: fm.member.firstName,
      lastName: fm.member.lastName ?? '',
      gender: fm.member.gender,
      maritalStatus: fm.member.maritalStatus,
      status: fm.member.status,
      dateOfBirth: fm.member.dateOfBirth?.toISOString() ?? null,
      currentCity: fm.member.currentCity ?? '',
      isKarta: fm.isKarta,
    },
    position: { x: 0, y: 0 },
  }))

  const edges: any[] = []
  for (const fm of family.members) {
    for (const rel of fm.member.relationshipsFrom) {
      if (memberIds.has(rel.toMemberId)) {
        edges.push({
          id: `edge-${rel.id}`,
          source: fm.member.id,
          target: rel.toMemberId,
          label: rel.relationshipType.label,
          type: rel.relationshipType.isSpouse ? 'spouse' : 'smoothstep',
          animated: rel.relationshipType.isSpouse,
          style: rel.relationshipType.isSpouse
            ? { stroke: '#f97316', strokeWidth: 2, strokeDasharray: '5 3' }
            : { stroke: '#94a3b8', strokeWidth: 1.5 },
          labelStyle: { fontSize: 9, fill: '#64748b' },
        })
      }
    }
  }

  return (
    <FamilyTreeClient
      familyId={params.id}
      familyName={family.name}
      nodes={nodes}
      edges={edges}
      memberCount={family.members.length}
    />
  )
}
