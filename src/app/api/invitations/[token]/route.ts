import { NextResponse } from 'next/server'
import { resolveInvitation, invitationRejectionMessage } from '@/lib/invitations'

/**
 * Unauthenticated on purpose: the person claiming a profile has no account
 * yet. Possession of the (single-use, expiring) token is the credential.
 *
 * The response deliberately carries only what the claim page must show to
 * prove it's the right profile — a first name, last initial and family name.
 * Not the date of birth, contact details or anything else on the record: this
 * endpoint is reachable by anyone holding the link.
 */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const result = await resolveInvitation(params.token)

  if (!result.ok || !result.invitation) {
    return NextResponse.json(
      { message: invitationRejectionMessage(result.reason), reason: result.reason },
      { status: result.reason === 'NOT_FOUND' ? 404 : 410 }
    )
  }

  const { member, email, expiresAt } = result.invitation

  return NextResponse.json({
    member: {
      firstName: member.firstName,
      lastInitial: member.lastName ? `${member.lastName[0]}.` : null,
      familyName: member.families[0]?.family.name ?? null,
    },
    email,
    expiresAt,
  })
}
