import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * F22 step 2 — people in another family that a family member may link to
 * (owner's decision: not only the Karta): name, gender and birth year only
 * (the limited family view of F14).
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const memberId = (session.user as any).memberId as string | null
  const roles = ((session.user as any).roles ?? []) as string[]
  const inAFamily = memberId && await prisma.familyMember.findFirst({ where: { memberId, leftAt: null } })
  if (!inAFamily && !roles.includes('ADMIN')) return NextResponse.json({ message: 'Only family members link trees' }, { status: 403 })

  const url = new URL(req.url)
  const familyId = url.searchParams.get('familyId') ?? ''
  const q = (url.searchParams.get('q') ?? '').trim()
  const rows = await prisma.familyMember.findMany({
    where: {
      familyId, leftAt: null,
      member: { deletedAt: null, ...(q ? { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }] } : {}) },
    },
    select: { member: { select: { id: true, firstName: true, lastName: true, gender: true, dateOfBirth: true, status: true } } },
    take: 30,
  })
  return NextResponse.json({
    people: rows.map(({ member: m }) => ({
      id: m.id, name: [m.firstName, m.lastName].filter(Boolean).join(' '), gender: m.gender,
      birthYear: m.dateOfBirth ? m.dateOfBirth.getFullYear() : null, late: m.status === 'DECEASED',
    })),
  })
}
