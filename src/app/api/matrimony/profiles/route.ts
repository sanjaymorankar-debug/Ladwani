import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  visibleMatrimonyWhere, MATRIMONY_ELIGIBLE_STATUSES,
  isEligibleForMatrimony, matrimonyIneligibleReason,
} from '@/lib/matrimony'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const gender = url.searchParams.get('gender')
  const minAge = url.searchParams.get('minAge')
  const maxAge = url.searchParams.get('maxAge')
  const city = url.searchParams.get('city')
  const education = url.searchParams.get('education')

  const memberWhere: any = { status: 'ACTIVE' }
  if (gender) memberWhere.gender = gender
  if (city) memberWhere.currentCity = { contains: city, mode: 'insensitive' }
  if (minAge || maxAge) {
    const now = new Date()
    memberWhere.dateOfBirth = {}
    if (maxAge) memberWhere.dateOfBirth.gte = new Date(now.getFullYear() - parseInt(maxAge), now.getMonth(), now.getDate())
    if (minAge) memberWhere.dateOfBirth.lte = new Date(now.getFullYear() - parseInt(minAge), now.getMonth(), now.getDate())
  }
  if (education) memberWhere.education = { some: { level: education } }

  // Only members who opted in AND are still eligible (never married, or free
  // to remarry) appear here.
  const profiles = await prisma.matrimonialProfile.findMany({
    where: {
      ...visibleMatrimonyWhere,
      member: { ...memberWhere, maritalStatus: { in: MATRIMONY_ELIGIBLE_STATUSES } },
    },
    include: {
      member: {
        include: {
          education: { where: { isHighest: true }, take: 1 },
          employment: { where: { isCurrent: true }, take: 1 },
        },
      },
    },
    take: 30,
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json({ profiles })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { member: true },
  })

  if (!user?.member) return NextResponse.json({ message: 'Member profile required' }, { status: 400 })

  // Only members who are actually free to marry may create a listing.
  if (!isEligibleForMatrimony(user.member.maritalStatus)) {
    return NextResponse.json({ message: matrimonyIneligibleReason(user.member.maritalStatus) }, { status: 403 })
  }

  const existing = await prisma.matrimonialProfile.findUnique({ where: { memberId: user.member.id } })
  if (existing) return NextResponse.json({ message: 'Profile already exists', profileId: existing.id })

  const body = await req.json()
  const profile = await prisma.matrimonialProfile.create({
    data: {
      memberId: user.member.id,
      // Opt-in is explicit: a new profile is hidden until the member chooses
      // to publish it.
      isVisible: false,
      about: body.about ?? null,
      heightCm: body.heightCm ?? null,
      languages: body.languages ?? [],
      createdBy: session.user.id as string,
    },
  })

  return NextResponse.json({ profileId: profile.id }, { status: 201 })
}
