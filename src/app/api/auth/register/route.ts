import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { registerSchema } from '@/lib/validators'
import { generateMemberNumber } from '@/lib/utils'
import { requireAccountVerification } from '@/lib/auth-config'
import { sendEmail, otpEmailTemplate, isEmailConfigured } from '@/lib/email'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = registerSchema.safeParse({ ...body, confirmPassword: body.password, consentAccepted: true })
    
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.errors[0].message }, { status: 400 })
    }
    const data = parsed.data

    const mobile = data.mobile || null

    // Email is the primary identifier, so it's always checked.
    const existingEmail = await prisma.user.findUnique({ where: { email: data.email } })
    if (existingEmail) {
      return NextResponse.json({ message: 'An account with this email already exists.' }, { status: 409 })
    }

    // Mobile is optional now — only check it when one was supplied.
    if (mobile) {
      const existingMobile = await prisma.user.findUnique({ where: { mobile } })
      if (existingMobile) {
        return NextResponse.json({ message: 'An account with this mobile number already exists.' }, { status: 409 })
      }
    }

    const passwordHash = await hash(data.password, 12)

    // Get or create MEMBER role
    let memberRole = await prisma.role.findUnique({ where: { code: 'MEMBER' } })
    if (!memberRole) {
      memberRole = await prisma.role.create({ data: { code: 'MEMBER', label: 'Member', isSystem: true } })
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // Create user. joinIntent records the signup choice ("I'm the Karta of
      // a new family" vs "join an existing family") so the post-verification
      // flow can route correctly. It deliberately does NOT grant KARTA here —
      // roles are never taken from client input; the KARTA role is granted
      // server-side in POST /api/families once a family actually exists.
      // With verification off (the current default), the account is usable
      // straight away: email-or-mobile + password, nothing to confirm. The
      // verified flags stay false because nothing has actually been verified —
      // only `status` gates login, so this stays honest without locking anyone
      // out. Flip NEXT_PUBLIC_AUTH_REQUIRE_VERIFICATION to restore OTP.
      const user = await tx.user.create({
        data: {
          email: data.email,
          mobile,
          passwordHash,
          status: requireAccountVerification ? 'PENDING' : 'ACTIVE',
          mobileVerified: false,
          joinIntent: data.joinIntent,
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

      if (requireAccountVerification) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString()
        const otpHash = await hash(otp, 10)
        await tx.verificationToken.create({
          data: {
            userId: user.id,
            type: 'EMAIL_VERIFY',
            tokenHash: otpHash,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
          },
        })
        // Returned so the OTP can be emailed *after* the transaction commits —
        // sending inside it would hold a DB transaction open across a network
        // call, and a mail failure would roll back a perfectly good signup.
        return { userId: user.id, memberId: member.id, otp }
      }

      return { userId: user.id, memberId: member.id, otp: null as string | null }
    })

    if (result.otp) {
      const template = otpEmailTemplate(result.otp, data.firstName)
      try {
        await sendEmail({ to: data.email, ...template })
      } catch {
        // The account exists and the OTP is stored; surface the delivery
        // problem instead of pretending the mail went out.
        return NextResponse.json({
          message: 'Account created, but the verification email could not be sent. Please contact the administrator.',
          userId: result.userId,
          requiresVerification: true,
          emailDeliveryFailed: true,
        }, { status: 201 })
      }
      if (!isEmailConfigured()) {
        console.log(`[DEV] Verification OTP for ${data.email}: ${result.otp}`)
      }
    }

    return NextResponse.json({
      message: requireAccountVerification
        ? 'Account created. We sent a verification code to your email.'
        : 'Account created. You can sign in now.',
      userId: result.userId,
      // Lets the registration UI decide whether to show the OTP step without
      // duplicating the flag's interpretation client-side.
      requiresVerification: requireAccountVerification,
    }, { status: 201 })
  } catch (e: any) {
    console.error('[register]', e)
    return NextResponse.json({ message: 'Registration failed. Please try again.' }, { status: 500 })
  }
}
