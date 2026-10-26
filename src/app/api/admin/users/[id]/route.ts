import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'
import { isActiveAdmin, countActiveAdmins, MIN_ADMINS, ROLE_AREA_TYPE, ROLES_REQUIRING_AREA } from '@/lib/scope'

const USER_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'BLOCKED', 'DEACTIVATED']

// F32: the Admin check comes from the database, not the session JWT, so an
// Admin whose role was revoked cannot keep assigning roles until re-login.
async function adminSession() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id as string | undefined
  return userId && (await isActiveAdmin(userId)) ? userId : null
}

async function roleSnapshot(userId: string) {
  const rows = await prisma.userRole.findMany({
    where: { userId },
    select: { role: { select: { code: true } }, areaId: true },
  })
  return rows.map((r) => (r.areaId ? `${r.role.code}@${r.areaId}` : r.role.code)).sort()
}

const ADMIN_FLOOR_MESSAGE = `At least ${MIN_ADMINS} active Admins must remain. Assign another Admin first.`

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!(await adminSession())) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

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
  const actorId = await adminSession()
  if (!actorId) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    include: { userRoles: { include: { role: true } } },
  })
  if (!target) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  const targetIsAdmin = target.userRoles.some((ur) => ur.role.code === 'ADMIN')

  if (body.status) {
    if (!USER_STATUSES.includes(body.status)) {
      return NextResponse.json({ message: 'Invalid status' }, { status: 400 })
    }
    // F32: minimum 2 Admins kept. Suspending/blocking an active Admin takes
    // them out of the count, same as removing the role.
    const result = await prisma.$transaction(async (tx) => {
      if (targetIsAdmin && target.status === 'ACTIVE' && body.status !== 'ACTIVE') {
        // Serialise concurrent Admin removals on the ADMIN role row, so two
        // Admins can't each remove the other and drop below the floor.
        await tx.$queryRaw`SELECT id FROM roles WHERE code = 'ADMIN' FOR UPDATE`
        if ((await countActiveAdmins(tx)) <= MIN_ADMINS) return 'floor' as const
      }
      await tx.user.update({ where: { id: params.id }, data: { status: body.status as any } })
      await recordAudit({
        actorId,
        actorRole: 'ADMIN',
        action: 'admin.user.status_change',
        entityType: 'user',
        entityId: params.id,
        oldValue: { status: target.status },
        newValue: { status: body.status },
      }, req, tx)
      return 'ok' as const
    })
    if (result === 'floor') return NextResponse.json({ message: ADMIN_FLOOR_MESSAGE }, { status: 409 })
  }

  if (body.toggleRole) {
    const roleRecord = await prisma.role.findUnique({ where: { code: body.toggleRole } })
    if (!roleRecord) return NextResponse.json({ message: 'Role not found' }, { status: 404 })

    // F32 steps 2–3: Operators and District teams are mapped to a district,
    // State teams to a state. Other roles carry no area.
    const areaId: string | null = body.areaId || null
    const requiredType = ROLE_AREA_TYPE[roleRecord.code]
    if (areaId) {
      if (!requiredType) {
        return NextResponse.json({ message: `${roleRecord.code} is not mapped to an area` }, { status: 400 })
      }
      const area = await prisma.area.findUnique({ where: { id: areaId } })
      if (!area || area.type !== requiredType) {
        return NextResponse.json({ message: `${roleRecord.code} must be mapped to a ${requiredType.toLowerCase()}` }, { status: 400 })
      }
    } else if (ROLES_REQUIRING_AREA.includes(roleRecord.code)) {
      return NextResponse.json({ message: `${roleRecord.code} must be mapped to a ${requiredType.toLowerCase()}` }, { status: 400 })
    }

    const before = await roleSnapshot(params.id)
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.userRole.findFirst({ where: { userId: params.id, roleId: roleRecord.id, areaId } })
      if (existing) {
        if (roleRecord.code === 'ADMIN' && target.status === 'ACTIVE') {
          await tx.$queryRaw`SELECT id FROM roles WHERE code = 'ADMIN' FOR UPDATE`
          if ((await countActiveAdmins(tx)) <= MIN_ADMINS) return 'floor' as const
        }
        await tx.userRole.delete({ where: { id: existing.id } })
      } else {
        await tx.userRole.create({ data: { userId: params.id, roleId: roleRecord.id, areaId, grantedBy: actorId } })
      }
      const after = (await tx.userRole.findMany({
        where: { userId: params.id },
        select: { role: { select: { code: true } }, areaId: true },
      })).map((r) => (r.areaId ? `${r.role.code}@${r.areaId}` : r.role.code)).sort()
      // Rule 9: every role change audited with old and new values.
      await recordAudit({
        actorId,
        actorRole: 'ADMIN',
        action: existing ? 'admin.user.role_revoke' : 'admin.user.role_grant',
        entityType: 'user',
        entityId: params.id,
        fieldName: 'roles',
        oldValue: { roles: before },
        newValue: { roles: after },
        metadata: { role: roleRecord.code, areaId },
      }, req, tx)
      return existing ? ('revoked' as const) : ('granted' as const)
    })
    if (result === 'floor') return NextResponse.json({ message: ADMIN_FLOOR_MESSAGE }, { status: 409 })

    // F32 alert: tell the user their role changed.
    const area = areaId ? await prisma.area.findUnique({ where: { id: areaId }, select: { name: true } }) : null
    const label = `${roleRecord.label}${area ? ` (${area.name})` : ''}`
    await notifyUser({
      userId: params.id,
      senderId: actorId,
      type: 'ROLE_CHANGE',
      title: result === 'granted' ? `Role assigned: ${label}` : `Role removed: ${label}`,
      body: 'Sign out and back in to see the change in your menus.',
      data: { role: roleRecord.code, areaId, change: result },
      also: ['EMAIL'],
    })
  }

  return NextResponse.json({ message: 'Updated' })
}
