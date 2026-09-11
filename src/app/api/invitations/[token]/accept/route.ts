import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { claimInvitationSchema } from '@/lib/validators'
import { resolveInvitation, invitationRejectionMessage, hashInvitationToken } from '@/lib/invitations'

/**
 * Claims a profile: creates the person's login and attaches it to the Member
 * record somebody else created for them (§12, §34).
 *
 * Unauthenticated by design — the token is the credential. Everything that
 * decides the outcome is re-read inside the transaction, because the window
 * between the page loading and this POST is long enough for the invitation to
 * be revoked or the profile to be claimed another way.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const precheck = await resolveInvitation(params.token)
  if (!precheck.ok || !precheck.invitation) {
    return NextResponse.json(
      { message: invitationRejectionMessage(precheck.reason), reason: precheck.reason },
      { status: precheck.reason === 'NOT_FOUND' ? 404 : 410 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const parsed = claimInvitationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? 'Invalid details', errors: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const email = precheck.invitation.email
  if (!email) {
    return NextResponse.json(
      { message: 'This invitation has no email address on it. Ask for a new invitation.' },
      { status: 409 }
    )
  }

  const passwordHash = await hashPassword(parsed.data.password)
  const mobile = parsed.data.mobile ? parsed.data.mobile : null
  const tokenHash = hashInvitationToken(params.token)

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-check under the transaction. Claiming the invitation is done as a
      // conditional update on status, so two simultaneous submissions can't
      // both create an account: the second matches zero rows.
      const claimed = await tx.memberInvitation.updateMany({
        where: { tokenHash, status: 'PENDING', expiresAt: { gt: new Date() } },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      })
      if (claimed.count === 0) throw new Error('INVITATION_UNAVAILABLE')

      const invitation = await tx.memberInvitation.findUniqueOrThrow({ where: { tokenHash } })

      const member = await tx.member.findUniqueOrThrow({ where: { id: invitation.memberId } })
      if (member.userId) throw new Error('INVITATION_UNAVAILABLE')

      const emailTaken = await tx.user.findUnique({ where: { email } })
      if (emailTaken) throw new Error('EMAIL_TAKEN')

      if (mobile) {
        const mobileTaken = await tx.user.findUnique({ where: { mobile } })
        if (mobileTaken) throw new Error('MOBILE_TAKEN')
      }

      const user = await tx.user.create({
        data: {
          email,
          mobile,
          passwordHash,
          // The invitation went to this address and only its recipient could
          // have opened it, so the address is already proven — no second
          // round of OTP to sit through.
          emailVerified: true,
          mobileVerified: false,
          status: 'ACTIVE',
        },
      })

      await tx.member.update({
        where: { id: member.id },
        data: {
          userId: user.id,
          email: member.email ?? email,
          mobilePrimary: member.mobilePrimary ?? mobile,
        },
      })

      const memberRole = await tx.role.findUnique({ where: { code: 'MEMBER' } })
      if (memberRole) {
        await tx.userRole.create({ data: { userId: user.id, roleId: memberRole.id } })
      }

      await tx.memberInvitation.update({
        where: { id: invitation.id },
        data: { acceptedBy: user.id },
      })

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'member.invite.accept',
          entityType: 'member',
          entityId: member.id,
          newValue: { invitationId: invitation.id },
        },
      })

      // Tell whoever invited them that the profile is now claimed — they'll
      // stop being able to edit it, and should know why.
      await tx.notification.create({
        data: {
          recipientId: invitation.invitedBy,
          type: 'APPROVAL_STATUS',
          title: 'Profile claimed',
          body: `${member.firstName} ${member.lastName ?? ''}`.trim() +
            ' has accepted your invitation and now manages their own profile.',
          data: { memberId: member.id },
        },
      })

      return { userId: user.id, memberId: member.id, email }
    })

    return NextResponse.json(
      {
        message: 'Your account is ready. You can sign in now.',
        email: result.email,
      },
      { status: 201 }
    )
  } catch (e: any) {
    if (e?.message === 'INVITATION_UNAVAILABLE') {
      return NextResponse.json(
        { message: 'This invitation is no longer valid. Ask for a new one.' },
        { status: 410 }
      )
    }
    if (e?.message === 'EMAIL_TAKEN') {
      return NextResponse.json(
        { message: 'An account already uses that email address. Try signing in instead.' },
        { status: 409 }
      )
    }
    if (e?.message === 'MOBILE_TAKEN') {
      return NextResponse.json(
        { message: 'An account already uses that mobile number.' },
        { status: 409 }
      )
    }
    throw e
  }
}
