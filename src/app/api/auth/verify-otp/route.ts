import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyOtp } from '@/lib/otp'

export async function POST(req: Request) {
  try {
    const { mobile, email, otp } = await req.json()
    const identifier = mobile ?? email
    if (!identifier || !otp) {
      return NextResponse.json({ message: 'Identifier and OTP are required' }, { status: 400 })
    }

    const user = await prisma.user.findFirst({ where: mobile ? { mobile } : { email } })
    // Same answer for an unknown account as for a wrong code — no enumeration.
    if (!user) {
      return NextResponse.json({ message: 'Invalid or expired code. Please try again.' }, { status: 400 })
    }

    // Accept either kind: sign-up now verifies by email, but older accounts
    // may still hold an unused mobile token. A code dies after 5 wrong tries.
    const check = await verifyOtp(user.id, ['EMAIL_VERIFY', 'MOBILE_VERIFY'], otp.toString())
    if (!check.ok) {
      const message = check.reason === 'NO_CODE' ? 'No valid OTP found. Please request a new one.'
        : check.reason === 'TOO_MANY_ATTEMPTS' ? 'Too many wrong attempts. Please request a new code.'
        : 'Invalid OTP. Please try again.'
      return NextResponse.json({ message }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        // Mark whichever channel the token was actually issued for, not
        // whichever identifier the caller happened to log in with.
        emailVerified: check.type === 'EMAIL_VERIFY' ? true : undefined,
        mobileVerified: check.type === 'MOBILE_VERIFY' ? true : undefined,
        // F01: verified accounts start DRAFT; accounts verified before P1
        // (status PENDING from the old flow) follow the same path.
        ...(user.status === 'PENDING' ? { status: 'DRAFT' as const } : {}),
      },
    })

    return NextResponse.json({ message: 'Verified successfully' })
  } catch (e) {
    console.error('[verify-otp]', e)
    return NextResponse.json({ message: 'Verification failed. Try again.' }, { status: 500 })
  }
}
