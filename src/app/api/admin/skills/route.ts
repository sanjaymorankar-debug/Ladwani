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

export async function GET() {
  if (!(await staffOnly())) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const skills = await prisma.skill.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { memberSkills: true } } },
  })
  return NextResponse.json({ skills })
}

export async function POST(req: Request) {
  if (!(await staffOnly())) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  const name = String(body.name ?? '').trim()
  if (name.length < 2) return NextResponse.json({ message: 'Skill name must be at least 2 characters' }, { status: 400 })
  if (await prisma.skill.findFirst({ where: { name } })) {
    return NextResponse.json({ message: 'That skill already exists' }, { status: 409 })
  }
  const skill = await prisma.skill.create({ data: { name, category: body.category?.trim() || null } })
  return NextResponse.json({ skill }, { status: 201 })
}
