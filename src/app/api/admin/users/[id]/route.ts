import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const TEAM_AREA_TYPE: Record<string, string> = { DISTRICT_TEAM: 'DISTRICT', STATE_TEAM: 'STATE' }

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const roles: string[] = (session?.user as any)?.roles ?? []
  if (!roles.includes('ADMIN')) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      member: { select: { firstName: true, lastName: true, memberNumber: true } },
      userRoles: { include: { role: true, area: { select: { id: true, name: true, type: true } } } },
    },
  })
  if (!user) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  // Districts and states for scoping the community-team roles.
  const teamAreas = await prisma.area.findMany({ where: { type: { in: ['DISTRICT', 'STATE'] }, isActive: true }, select: { id: true, name: true, type: true }, orderBy: { name: 'asc' } })
  return NextResponse.json({ ...user, teamAreas })
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
    // District and State teams are scoped to an area (user_roles.areaId), so
    // the same person can serve more than one district.
    const teamAreaType = TEAM_AREA_TYPE[roleRecord.code]
    const areaId = teamAreaType ? (body.areaId ? String(body.areaId) : null) : null
    if (teamAreaType) {
      const area = areaId ? await prisma.area.findFirst({ where: { id: areaId, type: teamAreaType } }) : null
      if (!area) return NextResponse.json({ message: `Choose a ${teamAreaType.toLowerCase()} for this role` }, { status: 400 })
    }
    const existing = await prisma.userRole.findFirst({ where: { userId: params.id, roleId: roleRecord.id, ...(teamAreaType ? { areaId } : {}) } })
    if (existing) {
      await prisma.userRole.delete({ where: { id: existing.id } })
    } else {
      await prisma.userRole.create({ data: { userId: params.id, roleId: roleRecord.id, areaId, grantedBy: session!.user!.id as string } })
    }
    await prisma.auditLog.create({
      data: {
        actorId: session!.user!.id as string, actorRole: 'ADMIN', action: existing ? 'admin.user.role_remove' : 'admin.user.role_add',
        entityType: 'user', entityId: params.id, newValue: { role: roleRecord.code, areaId },
      },
    })
  }

  return NextResponse.json({ message: 'Updated' })
}
