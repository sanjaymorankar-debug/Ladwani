import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMemberAccess } from '@/lib/member-auth'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const name = (body.name as string | undefined)?.trim()
  if (!name) return NextResponse.json({ message: 'Skill name is required' }, { status: 400 })

  let skill = await prisma.skill.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } })
  if (!skill) {
    skill = await prisma.skill.create({ data: { name } })
  }

  const memberSkill = await prisma.memberSkill.upsert({
    where: { memberId_skillId: { memberId: params.id, skillId: skill.id } },
    update: { level: body.level ?? undefined },
    create: { memberId: params.id, skillId: skill.id, level: body.level ?? null },
  })

  return NextResponse.json({ message: 'Skill added', skill, memberSkill }, { status: 201 })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const skillId = searchParams.get('skillId')
  if (!skillId) return NextResponse.json({ message: 'skillId is required' }, { status: 400 })

  await prisma.memberSkill.deleteMany({ where: { memberId: params.id, skillId } })
  return NextResponse.json({ message: 'Removed' })
}
