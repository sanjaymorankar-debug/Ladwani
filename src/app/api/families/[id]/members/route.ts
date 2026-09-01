import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateMemberNumber } from '@/lib/utils'
import { canManageFamily, canViewFamily } from '@/lib/family-auth'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  if (!(await canViewFamily(session, params.id))) {
    return NextResponse.json({ message: 'You do not have access to this family' }, { status: 403 })
  }

  const members = await prisma.familyMember.findMany({
    where: { familyId: params.id, leftAt: null },
    include: {
      member: { select: { id: true, firstName: true, lastName: true, maritalStatus: true, gender: true, status: true } },
    },
  })

  return NextResponse.json({ members: members.map((fm: any) => ({ ...fm.member, isKarta: fm.isKarta })) })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const userId = session.user?.id as string

  // Check family exists and user has access
  const family = await prisma.family.findUnique({ where: { id: params.id } })
  if (!family) return NextResponse.json({ message: 'Family not found' }, { status: 404 })

  if (!(await canManageFamily(session, params.id))) {
    return NextResponse.json({ message: 'Only this family\'s Karta can add members' }, { status: 403 })
  }

  // Duplicate detection: don't silently create a second Member record for
  // someone who's already in the system. Search by mobile/email (exact) and
  // by name+DOB (a looser match) before creating anything.
  if (!body.forceCreate) {
    const candidates = await prisma.member.findMany({
      where: {
        deletedAt: null,
        OR: [
          body.mobilePrimary ? { mobilePrimary: body.mobilePrimary } : undefined,
          body.email ? { email: body.email } : undefined,
          body.firstName && body.dateOfBirth
            ? {
                firstName: { equals: body.firstName, mode: 'insensitive' },
                lastName: body.lastName ? { equals: body.lastName, mode: 'insensitive' } : undefined,
                dateOfBirth: new Date(body.dateOfBirth),
              }
            : undefined,
        ].filter(Boolean) as any[],
      },
      select: {
        id: true, memberNumber: true, firstName: true, middleName: true, lastName: true,
        gender: true, dateOfBirth: true, mobilePrimary: true, email: true, currentCity: true,
      },
      take: 5,
    })

    if (candidates.length > 0) {
      return NextResponse.json(
        {
          message: 'This person may already be registered. Review the matches or confirm to add as new.',
          possibleDuplicates: candidates,
        },
        { status: 409 }
      )
    }
  }

  const result = await prisma.$transaction(async (tx: any) => {
    // Create member
    const member = await tx.member.create({
      data: {
        memberNumber: generateMemberNumber(),
        firstName: body.firstName,
        middleName: body.middleName || null,
        lastName: body.lastName || null,
        gender: body.gender,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        dateOfBirthApprox: body.dateOfBirthApprox ?? false,
        bloodGroup: body.bloodGroup || null,
        mobilePrimary: body.mobilePrimary || null,
        email: body.email || null,
        currentCity: body.currentCity || null,
        currentState: body.currentState || null,
        currentCountry: body.currentCountry || 'India',
        nativeVillage: body.nativeVillage || null,
        nativeDistrict: body.nativeDistrict || null,
        nativeState: body.nativeState || null,
        maritalStatus: body.maritalStatus || 'UNMARRIED',
        employmentStatus: body.employmentStatus || null,
        occupationCategory: body.occupationCategory || null,
        biography: body.biography || null,
        createdBy: userId,
      },
    })

    // Add to family
    await tx.familyMember.create({
      data: { familyId: params.id, memberId: member.id, joinedBy: userId },
    })

    // Create relationship if specified
    if (body.relatedToMemberId && body.relationshipTypeCode) {
      const relType = await tx.relationshipType.findUnique({ where: { code: body.relationshipTypeCode } })
      if (relType) {
        await tx.memberRelationship.create({
          data: {
            fromMemberId: member.id,
            toMemberId: body.relatedToMemberId,
            relationshipTypeId: relType.id,
            familyId: params.id,
            createdBy: userId,
          },
        })
        // Inverse relationship
        if (relType.inverseCode) {
          const inverseType = await tx.relationshipType.findUnique({ where: { code: relType.inverseCode } })
          if (inverseType) {
            await tx.memberRelationship.create({
              data: {
                fromMemberId: body.relatedToMemberId,
                toMemberId: member.id,
                relationshipTypeId: inverseType.id,
                familyId: params.id,
                createdBy: userId,
              },
            })
          }
        }
      }
    }

    // Education record
    if (body.educationLevel) {
      await tx.educationRecord.create({
        data: {
          memberId: member.id,
          level: body.educationLevel,
          qualification: body.educationQualification || null,
          institution: body.educationInstitution || null,
          yearCompleted: body.educationYear ? parseInt(body.educationYear) : null,
          isHighest: true,
        },
      })
    }

    // Audit log
    await tx.auditLog.create({
      data: {
        actorId: userId,
        actorRole: ((session.user as any)?.roles ?? ['MEMBER'])[0],
        action: 'family.member.add',
        entityType: 'member',
        entityId: member.id,
        newValue: { firstName: member.firstName, lastName: member.lastName, familyId: params.id },
      },
    })

    return member
  })

  return NextResponse.json({ message: 'Member added', memberId: result.id }, { status: 201 })
}
