import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { compare, hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { currentPassword, newPassword } = await req.json()
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ message: 'Both passwords are required' }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ message: 'New password must be at least 8 characters' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 })

  const valid = await compare(currentPassword, user.passwordHash)
  if (!valid) return NextResponse.json({ message: 'Current password is incorrect' }, { status: 400 })

  const newHash = await hash(newPassword, 12)
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } }),
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorRole: ((session.user as any)?.roles ?? ['MEMBER'])[0],
        action: 'user.password.change',
        entityType: 'user',
        entityId: user.id,
      },
    }),
  ])

  return NextResponse.json({ message: 'Password changed successfully' })
}
