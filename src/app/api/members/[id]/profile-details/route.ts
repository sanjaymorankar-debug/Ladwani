import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMemberAccess } from '@/lib/member-auth'

// Data for the Edit Profile form that isn't on the Member row itself: the
// extra personal details and the geo-tagged current address. Saved through
// PATCH /api/members/[id]. Only people who may edit the member can read it —
// it includes income and exact location.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const [details, currentAddress, pendingAddress] = await Promise.all([
    prisma.memberProfileDetail.findUnique({ where: { memberId: params.id } }),
    prisma.address.findFirst({ where: { memberId: params.id, addressType: 'CURRENT' } }),
    prisma.approval.findFirst({
      where: { actionCode: 'member.address.change', entityId: params.id, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      select: { id: true },
    }),
  ])
  return NextResponse.json({ details, currentAddress, addressChangePending: !!pendingAddress })
}
