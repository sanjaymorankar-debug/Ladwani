import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const types = await prisma.relationshipType.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
  })
  return NextResponse.json({ types })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const roles: string[] = (session?.user as any)?.roles ?? []
  if (!roles.includes('ADMIN')) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  if (!body.code || !body.label) {
    return NextResponse.json({ message: 'code and label are required' }, { status: 400 })
  }

  try {
    const type = await prisma.relationshipType.create({
      data: {
        code: body.code,
        label: body.label,
        inverseCode: body.inverseCode || null,
        genderApplicable: body.genderApplicable || null,
        isSpouse: !!body.isSpouse,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
    })
    return NextResponse.json({ message: 'Relationship type created', type }, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ message: 'A relationship type with this code already exists' }, { status: 409 })
    }
    throw e
  }
}
