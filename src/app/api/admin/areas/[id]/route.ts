import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'
import { isActiveAdmin } from '@/lib/scope'

/**
 * Rename, recode or (de)activate a location. There is no delete: members,
 * families, groups and role mappings may point at an area, so it is retired
 * with isActive=false instead and stays valid for existing references.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const actorId = session?.user?.id as string | undefined
  if (!actorId || !(await isActiveAdmin(actorId))) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const area = await prisma.area.findUnique({ where: { id: params.id } })
  if (!area) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  const body = await req.json()
  const data: { name?: string; code?: string | null; isActive?: boolean } = {}
  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (name.length < 2) return NextResponse.json({ message: 'Name must be at least 2 characters' }, { status: 400 })
    if (name !== area.name) {
      const duplicate = await prisma.area.findFirst({
        where: { parentId: area.parentId, name, type: area.type, id: { not: area.id } },
      })
      if (duplicate) return NextResponse.json({ message: `"${name}" already exists there` }, { status: 409 })
    }
    data.name = name
  }
  if (body.code !== undefined) data.code = body.code ? String(body.code).trim() : null
  if (body.isActive !== undefined) data.isActive = !!body.isActive
  if (!Object.keys(data).length) return NextResponse.json({ message: 'Nothing to update' }, { status: 400 })

  const oldValue = Object.fromEntries(Object.keys(data).map((k) => [k, (area as any)[k]]))
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.area.update({ where: { id: area.id }, data })
    await recordAudit({
      actorId, actorRole: 'ADMIN', action: 'area.update', entityType: 'area', entityId: area.id,
      oldValue, newValue: data,
    }, req, tx)
    return u
  })
  return NextResponse.json({ area: updated })
}
