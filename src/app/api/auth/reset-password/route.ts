import { NextResponse } from 'next/server'
import { hash, compare } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { randomInt } from 'crypto'
import { sendEmail, passwordResetEmailTemplate } from '@/lib/email'
import { requestIp } from '@/lib/audit'
import { tooManyRequests, LIMITS } from '@/lib/rate-limit'

export async function POST(req: Request) {
  try {
    const { mobile, email, otp, newPassword, step } = await req.json()
    const identifier = mobile ?? email
    // P6: counted per account before the lookup, so unknown accounts are
    // limited the same way (no enumeration) and a new IP doesn't reset it.
    const who = String(identifier ?? '').toLowerCase()
    const limited = step === 'request'
      ? tooManyRequests([`reset-request:${who}`, LIMITS.resetRequest], [`reset-request-ip:${requestIp(req) ?? 'unknown'}`, LIMITS.resetRequestIp])
      : step === 'confirm' ? tooManyRequests([`reset-confirm:${who}`, LIMITS.resetConfirm]) : null
    if (limited) return limited

    const user = await prisma.user.findFirst({
      where: mobile ? { mobile } : { email },
      include: { member: { select: { firstName: true } } },
    })

    if (!user) {
      // Don't reveal if user exists
      return NextResponse.json({ message: 'If that account exists, an OTP has been sent.' })
    }

    if (step === 'request') {
      // Generate and store OTP
      const otp = randomInt(100000, 1000000).toString()
      const otpHash = await hash(otp, 10)

      await prisma.verificationToken.create({
        data: {
          userId: user.id,
          type: 'PASSWORD_RESET',
          tokenHash: otpHash,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      })

      const name = user.member?.firstName ?? 'Member'
      if (email && user.email) {
        const template = passwordResetEmailTemplate(otp, name)
        await sendEmail({ to: user.email, ...template })
      }

      if (process.env.NODE_ENV !== 'production') console.log(`[DEV] Password reset OTP for ${identifier}: ${otp}`)
      return NextResponse.json({ message: 'OTP sent successfully' })
    }

    if (step === 'confirm') {
      if (!otp || !newPassword) {
        return NextResponse.json({ message: 'OTP and new password are required' }, { status: 400 })
      }

      const token = await prisma.verificationToken.findFirst({
        where: {
          userId: user.id,
          type: 'PASSWORD_RESET',
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      })

      if (!token) {
        return NextResponse.json({ message: 'OTP expired or not found. Request a new one.' }, { status: 400 })
      }

      const valid = await compare(otp.toString(), token.tokenHash)
      if (!valid) {
        return NextResponse.json({ message: 'Invalid OTP' }, { status: 400 })
      }

      const newHash = await hash(newPassword, 12)

      await prisma.$transaction([
        prisma.verificationToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
        prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: newHash, failedAttempts: 0, lockedUntil: null },
        }),
        prisma.refreshToken.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      ])

      return NextResponse.json({ message: 'Password reset successfully' })
    }

    return NextResponse.json({ message: 'Invalid step' }, { status: 400 })
  } catch (e) {
    console.error('[reset-password]', e)
    return NextResponse.json({ message: 'Something went wrong' }, { status: 500 })
  }
}
