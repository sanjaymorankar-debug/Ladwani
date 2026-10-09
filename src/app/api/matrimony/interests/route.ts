import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireActiveAccount } from '@/lib/account-state'
import { visibleMatrimonyWhere } from '@/lib/matrimony'
import { actingFor, bureauEligibility, workbookRules, contactFor } from '@/lib/bureau'
import { notifyUser } from '@/lib/notify'

/**
 * Sent and received interests — for the viewer, and (as Karta) for the
 * family members they act for. Once an interest is ACCEPTED both sides see
 * the other's contact details, per their contact preference (F38).
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const memberId = (session.user as any).memberId as string | null
  if (!memberId) return NextResponse.json({ sent: [], received: [] })
  const ids = await actingFor(memberId)
  const box = new URL(req.url).searchParams.get('box') // 'sent' | 'received' | omitted = both
  const person = { select: { id: true, firstName: true, lastName: true } }
  const [sent, received] = await Promise.all([
    box === 'received' ? [] : prisma.matrimonialInterest.findMany({ where: { fromMemberId: { in: ids } }, include: { toMember: person, fromMember: person }, orderBy: { createdAt: 'desc' } }),
    box === 'sent' ? [] : prisma.matrimonialInterest.findMany({ where: { toMemberId: { in: ids } }, include: { fromMember: person, toMember: person }, orderBy: { createdAt: 'desc' } }),
  ])
  const withContact = async (rows: any[], otherKey: 'toMemberId' | 'fromMemberId') =>
    Promise.all(rows.map(async (r) => ({ ...r, contact: r.status === 'ACCEPTED' ? await contactFor(r[otherKey]) : null })))
  return NextResponse.json({ sent: await withContact(sent, 'toMemberId'), received: await withContact(received, 'fromMemberId') })
}

/** F38: send an interest — for oneself, or as Karta for a family member (`fromMemberId`). */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  // F01: a DRAFT / unapproved account may only fill in its own profile.
  const notActive = await requireActiveAccount(session.user?.id as string)
  if (notActive) return notActive

  const me = (session.user as any).memberId as string | null
  if (!me) return NextResponse.json({ message: 'Complete your member profile first.' }, { status: 400 })
  const body = await req.json().catch(() => ({}))
  const fromMemberId = body.fromMemberId ? String(body.fromMemberId) : me
  if (!(await actingFor(me)).includes(fromMemberId)) return NextResponse.json({ message: 'You can send interests for yourself or, as Karta, for your family members' }, { status: 403 })
  const toMemberId = body.toMemberId as string
  if (!toMemberId) return NextResponse.json({ message: 'toMemberId is required' }, { status: 400 })
  if (toMemberId === fromMemberId) return NextResponse.json({ message: 'You cannot send interest to yourself' }, { status: 400 })

  const strict = await workbookRules()
  const target = await prisma.matrimonialProfile.findFirst({ where: { memberId: toMemberId, ...visibleMatrimonyWhere } })
  if (!target || (strict && !(await bureauEligibility(toMemberId)).ok)) {
    return NextResponse.json({ message: 'This matrimonial profile is not available.' }, { status: 404 })
  }
  if (strict) {
    // Workbook rule: only listed members (or their Karta for them) send interests.
    const mine = await prisma.matrimonialProfile.findFirst({ where: { memberId: fromMemberId, isVisible: true } })
    if (!mine || !(await bureauEligibility(fromMemberId)).ok) return NextResponse.json({ message: 'List the profile in the marriage bureau first' }, { status: 403 })
  }

  const existing = await prisma.matrimonialInterest.findFirst({ where: { fromMemberId, toMemberId, status: { in: ['PENDING', 'ACCEPTED'] } } })
  if (existing) return NextResponse.json({ message: 'You already sent an interest to this profile.' }, { status: 409 })

  const interest = await prisma.matrimonialInterest.create({ data: { fromMemberId, toMemberId, message: body.message ? String(body.message).slice(0, 1000) : null } })

  // The person and their Karta(s) are told (the Karta may answer for them).
  const toMember = await prisma.member.findUnique({ where: { id: toMemberId }, select: { userId: true } })
  const kartas = await prisma.familyMember.findMany({
    where: { isKarta: true, leftAt: null, family: { members: { some: { memberId: toMemberId, leftAt: null } } } },
    select: { member: { select: { userId: true } } },
  })
  const recipients = new Set([toMember?.userId, ...kartas.map((k) => k.member.userId)].filter(Boolean) as string[])
  for (const userId of Array.from(recipients)) {
    if (userId === session.user.id) continue
    await notifyUser({ userId, type: 'MATRIMONIAL_INTEREST', title: 'New matrimonial interest', body: 'Someone has expressed interest in a marriage bureau profile.', data: { interestId: interest.id } })
  }
  return NextResponse.json({ message: 'Interest sent', interest }, { status: 201 })
}
