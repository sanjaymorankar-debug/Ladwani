import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.roles = (user as any).roles
        token.memberId = (user as any).memberId
        token.status = (user as any).status
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
        email: { label: 'Email', type: 'email' },
        mobile: { label: 'Mobile', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.password) throw new Error('Password required')
        const identifier = credentials.email || credentials.mobile
        if (!identifier) throw new Error('Email or mobile required')

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: identifier },
              { mobile: identifier },
            ],
            deletedAt: null,
          },
          include: {
            userRoles: { include: { role: true } },
            member: { select: { id: true, firstName: true, lastName: true } },
          },
        })

        if (!user) throw new Error('Invalid credentials')
        if (user.status === 'SUSPENDED' || user.status === 'BLOCKED') {
          throw new Error('Account suspended. Contact administrator.')
        }
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error('Account temporarily locked. Try again later.')
        }

        const isValid = await compare(credentials.password, user.passwordHash)

        if (!isValid) {
          // Increment failed attempts
          const attempts = user.failedAttempts + 1
          const updates: any = { failedAttempts: attempts }
          if (attempts >= 5) {
            updates.lockedUntil = new Date(Date.now() + 30 * 60 * 1000) // 30 min
          }
          await prisma.user.update({ where: { id: user.id }, data: updates })
          throw new Error('Invalid credentials')
        }

        // Reset failed attempts on success
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
          },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.member
            ? `${user.member.firstName} ${user.member.lastName ?? ''}`.trim()
            : user.email ?? user.mobile,
          roles: user.userRoles.map((ur: any) => ur.role.code),
          memberId: user.member?.id ?? null,
          status: user.status,
        }
      },
    }),
  ],
}


// ── Auth helpers used by legacy API routes ─────────────────────────
import { hash } from 'bcryptjs'
import { sign, verify } from 'jsonwebtoken'

const JWT_SECRET = process.env.NEXTAUTH_SECRET ?? 'dev-secret'
const ACCESS_TTL = '15m'
const REFRESH_TTL = '30d'

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return compare(plain, hashed)
}

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, 12)
}

export function generateAccessToken(payload: Record<string, unknown>): string {
  return sign(payload, JWT_SECRET, { expiresIn: ACCESS_TTL })
}

export function generateRefreshToken(payload: Record<string, unknown>): string {
  return sign(payload, JWT_SECRET, { expiresIn: REFRESH_TTL })
}

export function verifyToken(token: string): Record<string, unknown> | null {
  try {
    return verify(token, JWT_SECRET) as Record<string, unknown>
  } catch {
    return null
  }
}
