import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const roles: string[] = (session?.user as any)?.roles ?? []
  if (!roles.includes('ADMIN')) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const type = await prisma.relationshipType.update({
    where: { id: params.id },
    data: {
      label: body.label ?? undefined,
      inverseCode: body.inverseCode !== undefined ? body.inverseCode || null : undefined,
      genderApplicable: body.genderApplicable !== undefined ? body.genderApplicable || null : undefined,
      isSpouse: body.isSpouse ?? undefined,
      isActive: body.isActive ?? undefined,
    },
  })

  return NextResponse.json({ message: 'Updated', type })
}
