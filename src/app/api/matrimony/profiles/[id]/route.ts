import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { visibleMatrimonyWhere } from '@/lib/matrimony'
import { canBrowse, bureauEligibility, isKartaOf, profileCards, tellKartasOfListing, workbookRules } from '@/lib/bureau'
import { profileFields } from '@/lib/bureau-fields'
import { recordAudit } from '@/lib/audit'

/** F38 limited profile (no contact details). Owners and their Karta also see their own full record. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const me = (session.user as any).memberId as string | null
  const own = await prisma.matrimonialProfile.findUnique({ where: { id: params.id } })
  if (own && (own.memberId === me || (await isKartaOf(me, own.memberId)))) {
    const [card] = await profileCards([own.id], me)
    return NextResponse.json({ profile: { ...card, isVisible: own.isVisible, contactPreference: own.contactPreference }, own: true })
  }
  if (!(await canBrowse(session))) return NextResponse.json({ message: 'Only members listed in the marriage bureau, and their Karta, can browse it.' }, { status: 403 })
  const listed = await prisma.matrimonialProfile.findFirst({ where: { id: params.id, ...visibleMatrimonyWhere } })
  if (!listed || ((await workbookRules()) && !(await bureauEligibility(listed.memberId)).ok)) {
    return NextResponse.json({ message: 'Profile not found' }, { status: 404 })
  }
  const [card] = await profileCards([listed.id], me)
  return NextResponse.json({ profile: card })
}

/**
 * F37 toggle and details. The member (or the Karta, for a member without a
 * login) may turn the listing on — only when eligible; the family Karta is
 * told. Anyone with access may turn it off; an Admin may only turn it off.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const profile = await prisma.matrimonialProfile.findUnique({ where: { id: params.id }, include: { member: { select: { userId: true } } } })
  if (!profile) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  const roles: string[] = (session.user as any)?.roles ?? []
  const me = (session.user as any).memberId as string | null
  const isOwner = profile.member.userId === session.user.id
  const isKartaForAccountless = !profile.member.userId && (await isKartaOf(me, profile.memberId))
  const isAdmin = roles.includes('ADMIN')
  if (!isOwner && !isKartaForAccountless && !isAdmin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  if (isAdmin && !isOwner && !isKartaForAccountless && (body.isVisible === true || Object.keys(body).some((k) => k !== 'isVisible'))) {
    return NextResponse.json({ message: 'An Admin can only take a listing down; the member chooses to list.' }, { status: 403 })
  }

  // Opting IN requires current eligibility; opting out is always allowed.
  if (body.isVisible === true) {
    const eligible = await bureauEligibility(profile.memberId)
    if (!eligible.ok) return NextResponse.json({ message: eligible.reason }, { status: 403 })
  }
  const fields = profileFields(body)
  if ('error' in fields) return NextResponse.json({ message: fields.error }, { status: 400 })

  const updated = await prisma.matrimonialProfile.update({
    where: { id: params.id },
    data: { ...(body.isVisible !== undefined ? { isVisible: !!body.isVisible } : {}), ...(fields.data as any) },
  })
  if (body.isVisible !== undefined && !!body.isVisible !== profile.isVisible) {
    await recordAudit({ actorId: session.user.id, action: updated.isVisible ? 'bureau.opt_in' : 'bureau.opt_out', entityType: 'member', entityId: profile.memberId, oldValue: { isVisible: profile.isVisible }, newValue: { isVisible: updated.isVisible } }, req)
    if (updated.isVisible) await tellKartasOfListing(profile.memberId, session.user.id)
  }
  return NextResponse.json({ profile: { id: updated.id, isVisible: updated.isVisible } })
}
