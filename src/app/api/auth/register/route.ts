import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { registerSchema } from '@/lib/validators'
import { generateMemberNumber } from '@/lib/utils'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = registerSchema.safeParse({ ...body, confirmPassword: body.password, consentAccepted: true })
    
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.errors[0].message }, { status: 400 })
    }
    const data = parsed.data

    // Check duplicate mobile
    const existingMobile = await prisma.user.findUnique({ where: { mobile: data.mobile } })
    if (existingMobile) {
      return NextResponse.json({ message: 'An account with this mobile number already exists.' }, { status: 409 })
    }

    // Check duplicate email if provided
    if (data.email) {
      const existingEmail = await prisma.user.findUnique({ where: { email: data.email } })
      if (existingEmail) {
        return NextResponse.json({ message: 'An account with this email already exists.' }, { status: 409 })
      }
    }

    const passwordHash = await hash(data.password, 12)

    // Get or create MEMBER role
    let memberRole = await prisma.role.findUnique({ where: { code: 'MEMBER' } })
    if (!memberRole) {
      memberRole = await prisma.role.create({ data: { code: 'MEMBER', label: 'Member', isSystem: true } })
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: data.email || null,
          mobile: data.mobile,
          passwordHash,
          // OTP verification is disabled until a real SMS provider is wired in,
          // so accounts are activated immediately at registration.
          status: 'ACTIVE',
          mobileVerified: true,
        },
      })

      // Create member profile
      const member = await tx.member.create({
        data: {
          memberNumber: generateMemberNumber(),
          userId: user.id,
          firstName: data.firstName,
          lastName: data.lastName,
          status: 'ACTIVE',
        },
      })

      // Assign MEMBER role
      await tx.userRole.create({
        data: { userId: user.id, roleId: memberRole!.id },
      })

      // Record consent
      await tx.consentRecord.create({
        data: {
          userId: user.id,
          consentType: 'PROFILE_STORAGE',
          granted: true,
          version: '1.0',
        },
      })

      return { userId: user.id, memberId: member.id }
    })

    return NextResponse.json({
      message: 'Account created. You can now sign in.',
      userId: result.userId,
    }, { status: 201 })
  } catch (e: any) {
    console.error('[register]', e)
    return NextResponse.json({ message: 'Registration failed. Please try again.' }, { status: 500 })
  }
}
