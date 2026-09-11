import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMemberAccess } from '@/lib/member-auth'
import { sendEmail, isEmailConfigured } from '@/lib/email'
import {
  generateInvitationToken,
  invitationExpiry,
  invitationEmailTemplate,
} from '@/lib/invitations'

/** Pending invitations for this member, for the Karta's own UI. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Member not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const invitations = await prisma.memberInvitation.findMany({
    where: { memberId: params.id },
    // The token hash is deliberately not selected — nothing downstream needs
    // it, and it shouldn't travel further than it has to.
    select: {
      id: true, email: true, mobile: true, status: true,
      expiresAt: true, acceptedAt: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ invitations })
}

/**
 * Invites the real person behind an account-less profile to claim it (§12,
 * §34). Only whoever already maintains that profile may do this — the Karta
 * of their family, or staff — and only while the profile has no login of its
 * own, since claiming creates that login.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Member not found' }, { status: 404 })
  if (!access.authorized) {
    return NextResponse.json(
      { message: 'Only this family\'s Karta or community staff can invite this member' },
      { status: 403 }
    )
  }

  const member = await prisma.member.findUniqueOrThrow({
    where: { id: params.id },
    include: {
      families: { where: { leftAt: null }, take: 1, include: { family: { select: { name: true } } } },
    },
  })

  // getMemberAccess already refuses a Karta acting on an account-holder, but
  // staff pass that check — so the "already has a login" case is refused here
  // explicitly rather than relying on the authorization layer to imply it.
  if (member.userId) {
    return NextResponse.json(
      { message: 'This member already has an account. Send them a password reset instead.' },
      { status: 409 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : member.email?.toLowerCase()

  if (!email) {
    return NextResponse.json(
      { message: 'An email address is required to send the invitation.' },
      { status: 400 }
    )
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ message: 'That email address does not look valid.' }, { status: 400 })
  }

  // An address already tied to a login would produce an account collision at
  // claim time — refuse now, while there's still someone to tell.
  const emailTaken = await prisma.user.findUnique({ where: { email } })
  if (emailTaken) {
    return NextResponse.json(
      { message: 'An account already uses that email address.' },
      { status: 409 }
    )
  }

  const { token, tokenHash } = generateInvitationToken()

  const invitation = await prisma.$transaction(async (tx) => {
    // Re-inviting supersedes any earlier pending link rather than leaving
    // several live tokens for one profile.
    await tx.memberInvitation.updateMany({
      where: { memberId: params.id, status: 'PENDING' },
      data: { status: 'REVOKED', revokedAt: new Date(), revokedBy: session.user!.id as string },
    })

    const created = await tx.memberInvitation.create({
      data: {
        memberId: params.id,
        email,
        mobile: typeof body.mobile === 'string' ? body.mobile.trim() : null,
        tokenHash,
        invitedBy: session.user!.id as string,
        expiresAt: invitationExpiry(),
      },
    })

    await tx.auditLog.create({
      data: {
        actorId: session.user!.id as string,
        action: 'member.invite',
        entityType: 'member',
        entityId: params.id,
        newValue: { email, invitationId: created.id },
      },
    })

    return created
  })

  const inviter = await prisma.member.findFirst({
    where: { userId: session.user.id },
    select: { firstName: true, lastName: true },
  })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const template = invitationEmailTemplate({
    memberName: [member.firstName, member.lastName].filter(Boolean).join(' '),
    inviterName: inviter ? [inviter.firstName, inviter.lastName].filter(Boolean).join(' ') : 'A family member',
    familyName: member.families[0]?.family.name ?? null,
    url: `${baseUrl}/claim/${token}`,
  })

  // The invitation row is already committed; a mail failure shouldn't roll it
  // back or 500 the caller, but they do need to know it didn't go out — an
  // invitation nobody received is worse than an error, because it looks sent.
  let emailed = false
  let emailError: string | null = null
  try {
    await sendEmail({ to: email, ...template })
    emailed = isEmailConfigured()
    if (!emailed) emailError = 'SMTP is not configured — the link was logged to the server console instead.'
  } catch (e: any) {
    emailError = e?.message ?? 'The email could not be sent.'
  }

  return NextResponse.json(
    {
      message: emailed
        ? `Invitation sent to ${email}.`
        : `Invitation created, but it was not emailed. ${emailError}`,
      invitationId: invitation.id,
      emailed,
      expiresAt: invitation.expiresAt,
    },
    { status: 201 }
  )
}

/** Cancels the pending invitation for this member. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Member not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const { count } = await prisma.memberInvitation.updateMany({
    where: { memberId: params.id, status: 'PENDING' },
    data: { status: 'REVOKED', revokedAt: new Date(), revokedBy: session.user.id as string },
  })

  if (count === 0) {
    return NextResponse.json({ message: 'No pending invitation to cancel' }, { status: 404 })
  }

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id as string,
      action: 'member.invite.revoke',
      entityType: 'member',
      entityId: params.id,
    },
  })

  return NextResponse.json({ message: 'Invitation cancelled' })
}
