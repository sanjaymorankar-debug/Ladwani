import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const member = await prisma.member.findUnique({
    where: { id: params.id, deletedAt: null },
    include: {
      education: true,
      employment: { include: { incomeRange: true } },
      businesses: true,
      skills: { include: { skill: true } },
    },
  })
  if (!member) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  return NextResponse.json(member)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const userId = session.user?.id as string
  const body = await req.json()

  const member = await prisma.member.findUnique({ where: { id: params.id }, include: { user: true } })
  if (!member) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  const roles: string[] = (session.user as any)?.roles ?? []
  const isOwn = member.user?.id === userId
  const canEdit = isOwn || roles.includes('ADMIN') || roles.includes('OPERATOR')
  if (!canEdit) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const updated = await prisma.member.update({
    where: { id: params.id },
    data: {
      firstName: body.firstName,
      middleName: body.middleName || null,
      lastName: body.lastName || null,
      gender: body.gender,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      bloodGroup: body.bloodGroup || null,
      mobilePrimary: body.mobilePrimary || null,
      email: body.email || null,
      currentCity: body.currentCity || null,
      currentState: body.currentState || null,
      currentCountry: body.currentCountry || null,
      nativeVillage: body.nativeVillage || null,
      nativeDistrict: body.nativeDistrict || null,
      nativeState: body.nativeState || null,
      maritalStatus: body.maritalStatus,
      employmentStatus: body.employmentStatus || null,
      occupationCategory: body.occupationCategory || null,
      biography: body.biography || null,
      updatedBy: userId,
    },
  })

  await prisma.auditLog.create({
    data: {
      actorId: userId,
      actorRole: roles[0] ?? 'MEMBER',
      action: 'member.profile.update',
      entityType: 'member',
      entityId: params.id,
    },
  })

  return NextResponse.json({ message: 'Updated', member: updated })
}
