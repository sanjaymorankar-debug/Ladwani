import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.matrimonialProfile.findUnique({
    where: { id: params.id },
    include: {
      member: {
        include: {
          education: { where: { isHighest: true }, take: 1 },
          employment: { where: { isCurrent: true }, take: 1, include: { incomeRange: { select: { label: true } } } },
          families: { include: { family: { select: { name: true, nativeVillage: true } } }, take: 1 },
        },
      },
      preferences: true,
    },
  })

  if (!profile || !profile.isVisible) {
    return NextResponse.json({ message: 'Profile not found' }, { status: 404 })
  }

  return NextResponse.json({ profile })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Verify ownership
  const profile = await prisma.matrimonialProfile.findUnique({
    where: { id: params.id },
    include: { member: { select: { userId: true } } },
  })

  if (!profile) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  const roles: string[] = (session.user as any)?.roles ?? []
  const isOwner = profile.member.userId === session.user.id
  if (!isOwner && !roles.includes('ADMIN') && !roles.includes('OPERATOR')) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const updated = await prisma.matrimonialProfile.update({
    where: { id: params.id },
    data: {
      isVisible: body.isVisible !== undefined ? body.isVisible : undefined,
      about: body.about !== undefined ? body.about : undefined,
      heightCm: body.heightCm !== undefined ? body.heightCm : undefined,
      languages: body.languages !== undefined ? body.languages : undefined,
    },
  })

  return NextResponse.json({ profile: updated })
}
