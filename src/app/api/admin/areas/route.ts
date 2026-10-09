import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'
import { isActiveAdmin, LOCATION_TYPES, LOCATION_PARENT } from '@/lib/scope'

/**
 * P0 location master: State > District > Taluka > Village (City allowed in
 * place of a village). Stored in the existing `areas` table; legacy rows of
 * other types (AREA, GROUP, older CITY rows under a state) are listed and
 * left as they are.
 */
async function adminId() {
  const session = await getServerSession(authOptions)
  const id = session?.user?.id as string | undefined
  return id && (await isActiveAdmin(id)) ? id : null
}

export async function GET(req: Request) {
  if (!(await adminId())) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const url = new URL(req.url)
  const type = url.searchParams.get('type')
  const parentId = url.searchParams.get('parentId')

  const areas = await prisma.area.findMany({
    where: {
      ...(type ? { type } : {}),
      ...(parentId ? { parentId } : {}),
    },
    select: {
      id: true, name: true, type: true, code: true, parentId: true, isActive: true, sortOrder: true,
      parent: { select: { name: true } },
      _count: { select: { children: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json({ areas })
}

export async function POST(req: Request) {
  const actorId = await adminId()
  if (!actorId) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const name = String(body.name ?? '').trim()
  const type = String(body.type ?? '').toUpperCase()
  const parentId: string | null = body.parentId || null
  const code: string | null = body.code ? String(body.code).trim() : null

  if (name.length < 2) return NextResponse.json({ message: 'Name must be at least 2 characters' }, { status: 400 })
  if (!(LOCATION_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json({ message: `Type must be one of ${LOCATION_TYPES.join(', ')}` }, { status: 400 })
  }

  const parent = parentId ? await prisma.area.findUnique({ where: { id: parentId } }) : null
  if (parentId && !parent) return NextResponse.json({ message: 'Parent location not found' }, { status: 400 })
  const allowed = LOCATION_PARENT[type]
  if (!allowed.includes(parent ? parent.type : null)) {
    const want = allowed.map((t) => t ?? 'no parent').join(' or ')
    return NextResponse.json({ message: `A ${type.toLowerCase()} must sit under ${want.toLowerCase()}` }, { status: 400 })
  }

  const duplicate = await prisma.area.findFirst({ where: { parentId, name, type } })
  if (duplicate) return NextResponse.json({ message: `"${name}" already exists there` }, { status: 409 })

  const area = await prisma.$transaction(async (tx) => {
    const created = await tx.area.create({ data: { name, type, parentId, code } })
    await recordAudit({
      actorId, actorRole: 'ADMIN', action: 'area.create', entityType: 'area', entityId: created.id,
      newValue: { name, type, parentId, code },
    }, req, tx)
    return created
  })
  return NextResponse.json({ area }, { status: 201 })
}
