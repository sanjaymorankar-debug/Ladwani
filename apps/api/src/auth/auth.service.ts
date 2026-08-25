import { createHash, randomBytes, randomInt } from 'crypto'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { compare, hash } from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { VerifyOtpDto } from './dto/verify-otp.dto'

const ACCESS_TOKEN_TTL = '15m'
const REFRESH_TOKEN_TTL_DAYS = 30
const OTP_TTL_MINUTES = 10
const MAX_FAILED_ATTEMPTS = 5
const LOCK_MINUTES = 30
const BCRYPT_COST = 12

export interface LoginResult {
  accessToken: string
  refreshToken: string
  user: { id: string; roles: string[]; memberId: string | null }
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ userId: string; otpForDev: string }> {
    const existingMobile = await this.prisma.user.findUnique({ where: { mobile: dto.mobile } })
    if (existingMobile) throw new ConflictException('An account with this mobile number already exists.')

    if (dto.email) {
      const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } })
      if (existingEmail) throw new ConflictException('An account with this email already exists.')
    }

    const passwordHash = await hash(dto.password, BCRYPT_COST)
    const memberRole = await this.getOrCreateMemberRole()

    const otp = randomInt(100000, 999999).toString()
    const otpHash = await hash(otp, BCRYPT_COST)

    const userId = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: dto.email ?? null, mobile: dto.mobile, passwordHash, status: 'PENDING' },
      })

      await tx.member.create({
        data: { userId: user.id, firstName: dto.firstName, lastName: dto.lastName },
      })

      await tx.userRole.create({ data: { userId: user.id, roleId: memberRole.id } })

      await tx.verificationToken.create({
        data: {
          userId: user.id,
          type: 'MOBILE_VERIFY',
          tokenHash: otpHash,
          expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
        },
      })

      return user.id
    })

    // No SMS provider is wired in yet (docs/18-file-storage-design.md's sibling
    // gap — SMS delivery is explicitly deferred, see docs/02 §17). Returning the
    // OTP directly is a development-only stand-in, never acceptable in production.
    return { userId, otpForDev: otp }
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<{ verified: true }> {
    const token = await this.prisma.verificationToken.findFirst({
      where: { userId: dto.userId, type: 'MOBILE_VERIFY', usedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    if (!token) throw new NotFoundException('No pending verification for this account.')
    if (token.expiresAt < new Date()) throw new BadRequestException('OTP has expired. Please request a new one.')

    const matches = await compare(dto.otp, token.tokenHash)
    if (!matches) throw new BadRequestException('Incorrect OTP.')

    await this.prisma.$transaction([
      this.prisma.verificationToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: dto.userId }, data: { mobileVerified: true, status: 'ACTIVE' } }),
    ])

    return { verified: true }
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.identifier }, { mobile: dto.identifier }], deletedAt: null },
      include: { userRoles: { include: { role: true } }, member: { select: { id: true } } },
    })
    if (!user) throw new UnauthorizedException('Invalid credentials.')

    if (user.status === 'SUSPENDED' || user.status === 'BLOCKED') {
      throw new ForbiddenException('Account suspended. Contact an administrator.')
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Account temporarily locked. Try again later.')
    }

    const valid = await compare(dto.password, user.passwordHash)
    if (!valid) {
      const attempts = user.failedAttempts + 1
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: attempts,
          lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : undefined,
        },
      })
      throw new UnauthorizedException('Invalid credentials.')
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    })

    const roles = user.userRoles.map((ur) => ur.role.code)
    const memberId = user.member?.id ?? null

    const accessToken = this.jwt.sign({ sub: user.id, roles, memberId }, { expiresIn: ACCESS_TOKEN_TTL })
    const refreshToken = await this.issueRefreshToken(user.id)

    return { accessToken, refreshToken, user: { id: user.id, roles, memberId } }
  }

  async refresh(rawRefreshToken: string): Promise<LoginResult> {
    const tokenHash = this.hashToken(rawRefreshToken)
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } })

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired. Please log in again.')
    }

    // Rotation: the presented token is single-use regardless of outcome.
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } })

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      include: { userRoles: { include: { role: true } }, member: { select: { id: true } } },
    })
    if (!user) throw new UnauthorizedException('Session expired. Please log in again.')

    const roles = user.userRoles.map((ur) => ur.role.code)
    const memberId = user.member?.id ?? null

    const accessToken = this.jwt.sign({ sub: user.id, roles, memberId }, { expiresIn: ACCESS_TOKEN_TTL })
    const refreshToken = await this.issueRefreshToken(user.id)

    return { accessToken, refreshToken, user: { id: user.id, roles, memberId } }
  }

  async logout(rawRefreshToken: string): Promise<{ loggedOut: true }> {
    const tokenHash = this.hashToken(rawRefreshToken)
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return { loggedOut: true }
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    const raw = randomBytes(48).toString('hex')
    const tokenHash = this.hashToken(raw)
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000) },
    })
    return raw
  }

  /** Refresh tokens are opaque and hashed at rest with a fast, deterministic hash
   *  (not bcrypt — we need to look them up by exact value, not compare-and-salt). */
  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex')
  }

  private async getOrCreateMemberRole() {
    const existing = await this.prisma.role.findUnique({ where: { code: 'MEMBER' } })
    if (existing) return existing
    return this.prisma.role.create({ data: { code: 'MEMBER', label: 'Member', isSystem: true } })
  }
}
