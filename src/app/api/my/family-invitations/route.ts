import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Invitations addressed to the signed-in member (§11, §49).
 *
 * Without this, an invited person has no way to find the request — they'd
 * need the family id to reach the respond endpoint, which they have no reason
 * to know. Scoped strictly to the caller's own member id.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const memberId = (session.user as any).memberId as string | null
  if (!memberId) return NextResponse.json({ invitations: [] })

  const invitations = await prisma.familyJoinRequest.findMany({
    where: { memberId, status: 'PENDING', direction: 'KARTA_INVITE' },
    include: {
      family: { select: { id: true, name: true, registrationNumber: true, nativeVillage: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ invitations })
}
