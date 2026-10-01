import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function staffOnly() {
  const session = await getServerSession(authOptions)
  const roles: string[] = (session?.user as any)?.roles ?? []
  if (!session?.user?.id || !(roles.includes('ADMIN') || roles.includes('OPERATOR'))) return null
  return session
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await staffOnly())) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const exists = await prisma.skill.findUnique({ where: { id: params.id } })
  if (!exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (name.length < 2) return NextResponse.json({ message: 'Skill name must be at least 2 characters' }, { status: 400 })
    const clash = await prisma.skill.findFirst({ where: { name, id: { not: params.id } } })
    if (clash) return NextResponse.json({ message: 'Another skill already has that name' }, { status: 409 })
    data.name = name
  }
  if (body.category !== undefined) data.category = body.category?.trim() || null
  if (body.isActive !== undefined) data.isActive = !!body.isActive
  if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder, 10) || 0

  const skill = await prisma.skill.update({ where: { id: params.id }, data })
  return NextResponse.json({ skill })
}

/** Deleting a skill members already hold would silently strip it from profiles - deactivate instead. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!(await staffOnly())) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const used = await prisma.memberSkill.count({ where: { skillId: params.id } })
  if (used > 0) {
    return NextResponse.json({ message: `${used} member(s) have this skill. Deactivate it instead of deleting.` }, { status: 409 })
  }
  await prisma.skill.delete({ where: { id: params.id } })
  return NextResponse.json({ message: 'Deleted' })
}
