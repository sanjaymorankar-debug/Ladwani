import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { genderedCode } from '@/lib/relations'
import { generateMemberNumber } from '@/lib/utils'
import { canManageFamily, canViewFamily } from '@/lib/family-auth'
import { requireActiveAccount } from '@/lib/account-state'
import { roleGenderError, familyUserIds } from '@/lib/family-rules'
import { recordAudit } from '@/lib/audit'

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
  // F01: a DRAFT / unapproved account may only fill in its own profile.
  const notActive = await requireActiveAccount(session.user?.id as string)
  if (notActive) return notActive

  const body = await req.json()
  const userId = session.user?.id as string

  // Check family exists and user has access
  const family = await prisma.family.findUnique({ where: { id: params.id } })
  if (!family) return NextResponse.json({ message: 'Family not found' }, { status: 404 })

  if (!(await canManageFamily(session, params.id))) {
    return NextResponse.json({ message: 'Only this family\'s Karta can add members' }, { status: 403 })
  }

  // F10: the relationship must suit the person's gender ('Daughter' needs Female),
  // and must be relative to someone actually in this family.
  const genderError = await roleGenderError(body.relationshipTypeCode, body.gender)
  if (genderError) return NextResponse.json({ message: genderError }, { status: 400 })
  if (body.relatedToMemberId) {
    const relative = await prisma.familyMember.findFirst({ where: { familyId: params.id, memberId: body.relatedToMemberId, leftAt: null } })
    if (!relative) return NextResponse.json({ message: 'The person this relationship is relative to is not in this family' }, { status: 400 })
  }

  // Duplicate detection: don't silently create a second Member record for
  // someone who's already in the system. Search by mobile/email (exact) and
  // by name+DOB (a looser match) before creating anything. members.email is
  // CITEXT, so the email match ignores letter case.
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
          // F10: name + father's name (when no DOB is known).
          body.firstName && body.fatherName && !body.dateOfBirth
            ? {
                firstName: { equals: body.firstName },
                relationshipsFrom: { some: { relationshipType: { code: { in: ['son', 'daughter'] } }, toMember: { firstName: { equals: String(body.fatherName).trim() }, gender: 'MALE' } } },
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

    // Add to family — rule 1: the membership row carries the role and relative-to.
    await tx.familyMember.create({
      data: {
        familyId: params.id, memberId: member.id, joinedBy: userId,
        relationshipRole: body.relationshipTypeCode || null,
        relativeToMemberId: body.relatedToMemberId || null,
      },
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
          // The inverse describes the relative, so it takes the relative's gender (a daughter's "mother" link is not "son").
          const relativeGender = (await tx.member.findUnique({ where: { id: body.relatedToMemberId }, select: { gender: true } }))?.gender
          const inverseType = await tx.relationshipType.findUnique({ where: { code: genderedCode(relType.inverseCode, relativeGender) } })
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

    await recordAudit({
      actorId: userId, actorRole: ((session.user as any)?.roles ?? ['MEMBER'])[0], action: 'family.member.add',
      entityType: 'member', entityId: member.id,
      newValue: {
        firstName: member.firstName, lastName: member.lastName, gender: member.gender, dateOfBirth: member.dateOfBirth,
        familyId: params.id, relationshipRole: body.relationshipTypeCode || null, relativeToMemberId: body.relatedToMemberId || null,
      },
    }, req, tx)

    return member
  })

  return NextResponse.json({ message: 'Member added', memberId: result.id }, { status: 201 })
}
