import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { claimMatches } from '@/lib/claims'
import { recordAudit } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'
import { kartaUserIdOf } from '@/lib/family-rules'

/**
 * F17 — GET: profiles that may be the caller (limited view) and their claims.
 * POST { memberId }: "This is me" — goes to that family's Karta to confirm.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const [matches, claims] = await Promise.all([
    claimMatches(session.user.id),
    prisma.profileClaim.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, targetMemberId: true, createdAt: true, note: true } }),
  ])
  return NextResponse.json({ matches, claims })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const myMemberId = (session.user as any).memberId as string | null
  if (!myMemberId) return NextResponse.json({ message: 'No member profile' }, { status: 400 })
  const body = await req.json().catch(() => ({}))

  const match = (await claimMatches(session.user.id)).find((m) => m.memberId === body.memberId)
  if (!match) return NextResponse.json({ message: 'That profile is not one you can claim' }, { status: 404 })
  if (await prisma.profileClaim.findFirst({ where: { userId: session.user.id, status: 'PENDING' } })) {
    return NextResponse.json({ message: 'You already have a claim waiting for a Karta' }, { status: 409 })
  }
  // The Karta of the first of the profile's families that has one confirms.
  let familyId: string | null = null
  let kartaUser: string | null = null
  for (const f of match.families) {
    kartaUser = await kartaUserIdOf(f.id)
    if (kartaUser) { familyId = f.id; break }
  }
  if (!familyId || !kartaUser) return NextResponse.json({ message: 'That family has no Karta to confirm right now' }, { status: 409 })

  const claim = await prisma.profileClaim.create({
    data: { userId: session.user.id, claimantMemberId: myMemberId, targetMemberId: match.memberId, familyId },
  })
  await recordAudit({
    actorId: session.user.id, action: 'member.claim.request', entityType: 'profile_claim', entityId: claim.id,
    newValue: { targetMemberId: match.memberId, familyId, status: 'PENDING' },
  }, req)
  await notifyUser({
    userId: kartaUser, type: 'PROFILE_CLAIM', title: 'Someone says a profile in your family is theirs',
    body: `A registered member says they are ${match.name}. Confirm or reject it in your family requests.`,
    data: { claimId: claim.id, familyId }, also: ['SMS'],
  })
  return NextResponse.json({ message: 'Sent to the family\'s Karta to confirm.', claimId: claim.id }, { status: 201 })
}
