import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'
import { canManageOrganisation, canAppointBodyOffice, endMembership, maybeActivate, syncPromotions, userIdOfMember, OFFICES } from '@/lib/organisations'

const isOffice = (d: string | null | undefined) => !!d && (OFFICES as readonly string[]).includes(d)

/**
 * F26 / F27 actions on one person's membership:
 *   accept | decline        — the person: an invitation, or a post handed to them
 *   approve | reject        — President / Secretary: a request to join
 *   designate {designation} — President / Secretary: hand a post over (the new holder accepts;
 *                             the outgoing holder becomes a Member) — there is always one of each.
 *                             On a LadWani body an Admin, or an Operator of its district / state,
 *                             appoints its office bearers this way too (owner's decision).
 *                             A change of office bearers updates the seats on the body above (syncPromotions).
 *   term {termStart, termEnd} — President / Secretary: an office bearer's term
 *   remove {reason}         — President / Secretary: a Member (not an office bearer)
 *   resign                  — the person (an office bearer hands over first)
 *   renominate {newMemberId} — the applicant: replace an office bearer who declined (F26)
 */
export async function POST(req: Request, props: { params: Promise<{ id: string; memberId: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const actorId = session.user.id
  const self = (session.user as any).memberId === params.memberId
  const org = await prisma.organisation.findUnique({ where: { id: params.id } })
  const m = await prisma.organisationMember.findUnique({ where: { organisationId_memberId: { organisationId: params.id, memberId: params.memberId } } })
  if (!org || !m) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const manage = () => canManageOrganisation(session, org.id)
  const audit = (action: string, oldValue: object, newValue: object) =>
    recordAudit({ actorId, action: `organisation.member.${action}`, entityType: 'organisation_member', entityId: m.id, oldValue, newValue }, req)
  const tellPerson = async (title: string, text: string) => {
    const userId = await userIdOfMember(m.memberId)
    if (userId && userId !== actorId) await notifyUser({ userId, type: 'ORGANISATION_MEMBER', title, body: text, data: { organisationId: org.id } })
  }

  switch (body.action) {
    case 'accept':
    case 'decline': {
      if (!self) return NextResponse.json({ message: 'Only the person can answer' }, { status: 403 })
      if (m.status === 'INVITED') {
        const status = body.action === 'accept' ? 'ACTIVE' : 'DECLINED'
        await prisma.organisationMember.update({ where: { id: m.id }, data: { status, joinedAt: status === 'ACTIVE' ? new Date() : null, termStart: status === 'ACTIVE' && isOffice(m.designation) ? new Date() : null } })
        await audit(body.action, { status: 'INVITED' }, { status })
        if (status === 'ACTIVE') await maybeActivate(org.id)
        else if (org.applicantUserId) await notifyUser({ userId: org.applicantUserId, type: 'ORGANISATION_MEMBER', title: `A nominee declined (${org.name})`, body: `The nominated ${m.designation.toLowerCase()} declined. Nominate someone else.`, data: { organisationId: org.id } })
        return NextResponse.json({ message: status === 'ACTIVE' ? 'Accepted' : 'Declined' })
      }
      if (m.status === 'ACTIVE' && m.pendingDesignation) {
        const post = m.pendingDesignation
        if (body.action === 'decline') {
          await prisma.organisationMember.update({ where: { id: m.id }, data: { pendingDesignation: null } })
          await audit('handover.decline', { pendingDesignation: post }, { pendingDesignation: null })
          return NextResponse.json({ message: 'Declined' })
        }
        await prisma.$transaction(async (tx) => {
          // Outgoing holder first: the database allows one holder per post.
          await tx.organisationMember.updateMany({ where: { organisationId: org.id, designation: post, status: 'ACTIVE' }, data: { designation: 'MEMBER', termStart: null, termEnd: null } })
          await tx.organisationMember.update({ where: { id: m.id }, data: { designation: post, pendingDesignation: null, termStart: new Date(), termEnd: null } })
        })
        await audit('handover.accept', { designation: m.designation }, { designation: post })
        // Filling a vacant post (e.g. a group copied without a Treasurer) can
        // complete an approved organisation's three office bearers.
        await maybeActivate(org.id)
        await syncPromotions(org.id, actorId)
        return NextResponse.json({ message: `You are now ${post.toLowerCase()}` })
      }
      return NextResponse.json({ message: 'Nothing to answer' }, { status: 409 })
    }

    case 'approve':
    case 'reject': {
      if (!(await manage())) return NextResponse.json({ message: 'Only the President or Secretary decides' }, { status: 403 })
      if (m.status !== 'REQUESTED') return NextResponse.json({ message: 'No open request' }, { status: 409 })
      if (body.action === 'reject' && !String(body.reason ?? '').trim()) return NextResponse.json({ message: 'Give a reason' }, { status: 400 })
      const status = body.action === 'approve' ? 'ACTIVE' : 'DECLINED'
      await prisma.organisationMember.update({ where: { id: m.id }, data: { status, joinedAt: status === 'ACTIVE' ? new Date() : null, endReason: status === 'DECLINED' ? (body.reason ?? null) : null } })
      await audit(body.action, { status: 'REQUESTED' }, { status })
      await tellPerson(status === 'ACTIVE' ? `Welcome to ${org.name}` : `Request to join ${org.name} declined`, status === 'ACTIVE' ? 'You are now a member.' : (body.reason ?? ''))
      return NextResponse.json({ message: status === 'ACTIVE' ? 'Member added' : 'Request declined' })
    }

    case 'designate': {
      if (!(await manage()) && !(await canAppointBodyOffice(session, org))) {
        return NextResponse.json({ message: org.kind === 'LOCAL' ? 'Only the President or Secretary changes designations' : 'Only an Admin, an Operator of this area or the body\'s President / Secretary appoints office bearers' }, { status: 403 })
      }
      if (m.status !== 'ACTIVE') return NextResponse.json({ message: 'Only an active member can take a post' }, { status: 409 })
      const post = String(body.designation ?? '')
      if (!isOffice(post)) {
        return NextResponse.json({ message: 'There is always one President, Secretary and Chairman: hand the post to someone else instead' }, { status: 400 })
      }
      if (m.designation === post) return NextResponse.json({ message: 'Already holds this post' }, { status: 409 })
      if (isOffice(m.designation)) return NextResponse.json({ message: 'Hand over the current post first' }, { status: 409 })
      await prisma.organisationMember.update({ where: { id: m.id }, data: { pendingDesignation: post } })
      await audit('handover.offer', { pendingDesignation: m.pendingDesignation }, { pendingDesignation: post })
      await tellPerson(`You are offered the ${post.toLowerCase()} post of ${org.name}`, 'Accept or decline on the organisation page.')
      return NextResponse.json({ message: 'Handover offered; the new holder must accept' })
    }

    case 'term': {
      if (!(await manage())) return NextResponse.json({ message: 'Only the President or Secretary sets terms' }, { status: 403 })
      if (m.status !== 'ACTIVE' || !isOffice(m.designation)) return NextResponse.json({ message: 'Terms are for office bearers' }, { status: 400 })
      const start = body.termStart ? new Date(body.termStart) : null
      const end = body.termEnd ? new Date(body.termEnd) : null
      if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime())) || (start && end && end <= start)) {
        return NextResponse.json({ message: 'The term must end after it starts' }, { status: 400 })
      }
      await prisma.organisationMember.update({ where: { id: m.id }, data: { termStart: start, termEnd: end } })
      await audit('term', { termStart: m.termStart, termEnd: m.termEnd }, { termStart: start, termEnd: end })
      await tellPerson(`Your term at ${org.name} was updated`, end ? `It ends on ${end.toISOString().slice(0, 10)}.` : '')
      return NextResponse.json({ message: 'Term saved' })
    }

    case 'remove': {
      if (!(await manage())) return NextResponse.json({ message: 'Only the President or Secretary removes members' }, { status: 403 })
      if (isOffice(m.designation) && m.status === 'ACTIVE') return NextResponse.json({ message: 'An office bearer hands the post over before leaving' }, { status: 409 })
      const reason = String(body.reason ?? '').trim()
      if (!reason) return NextResponse.json({ message: 'Give a reason' }, { status: 400 })
      await endMembership(org.id, m.memberId, `REMOVED: ${reason}`, actorId)
      await tellPerson(`You were removed from ${org.name}`, reason)
      return NextResponse.json({ message: 'Member removed' })
    }

    case 'resign': {
      if (!self) return NextResponse.json({ message: 'Only the person can resign' }, { status: 403 })
      if (isOffice(m.designation) && m.status === 'ACTIVE' && org.status === 'ACTIVE') {
        return NextResponse.json({ message: 'Hand your post over before resigning' }, { status: 409 })
      }
      await endMembership(org.id, m.memberId, 'RESIGNED', actorId)
      return NextResponse.json({ message: 'You have left the organisation' })
    }

    case 'renominate': {
      if (org.applicantUserId !== actorId) return NextResponse.json({ message: 'Only the applicant renominates' }, { status: 403 })
      if (m.status !== 'DECLINED' || !isOffice(m.designation) || !['PENDING_APPROVAL', 'CORRECTION_REQUIRED'].includes(org.status)) {
        return NextResponse.json({ message: 'Only a post whose nominee declined can be renominated' }, { status: 409 })
      }
      const next = String(body.newMemberId ?? '')
      const person = await prisma.member.findFirst({ where: { id: next, deletedAt: null, status: 'ACTIVE', user: { status: 'ACTIVE' } }, select: { id: true, userId: true } })
      if (!person) return NextResponse.json({ message: 'Office bearers must be active registered members' }, { status: 400 })
      const holder = await prisma.organisationMember.findUnique({ where: { organisationId_memberId: { organisationId: org.id, memberId: next } } })
      if (holder && holder.status !== 'DECLINED' && holder.status !== 'ENDED' && holder.designation !== 'MEMBER') return NextResponse.json({ message: 'That person already holds a post' }, { status: 409 })
      const data = { designation: m.designation, status: 'INVITED', invitedBy: actorId, endedAt: null, endReason: null }
      if (holder) await prisma.organisationMember.update({ where: { id: holder.id }, data })
      else await prisma.organisationMember.create({ data: { organisationId: org.id, memberId: next, ...data } })
      await prisma.organisationMember.update({ where: { id: m.id }, data: { designation: 'MEMBER' } })
      await audit('renominate', { memberId: m.memberId, designation: m.designation }, { memberId: next })
      if (person.userId) await notifyUser({ userId: person.userId, type: 'ORGANISATION_INVITE', title: `You are nominated ${m.designation.toLowerCase()} of ${org.name}`, body: 'Accept or decline on the Organisations page.', data: { organisationId: org.id } })
      return NextResponse.json({ message: 'New nominee invited' })
    }
  }
  return NextResponse.json({ message: 'Unknown action' }, { status: 400 })
}
