import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare, hash } from 'bcryptjs'
import { prisma } from './prisma'

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
  if (user.status === 'PENDING') {
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
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.roles = (user as any).roles
        token.memberId = (user as any).memberId
        token.status = (user as any).status
      } else if (trigger === 'update' && token.id) {
        // Lets the client call useSession().update() to pick up a role/status
        // change (e.g. just became Karta) without forcing a full re-login —
        // JWT sessions otherwise only refresh these claims at sign-in time.
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          include: {
            userRoles: { include: { role: true } },
            member: { select: { id: true } },
          },
        })
        if (fresh) {
          token.roles = fresh.userRoles.map((ur) => ur.role.code)
          token.memberId = fresh.member?.id ?? null
          token.status = fresh.status
        }
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
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          throw new Error('INVALID_CREDENTIALS')
        }
        const result = await validateLogin(credentials.identifier, credentials.password)
        if (!result.ok) {
          throw new Error(result.code)
        }
        return result.user
      },
    }),
  ],
}

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, 12)
}
