import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireActiveAccount } from '@/lib/account-state'
import { recordAudit } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'
import { canManageOrganisation, userIdOfMember } from '@/lib/organisations'

/**
 * F27 —
 *   { memberId }  President / Secretary invites a person (they accept).
 *   {}            the signed-in user asks to join (President / Secretary accepts).
 */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const notActive = await requireActiveAccount(session.user.id)
  if (notActive) return notActive
  const org = await prisma.organisation.findUnique({ where: { id: params.id } })
  if (!org || org.status !== 'ACTIVE') return NextResponse.json({ message: 'Organisation not found or not active' }, { status: 404 })
  if (org.kind !== 'LOCAL') return NextResponse.json({ message: 'LadWani bodies are joined automatically: the office bearers of the organisations below sit on them' }, { status: 400 })
  const body = await req.json().catch(() => ({}))
  const self = (session.user as any).memberId as string | null
  const invite = !!body.memberId && body.memberId !== self
  const memberId = invite ? String(body.memberId) : self
  if (!memberId) return NextResponse.json({ message: 'Complete your profile first' }, { status: 400 })
  if (invite && !(await canManageOrganisation(session, org.id))) {
    return NextResponse.json({ message: 'Only the President or Secretary adds members' }, { status: 403 })
  }
  const person = await prisma.member.findFirst({ where: { id: memberId, deletedAt: null, status: 'ACTIVE', user: { status: 'ACTIVE' } }, select: { id: true } })
  if (!person) return NextResponse.json({ message: 'Members must be active registered users' }, { status: 400 })

  const existing = await prisma.organisationMember.findUnique({ where: { organisationId_memberId: { organisationId: org.id, memberId } } })
  if (existing && ['ACTIVE', 'INVITED', 'REQUESTED'].includes(existing.status)) {
    return NextResponse.json({ message: existing.status === 'ACTIVE' ? 'Already a member' : 'A request or invitation is already open' }, { status: 409 })
  }
  const status = invite ? 'INVITED' : 'REQUESTED'
  const data = { status, designation: 'MEMBER', invitedBy: session.user.id, endedAt: null, endReason: null, pendingDesignation: null, seatId: null, termStart: null, termEnd: null }
  const row = existing
    ? await prisma.organisationMember.update({ where: { id: existing.id }, data })
    : await prisma.organisationMember.create({ data: { organisationId: org.id, memberId, ...data } })
  await recordAudit({ actorId: session.user.id, action: invite ? 'organisation.member.invite' : 'organisation.member.request', entityType: 'organisation_member', entityId: row.id, newValue: { status, memberId } }, req)

  if (invite) {
    const userId = await userIdOfMember(memberId)
    if (userId) await notifyUser({ userId, type: 'ORGANISATION_INVITE', title: `Invitation to join ${org.name}`, body: 'Accept or decline on the Organisations page.', data: { organisationId: org.id } })
  } else {
    const managers = await prisma.organisationMember.findMany({ where: { organisationId: org.id, status: 'ACTIVE', designation: { in: ['PRESIDENT', 'SECRETARY'] } }, select: { memberId: true } })
    for (const m of managers) {
      const userId = await userIdOfMember(m.memberId)
      if (userId) await notifyUser({ userId, type: 'ORGANISATION_REQUEST', title: `Request to join ${org.name}`, body: 'Review it on the organisation page.', data: { organisationId: org.id } })
    }
  }
  return NextResponse.json({ message: invite ? 'Invitation sent' : 'Request sent' }, { status: 201 })
}
