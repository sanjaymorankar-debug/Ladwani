import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare, hash } from 'bcryptjs'
import { prisma } from './prisma'
import { requireAccountVerification, adminSecondFactorRequired } from './auth-config'
import { verifyOtp } from './otp'
import { BASE_PATH } from './api-path'

export type LoginErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_PENDING'

export interface AuthorizedUser {
  id: string
  email: string | null
  mobile: string | null
  name: string
  roles: string[]
  memberId: string | null
  status: string
}

export type LoginResult =
  | { ok: true; user: AuthorizedUser }
  | { ok: false; code: LoginErrorCode }

/** Account states that end any existing session on its next request. */
export const SESSION_BLOCKING_STATUSES = ['SUSPENDED', 'BLOCKED', 'DEACTIVATED']

/**
 * Roles and status straight from the database. Expired grants don't count,
 * and a role held for several areas is listed once.
 */
async function loadSessionClaims(userId: string) {
  const fresh = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      deletedAt: true,
      userRoles: {
        where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        select: { role: { select: { code: true } } },
      },
      member: { select: { id: true } },
    },
  })
  if (!fresh || fresh.deletedAt || SESSION_BLOCKING_STATUSES.includes(fresh.status)) return null
  return {
    roles: Array.from(new Set(fresh.userRoles.map((ur) => ur.role.code))),
    memberId: fresh.member?.id ?? null,
    status: fresh.status as string,
  }
}

const MAX_FAILED_ATTEMPTS = 5
const LOCK_DURATION_MS = 30 * 60 * 1000

/**
 * Single source of truth for "can this identifier+password log in right now".
 * Used by NextAuth's authorize() AND by /api/auth/login-check, so the UI can
 * surface a specific reason (suspended/locked/pending) before NextAuth
 * collapses every authorize() failure into a generic "CredentialsSignin".
 *
 * Account-state checks run only AFTER a correct password match, so a wrong
 * guess against an unknown or suspended identifier can't be used to enumerate
 * accounts — the caller only learns "suspended"/"locked"/"pending" once they
 * already knew the password.
 */
export async function validateLogin(identifier: string, password: string): Promise<LoginResult> {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { mobile: identifier }],
      deletedAt: null,
    },
    include: {
      userRoles: { include: { role: true } },
      member: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  if (!user) {
    return { ok: false, code: 'INVALID_CREDENTIALS' }
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { ok: false, code: 'ACCOUNT_LOCKED' }
  }

  const isValid = await compare(password, user.passwordHash)

  if (!isValid) {
    const attempts = user.failedAttempts + 1
    const updates: { failedAttempts: number; lockedUntil?: Date } = { failedAttempts: attempts }
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      updates.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS)
    }
    await prisma.user.update({ where: { id: user.id }, data: updates })
    return { ok: false, code: 'INVALID_CREDENTIALS' }
  }

  // Password confirmed correct — safe to reveal account-state now.
  if (user.status === 'SUSPENDED' || user.status === 'BLOCKED') {
    return { ok: false, code: 'ACCOUNT_SUSPENDED' }
  }
  // Only hold back unverified accounts when verification is actually switched
  // on. With it off there is no way for a PENDING user to verify, so blocking
  // them would strand anyone who registered before the switch.
  if (user.status === 'PENDING' && requireAccountVerification) {
    return { ok: false, code: 'ACCOUNT_PENDING' }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  })

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      mobile: user.mobile,
      name: user.member
        ? `${user.member.firstName} ${user.member.lastName ?? ''}`.trim()
        : (user.email ?? user.mobile ?? 'Member'),
      roles: user.userRoles.map((ur) => ur.role.code),
      memberId: user.member?.id ?? null,
      status: user.status,
    },
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  // next-auth redirects to these verbatim (it knows nothing of Next's
  // basePath), so they carry the prefix the app is served under: /ladwani on
  // bkesari.com, '' when served from the root of its own hostname.
  pages: {
    signIn: `${BASE_PATH}/login`,
    error: `${BASE_PATH}/login`,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.roles = (user as any).roles
        token.memberId = (user as any).memberId
        token.status = (user as any).status
      } else if (token.id) {
        // Roles and status are re-read from the database on every request,
        // so a revoked role or a suspended account takes effect at once
        // rather than when the 30-day token expires. Throwing here makes
        // getServerSession() return null and clears the session cookie.
        const claims = await loadSessionClaims(token.id as string)
        if (!claims) throw new Error('ACCOUNT_INACTIVE')
        token.roles = claims.roles
        token.memberId = claims.memberId
        token.status = claims.status
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        ;(session.user as any).roles = token.roles
        ;(session.user as any).memberId = token.memberId
        ;(session.user as any).status = token.status
      }
      return session
    },
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        identifier: { label: 'Email or Mobile', type: 'text' },
        password: { label: 'Password', type: 'password' },
        otp: { label: 'Admin verification code', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          throw new Error('INVALID_CREDENTIALS')
        }
        const result = await validateLogin(credentials.identifier, credentials.password)
        if (!result.ok) {
          throw new Error(result.code)
        }
        // F32: Admin login needs the emailed second-factor code as well.
        if (result.user.roles.includes('ADMIN') && adminSecondFactorRequired()) {
          if (!credentials.otp) throw new Error('OTP_REQUIRED')
          const check = await verifyOtp(result.user.id, 'ADMIN_2FA', credentials.otp)
          if (!check.ok) throw new Error('OTP_INVALID')
        }
        return result.user
      },
    }),
  ],
}

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, 12)
}
