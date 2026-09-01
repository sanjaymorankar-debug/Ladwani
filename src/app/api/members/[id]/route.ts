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

  // Marrying someone links two people's records and the family tree, so it
  // always goes through the dedicated /spouse endpoint (which applies the
  // approval gate). Every other marital-status value is a simple field edit.
  if (body.maritalStatus === 'MARRIED' && member.maritalStatus !== 'MARRIED') {
    return NextResponse.json(
      { message: "To set status to Married, use the spouse-linking flow so the relationship can be recorded." },
      { status: 400 }
    )
  }

  const updated = await prisma.member.update({
    where: { id: params.id },
    data: {
      firstName: body.firstName,
      middleName: body.middleName || null,
      lastName: body.lastName || null,
      gender: body.gender,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      bloodGroup: body.bloodGroup || null,
      heightCm: body.heightCm ? parseInt(body.heightCm) : null,
      weightKg: body.weightKg ? parseInt(body.weightKg) : null,
      bodyType: body.bodyType || null,
      physicalDisability: body.physicalDisability || null,
      mobilePrimary: body.mobilePrimary || null,
      email: body.email || null,
      // Address fields are edited via /api/members/[id]/addresses now, which
      // keeps these flat copies in sync. Only touch them here if the caller
      // explicitly sent one — omitting a field must never blank it out.
      ...(body.currentCity !== undefined ? { currentCity: body.currentCity || null } : {}),
      ...(body.currentState !== undefined ? { currentState: body.currentState || null } : {}),
      ...(body.currentCountry !== undefined ? { currentCountry: body.currentCountry || null } : {}),
      ...(body.nativeVillage !== undefined ? { nativeVillage: body.nativeVillage || null } : {}),
      ...(body.nativeDistrict !== undefined ? { nativeDistrict: body.nativeDistrict || null } : {}),
      ...(body.nativeState !== undefined ? { nativeState: body.nativeState || null } : {}),
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
