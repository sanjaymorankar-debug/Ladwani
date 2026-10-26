import { randomInt } from 'crypto'
import { hash, compare } from 'bcryptjs'
import { prisma } from '@/lib/prisma'

/**
 * One-time codes (admin 2-factor login, declaration consent, account
 * verification). Codes come from a CSPRNG, only their bcrypt hash is stored,
 * issuing a new code retires any earlier unused one of the same type, and a
 * code is burned after OTP_MAX_ATTEMPTS wrong guesses.
 */
export const OTP_MAX_ATTEMPTS = 5
export const OTP_TTL_MINUTES = 10

export async function issueOtp(userId: string, type: string, ttlMinutes = OTP_TTL_MINUTES) {
  await prisma.verificationToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  })
  const code = randomInt(100000, 1000000).toString()
  const token = await prisma.verificationToken.create({
    data: {
      userId,
      type,
      tokenHash: await hash(code, 10),
      expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
    },
  })
  return { code, tokenId: token.id }
}

export type OtpCheck =
  | { ok: true; tokenId: string; type: string }
  | { ok: false; reason: 'NO_CODE' | 'INVALID' | 'TOO_MANY_ATTEMPTS' }

export async function verifyOtp(userId: string, types: string | string[], code: string): Promise<OtpCheck> {
  const token = await prisma.verificationToken.findFirst({
    where: {
      userId,
      type: { in: Array.isArray(types) ? types : [types] },
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!token) return { ok: false, reason: 'NO_CODE' }
  if (token.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.verificationToken.update({ where: { id: token.id }, data: { usedAt: new Date() } })
    return { ok: false, reason: 'TOO_MANY_ATTEMPTS' }
  }

  if (!/^\d{6}$/.test(String(code ?? '')) || !(await compare(String(code), token.tokenHash))) {
    const attempts = token.attempts + 1
    await prisma.verificationToken.update({
      where: { id: token.id },
      data: { attempts, ...(attempts >= OTP_MAX_ATTEMPTS ? { usedAt: new Date() } : {}) },
    })
    return { ok: false, reason: attempts >= OTP_MAX_ATTEMPTS ? 'TOO_MANY_ATTEMPTS' : 'INVALID' }
  }

  await prisma.verificationToken.update({ where: { id: token.id }, data: { usedAt: new Date() } })
  return { ok: true, tokenId: token.id, type: token.type }
}
