import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageFamily } from '@/lib/family-auth'
import { requireActiveAccount } from '@/lib/account-state'
import { roleGenderError, expireStaleJoinRequests } from '@/lib/family-rules'

// Karta/staff view of pending requests to join this family, and of the
// invitations this family has sent out that are still awaiting a reply.
export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  if (!(await canManageFamily(session, params.id))) {
    return NextResponse.json({ message: "Only this family's Karta can view join requests" }, { status: 403 })
  }

  // F15: requests older than the expiry window (default 30 days) lapse.
  await expireStaleJoinRequests(params.id)

  const memberSelect = {
    select: { id: true, firstName: true, lastName: true, mobilePrimary: true, email: true, currentCity: true, dateOfBirth: true },
  }

  const [requests, invitesSent] = await Promise.all([
    prisma.familyJoinRequest.findMany({
      where: { familyId: params.id, status: 'PENDING', direction: 'MEMBER_REQUEST' },
      include: { member: memberSelect },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.familyJoinRequest.findMany({
      where: { familyId: params.id, status: 'PENDING', direction: 'KARTA_INVITE' },
      include: { member: memberSelect },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  // F17: "this is me" claims on this family's profiles, for the Karta to confirm.
  const claims = await prisma.profileClaim.findMany({ where: { familyId: params.id, status: 'PENDING' }, orderBy: { createdAt: 'asc' } })
  const people = await prisma.member.findMany({
    where: { id: { in: claims.flatMap((c) => [c.claimantMemberId, c.targetMemberId]) } },
    select: { id: true, firstName: true, lastName: true, dateOfBirth: true, mobilePrimary: true },
  })
  const person = new Map(people.map((p) => [p.id, p]))

  return NextResponse.json({
    requests, invitesSent,
    claims: claims.map((c) => ({ id: c.id, createdAt: c.createdAt, claimant: person.get(c.claimantMemberId) ?? null, target: person.get(c.targetMemberId) ?? null })),
  })
}

/**
 * Two flows share this endpoint, distinguished by `direction`:
 *
 *  - MEMBER_REQUEST (default) — the caller asks to join this family, and its
 *    Karta decides.
 *  - KARTA_INVITE — this family's Karta asks an already-registered person to
 *    join, and *that person* decides (§11, §49). This is the direction that
 *    was missing: duplicate detection would surface an existing member, but
 *    there was no way to reach them. A Karta still cannot add an existing
 *    account-holder unilaterally — only ask.
 */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  // F01: a DRAFT / unapproved account may only fill in its own profile.
  const notActive = await requireActiveAccount(session.user?.id as string)
  if (notActive) return notActive

  const family = await prisma.family.findUnique({ where: { id: params.id } })
  if (!family) return NextResponse.json({ message: 'Family not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const direction = body.direction === 'KARTA_INVITE' ? 'KARTA_INVITE' : 'MEMBER_REQUEST'

  let targetMemberId: string
  let successMessage: string

  if (direction === 'KARTA_INVITE') {
    if (!(await canManageFamily(session, params.id))) {
      return NextResponse.json(
        { message: "Only this family's Karta can invite someone to join it" },
        { status: 403 }
      )
    }
    if (!body.memberId) {
      return NextResponse.json({ message: 'memberId is required' }, { status: 400 })
    }

    const target = await prisma.member.findUnique({
      where: { id: body.memberId },
      select: { id: true, userId: true },
    })
    if (!target) return NextResponse.json({ message: 'Member not found' }, { status: 404 })

    // An account-less profile has nobody who can answer the invitation. The
    // Karta should either add them directly (they're unclaimed, so that's
    // allowed) or invite them to claim the profile first.
    if (!target.userId) {
      return NextResponse.json(
        {
          message:
            'That profile has no account yet, so nobody can accept the invitation. ' +
            'Add them to the family directly, or invite them to claim their profile first.',
        },
        { status: 409 }
      )
    }

    // Rule 1: belonging to other families is fine; only this one matters.
    const alreadyInFamily = await prisma.familyMember.findFirst({
      where: { memberId: target.id, familyId: params.id, leftAt: null },
    })
    if (alreadyInFamily) {
      return NextResponse.json({ message: 'That person is already in this family.' }, { status: 409 })
    }

    targetMemberId = target.id
    successMessage = 'Invitation sent. They will be asked to accept before joining your family.'
  } else {
    const memberId = (session.user as any).memberId as string | null
    if (!memberId) {
      return NextResponse.json({ message: 'Complete your member profile first.' }, { status: 400 })
    }

    // F14 / rule 1: a person may belong to several families — only a
    // membership of this one blocks a request.
    const existingMembership = await prisma.familyMember.findFirst({ where: { memberId, familyId: params.id, leftAt: null } })
    if (existingMembership) {
      return NextResponse.json({ message: 'You are already a member of this family.' }, { status: 409 })
    }

    targetMemberId = memberId
    successMessage = 'Join request sent. The family head will be notified.'
  }

  // F14 step 4: the claimed relationship must suit the person and be relative to a member here.
  if (body.relationshipTypeCode) {
    const person = await prisma.member.findUnique({ where: { id: targetMemberId }, select: { gender: true } })
    const genderError = await roleGenderError(body.relationshipTypeCode, person?.gender)
    if (genderError) return NextResponse.json({ message: genderError }, { status: 400 })
  }
  if (body.relatedToMemberId && !(await prisma.familyMember.findFirst({ where: { familyId: params.id, memberId: body.relatedToMemberId, leftAt: null } }))) {
    return NextResponse.json({ message: 'The person this relationship is relative to is not in this family' }, { status: 400 })
  }

  // F14: one open request per person per family (and per direction).
  await expireStaleJoinRequests(params.id)
  const open = await prisma.familyJoinRequest.findFirst({
    where: { familyId: params.id, memberId: targetMemberId, direction, status: 'PENDING' },
  })
  if (open) {
    return NextResponse.json(
      { message: direction === 'KARTA_INVITE' ? 'You already have a pending invitation out to that person.' : 'You already have a pending request for this family.' },
      { status: 409 }
    )
  }

  try {
    const joinRequest = await prisma.$transaction(async (tx) => {
      const created = await tx.familyJoinRequest.create({
        data: {
          familyId: params.id,
          memberId: targetMemberId,
          relatedToMemberId: body.relatedToMemberId ?? null,
          relationshipTypeCode: body.relationshipTypeCode ?? null,
          direction,
          requestedBy: session.user!.id as string,
          status: 'PENDING',
        },
      })

      // Notify whoever has to act next: the invited person for an invite, the
      // Karta for a request.
      const notifyUserId =
        direction === 'KARTA_INVITE'
          ? (await tx.member.findUnique({ where: { id: targetMemberId }, select: { userId: true } }))?.userId
          : (await tx.member.findUnique({ where: { id: family.kartaMemberId ?? '' }, select: { userId: true } }))?.userId

      if (notifyUserId) {
        await tx.notification.create({
          data: {
            recipientId: notifyUserId,
            senderId: session.user!.id as string,
            type: 'APPROVAL_STATUS',
            title: direction === 'KARTA_INVITE' ? 'Invitation to join a family' : 'New request to join your family',
            body:
              direction === 'KARTA_INVITE'
                ? `You have been invited to join the ${family.name} family.`
                : `Someone has asked to join the ${family.name} family.`,
            data: { familyId: params.id, joinRequestId: created.id, direction },
          },
        })
      }

      await tx.auditLog.create({
        data: {
          actorId: session.user!.id as string,
          action: direction === 'KARTA_INVITE' ? 'family.invite.create' : 'family.join_request.create',
          entityType: 'family_join_request',
          entityId: created.id,
          newValue: { familyId: params.id, direction },
        },
      })

      return created
    })

    return NextResponse.json({ message: successMessage, requestId: joinRequest.id }, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json(
        {
          message: direction === 'KARTA_INVITE'
            ? 'You already have a pending invitation out to that person.'
            : 'You already have a pending request for this family.',
        },
        { status: 409 }
      )
    }
    throw e
  }
}
