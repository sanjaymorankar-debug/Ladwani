import { NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const { mobile, email, otp } = await req.json()
    const identifier = mobile ?? email
    if (!identifier || !otp) {
      return NextResponse.json({ message: 'Identifier and OTP are required' }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: mobile ? { mobile } : { email },
      include: {
        verificationTokens: {
          where: {
            // Accept either kind: sign-up now verifies by email, but older
            // accounts may still hold an unused mobile token.
            type: { in: ['EMAIL_VERIFY', 'MOBILE_VERIFY'] },
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    const token = user.verificationTokens[0]
    if (!token) {
      return NextResponse.json({ message: 'No valid OTP found. Please request a new one.' }, { status: 400 })
    }

    const isValid = await compare(otp.toString(), token.tokenHash)
    if (!isValid) {
      return NextResponse.json({ message: 'Invalid OTP. Please try again.' }, { status: 400 })
    }

    // Mark token as used and activate user
    await prisma.$transaction([
      prisma.verificationToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          // Mark whichever channel the token was actually issued for, not
          // whichever identifier the caller happened to log in with.
          emailVerified: token.type === 'EMAIL_VERIFY' ? true : undefined,
          mobileVerified: token.type === 'MOBILE_VERIFY' ? true : undefined,
          status: 'ACTIVE',
        },
      }),
    ])

    return NextResponse.json({ message: 'Verified successfully' })
  } catch (e) {
    console.error('[verify-otp]', e)
    return NextResponse.json({ message: 'Verification failed. Try again.' }, { status: 500 })
  }
}
