import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { registerSchema } from '@/lib/validators'
import { generateMemberNumber } from '@/lib/utils'
import { requireAccountVerification } from '@/lib/auth-config'
import { sendEmail, otpEmailTemplate, isEmailConfigured } from '@/lib/email'
import { randomInt } from 'crypto'
import { validateSettlement, chainText } from '@/lib/locations'
import { requestIp } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = registerSchema.safeParse({ ...body, confirmPassword: body.password, consentAccepted: true })
    
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.errors[0].message }, { status: 400 })
    }
    const data = parsed.data

    const mobile = data.mobile || null

    // F01 step 4: Mul Gaon chosen from the location master (State > District > Taluka > Village).
    const place = await validateSettlement(data.mulGaonAreaId)
    if ('error' in place) return NextResponse.json({ message: place.error }, { status: 400 })
    const native = chainText(place.chain)

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
          // F01: a new account is DRAFT (may only fill in its own profile)
          // until two operators approve it; PENDING first if the email must
          // be verified before it can sign in at all.
          status: requireAccountVerification ? 'PENDING' : 'DRAFT',
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
          gender: data.gender,
          dateOfBirth: new Date(data.dateOfBirth),
          mobilePrimary: mobile,
          email: data.email,
          nativeVillage: native.village,
          nativeDistrict: native.district,
          nativeState: native.state,
          status: 'ACTIVE',
        },
      })
      // Mul Gaon is the member's home area: it decides which district's
      // Operators verify them and which District/State teams see them.
      await tx.memberArea.create({ data: { memberId: member.id, areaId: place.chain[0].id, isPrimary: true } })

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
          ipAddress: requestIp(req),
          userAgent: req.headers.get('user-agent'),
        },
      })

      if (requireAccountVerification) {
        const otp = randomInt(100000, 1000000).toString()
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
      // Log the code locally when there's no mail server, or when explicitly
      // asked for during development. Hard-guarded against production so a
      // stray env var can never leak live verification codes to the logs.
      const debugOtp =
        process.env.NODE_ENV !== 'production' &&
        (!isEmailConfigured() || process.env.AUTH_DEBUG_OTP === 'true')
      if (debugOtp) {
        console.log(`[DEV] Verification code for ${data.email}: ${result.otp}`)
      }
    }

    // F01 alert: welcome message.
    await notifyUser({
      userId: result.userId, type: 'WELCOME', title: 'Welcome to LadWani',
      body: 'Complete your profile, upload your ID proof and submit it for verification to activate your account.',
    })

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
