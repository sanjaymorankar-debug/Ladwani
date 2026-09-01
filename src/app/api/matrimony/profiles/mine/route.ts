import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { member: { include: { matrimonialProfile: { include: { preferences: true } } } } },
  })

  const profile = user?.member?.matrimonialProfile ?? null
  return NextResponse.json({ profile })
}
