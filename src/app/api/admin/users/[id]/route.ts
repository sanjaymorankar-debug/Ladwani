import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const roles: string[] = (session?.user as any)?.roles ?? []
  if (!roles.includes('ADMIN')) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      member: { select: { firstName: true, lastName: true, memberNumber: true } },
      userRoles: { include: { role: true } },
    },
  })
  if (!user) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  return NextResponse.json(user)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const roles: string[] = (session?.user as any)?.roles ?? []
  if (!roles.includes('ADMIN')) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  if (body.status) {
    await prisma.user.update({ where: { id: params.id }, data: { status: body.status as any } })
    await prisma.auditLog.create({
      data: {
        actorId: session!.user!.id as string,
        actorRole: 'ADMIN',
        action: 'admin.user.status_change',
        entityType: 'user',
        entityId: params.id,
        newValue: { status: body.status },
      },
    })
  }

  if (body.toggleRole) {
    const roleRecord = await prisma.role.findUnique({ where: { code: body.toggleRole } })
    if (!roleRecord) return NextResponse.json({ message: 'Role not found' }, { status: 404 })
    const existing = await prisma.userRole.findFirst({ where: { userId: params.id, roleId: roleRecord.id } })
    if (existing) {
      await prisma.userRole.delete({ where: { id: existing.id } })
    } else {
      await prisma.userRole.create({ data: { userId: params.id, roleId: roleRecord.id, grantedBy: session!.user!.id as string } })
    }
  }

  return NextResponse.json({ message: 'Updated' })
}
