import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { bureauEligibility } from '@/lib/bureau'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { member: { include: { matrimonialProfile: { include: { preferences: true } } } } },
  })

  const profile = user?.member?.matrimonialProfile ?? null
  // F37: the toggle is offered only when the member is eligible; the reason otherwise.
  const eligibility = user?.member ? await bureauEligibility(user.member.id) : { ok: false, reason: 'Complete your profile first.' }
  return NextResponse.json({ profile, eligibility })
}
