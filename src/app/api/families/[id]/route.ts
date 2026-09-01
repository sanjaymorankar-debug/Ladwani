import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageFamily } from '@/lib/family-auth'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const family = await prisma.family.findUnique({ where: { id: params.id, deletedAt: null } })
  if (!family) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  return NextResponse.json(family)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  if (!(await canManageFamily(session, params.id))) {
    return NextResponse.json({ message: "Only this family's Karta can edit it" }, { status: 403 })
  }

  const body = await req.json()

  const family = await prisma.family.update({
    where: { id: params.id },
    data: {
      name: body.name ?? undefined,
      surname: body.surname !== undefined ? body.surname || null : undefined,
      description: body.description !== undefined ? body.description || null : undefined,
      kuladevata: body.kuladevata !== undefined ? body.kuladevata || null : undefined,
      kuladevi: body.kuladevi !== undefined ? body.kuladevi || null : undefined,
      gotra: body.gotra !== undefined ? body.gotra || null : undefined,
      traditionalOccupation: body.traditionalOccupation !== undefined ? body.traditionalOccupation || null : undefined,
      nativeVillage: body.nativeVillage !== undefined ? body.nativeVillage || null : undefined,
      nativeDistrict: body.nativeDistrict !== undefined ? body.nativeDistrict || null : undefined,
      nativeState: body.nativeState !== undefined ? body.nativeState || null : undefined,
      updatedBy: session.user.id,
    },
  })

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      action: 'family.update',
      entityType: 'family',
      entityId: params.id,
    },
  })

  return NextResponse.json({ message: 'Family updated', family })
}
