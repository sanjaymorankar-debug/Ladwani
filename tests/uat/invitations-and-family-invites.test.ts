import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { POST as invite, GET as listInvites, DELETE as revokeInvite } from '@/app/api/members/[id]/invite/route'
import { GET as lookupInvitation } from '@/app/api/invitations/[token]/route'
import { POST as acceptInvitation } from '@/app/api/invitations/[token]/accept/route'
import { POST as postJoinRequest, GET as getJoinRequests } from '@/app/api/families/[id]/join-requests/route'
import { PATCH as respondJoinRequest } from '@/app/api/families/[id]/join-requests/[reqId]/route'
import { GET as myInvitations } from '@/app/api/my/family-invitations/route'
import { account, bareMember, jsonReq, actAs, anonymous } from './helpers'
import { hashInvitationToken } from '@/lib/invitations'

const createdUserIds: string[] = []
const createdMemberIds: string[] = []

/**
 * The family-invite tests need somebody who has a login but belongs to no
 * family. The seeded INDEPENDENT-01 looks like a fit, but they're a one-person
 * family that other test files assert on — borrowing them (and stripping their
 * family link to make them invitable) silently broke two tests elsewhere. So
 * this file makes its own throwaway account instead and deletes it afterwards.
 */
const INVITEE_EMAIL = 'faminvite.target@uat.test'
const INVITEE_MEMBER_NUMBER = 'UAT-FAMINV-TARGET'
let invitee: { userId: string; memberId: string; roles: string[] }

/**
 * The account-less profile used across the claim tests. Chosen once, in
 * beforeAll, and ordered deterministically — picking it per-test with
 * findFirst returned different members as earlier tests mutated the data.
 */
let claimChild: { id: string; firstName: string; lastName: string | null }

async function createInvitee() {
  const user = await prisma.user.create({
    data: {
      email: INVITEE_EMAIL,
      passwordHash: 'not-used-these-tests-call-handlers-directly',
      emailVerified: true,
      status: 'ACTIVE',
    },
  })
  const member = await prisma.member.create({
    data: {
      memberNumber: INVITEE_MEMBER_NUMBER,
      userId: user.id,
      firstName: 'Invitee',
      lastName: 'Target',
      gender: 'MALE',
      status: 'ACTIVE',
    },
  })
  const memberRole = await prisma.role.findUniqueOrThrow({ where: { code: 'MEMBER' } })
  await prisma.userRole.create({ data: { userId: user.id, roleId: memberRole.id } })

  createdUserIds.push(user.id)
  createdMemberIds.push(member.id)
  return { userId: user.id, memberId: member.id, roles: ['MEMBER'] }
}

/** Pulls the raw token out of the DB the way the emailed link would carry it. */
async function tokenFor(memberId: string) {
  const inv = await prisma.memberInvitation.findFirstOrThrow({
    where: { memberId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  })
  // The raw token is never stored, so tests generate a candidate the same way
  // the route does and match on hash. Instead we re-issue a known token here.
  return inv
}

/**
 * These run against a persistent database, and this file creates real login
 * accounts. Anything left behind by an earlier (or half-failed) run would
 * make the first test collide on a unique email, so clear that ground first —
 * keyed on the fake addresses this file owns.
 */
const TEST_EMAILS = [
  'claimtest.child@uat.test',
  'expired.invite@uat.test',
  'revoke.me@uat.test',
  INVITEE_EMAIL,
]

async function purgeLeftovers() {
  const stale = await prisma.user.findMany({
    where: { email: { in: TEST_EMAILS } },
    select: { id: true },
  })
  const ids = stale.map((u) => u.id)
  if (ids.length === 0) return

  await prisma.member.updateMany({ where: { userId: { in: ids } }, data: { userId: null } })
  await prisma.notification.deleteMany({ where: { recipientId: { in: ids } } })
  await prisma.notification.deleteMany({ where: { senderId: { in: ids } } })
  await prisma.userRole.deleteMany({ where: { userId: { in: ids } } })
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } })
  await prisma.user.deleteMany({ where: { id: { in: ids } } })
}

beforeAll(async () => {
  await prisma.memberInvitation.deleteMany({ where: { email: { in: TEST_EMAILS } } })
  await prisma.member.deleteMany({ where: { memberNumber: INVITEE_MEMBER_NUMBER } })
  await purgeLeftovers()
  invitee = await createInvitee()

  const karta = await account('KARTA-01')
  const child = await prisma.member.findFirstOrThrow({
    where: {
      families: { some: { familyId: karta.familyId!, leftAt: null } },
      userId: null,
      lastName: { not: null },
    },
    orderBy: { memberNumber: 'asc' },
    select: { id: true, firstName: true, lastName: true },
  })
  claimChild = child
  createdMemberIds.push(child.id)
})

afterAll(async () => {
  await prisma.memberInvitation.deleteMany({ where: { email: { in: TEST_EMAILS } } })
  await prisma.memberInvitation.deleteMany({ where: { memberId: { in: createdMemberIds } } })
  await prisma.notification.deleteMany({ where: { recipientId: { in: createdUserIds } } })
  await prisma.notification.deleteMany({ where: { senderId: { in: createdUserIds } } })
  await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } })
  await prisma.member.updateMany({ where: { id: { in: createdMemberIds } }, data: { userId: null } })
  // Audit rows reference the actor, so they have to go before the user does.
  await prisma.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } })
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })

  // Remove this file's own throwaway member entirely — it isn't part of the
  // seeded fixture and shouldn't linger in the directory for other tests.
  await prisma.familyJoinRequest.deleteMany({ where: { member: { memberNumber: INVITEE_MEMBER_NUMBER } } })
  await prisma.familyMember.deleteMany({ where: { member: { memberNumber: INVITEE_MEMBER_NUMBER } } })
  await prisma.member.deleteMany({ where: { memberNumber: INVITEE_MEMBER_NUMBER } })
})

describe('TC-INVITE — inviting someone to claim a profile (§12, §34)', () => {
  it('TC-INVITE-001 a Karta invites an account-less member of their own family', async () => {
    const karta = await account('KARTA-01')
    const child = claimChild // account-less seeded member, chosen in beforeAll

    actAs({ userId: karta.userId, roles: karta.roles, memberId: karta.memberId })
    const res = await invite(
      jsonReq('http://x', 'POST', { email: 'claimtest.child@uat.test' }) as any,
      { params: { id: child.id } }
    )
    expect(res.status).toBe(201)

    const invitation = await prisma.memberInvitation.findFirstOrThrow({ where: { memberId: child.id } })
    expect(invitation.status).toBe('PENDING')
    expect(invitation.email).toBe('claimtest.child@uat.test')
    // The raw token must never be persisted — only its hash.
    expect(invitation.tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('TC-INVITE-002 an unrelated member cannot invite someone else\'s relative', async () => {
    const stranger = await account('MEMBER-02')
    const child = claimChild

    actAs({ userId: stranger.userId, roles: stranger.roles, memberId: stranger.memberId })
    const res = await invite(
      jsonReq('http://x', 'POST', { email: 'attacker@uat.test' }) as any,
      { params: { id: child.id } }
    )
    expect(res.status).toBe(403)
  })

  it('TC-INVITE-003 a member who already has an account cannot be invited', async () => {
    const karta = await account('KARTA-01')
    const alreadyHasAccount = await account('MEMBER-01')

    actAs({ userId: karta.userId, roles: karta.roles, memberId: karta.memberId })
    const res = await invite(
      jsonReq('http://x', 'POST', { email: 'dupe@uat.test' }) as any,
      { params: { id: alreadyHasAccount.memberId } }
    )
    expect([403, 409]).toContain(res.status)
  })

  it('TC-INVITE-004 an email already tied to a login is refused', async () => {
    const karta = await account('KARTA-01')
    const existing = await account('MEMBER-01')
    const child = claimChild

    actAs({ userId: karta.userId, roles: karta.roles, memberId: karta.memberId })
    const res = await invite(
      jsonReq('http://x', 'POST', { email: existing.email }) as any,
      { params: { id: child.id } }
    )
    expect(res.status).toBe(409)
    expect((await res.json()).message).toMatch(/already uses that email/i)
  })

  it('TC-INVITE-005 an invalid or unknown token is rejected without leaking anything', async () => {
    anonymous()
    const res = await lookupInvitation(jsonReq('http://x', 'GET') as any, { params: { token: 'not-a-real-token' } })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(JSON.stringify(body)).not.toMatch(/@uat\.test/)
  })

  it('TC-INVITE-006 the claim page shows only a minimal identity, not the whole record', async () => {
    const child = claimChild
    // Re-issue with a token we control, mirroring what the route stores.
    const raw = 'uat-known-token-claim-001'
    await prisma.memberInvitation.updateMany({
      where: { memberId: child.id, status: 'PENDING' },
      data: { tokenHash: hashInvitationToken(raw) },
    })

    anonymous()
    const res = await lookupInvitation(jsonReq('http://x', 'GET') as any, { params: { token: raw } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.member.firstName).toBe(child.firstName)
    // The surname is reduced to an initial — the full name is never returned
    // on this unauthenticated endpoint. (The family name IS returned, so the
    // person can tell which family invited them; here both happen to be
    // "Sharma", which is why this checks the field rather than the whole body.)
    expect(body.member.lastName).toBeUndefined()
    expect(body.member.lastInitial).toBe(`${child.lastName![0]}.`)
    // Nothing else about the record leaks to a link-holder.
    expect(body.member.dateOfBirth).toBeUndefined()
    expect(body.member.mobilePrimary).toBeUndefined()
    expect(body.member.id).toBeUndefined()
  })

  it('TC-INVITE-007 a weak password is refused', async () => {
    anonymous()
    const res = await acceptInvitation(
      jsonReq('http://x', 'POST', { password: 'weak', confirmPassword: 'weak' }) as any,
      { params: { token: 'uat-known-token-claim-001' } }
    )
    expect(res.status).toBe(400)
  })

  it('TC-INVITE-008 accepting creates the login, links the profile, and grants MEMBER', async () => {
    // Read fresh: the point of this test is the transition from unlinked to
    // linked, so the "before" state has to come from the database.
    const child = await prisma.member.findUniqueOrThrow({ where: { id: claimChild.id } })
    expect(child.userId).toBeNull()

    anonymous()
    const res = await acceptInvitation(
      jsonReq('http://x', 'POST', { password: 'ClaimPass1', confirmPassword: 'ClaimPass1' }) as any,
      { params: { token: 'uat-known-token-claim-001' } }
    )
    expect(res.status).toBe(201)

    const linked = await prisma.member.findUniqueOrThrow({
      where: { id: child.id },
      include: { user: { include: { userRoles: { include: { role: true } } } } },
    })
    expect(linked.userId).not.toBeNull()
    createdUserIds.push(linked.userId!)
    expect(linked.user!.email).toBe('claimtest.child@uat.test')
    expect(linked.user!.emailVerified).toBe(true)
    expect(linked.user!.userRoles.map((r) => r.role.code)).toContain('MEMBER')

    const invitation = await prisma.memberInvitation.findFirstOrThrow({ where: { memberId: child.id } })
    expect(invitation.status).toBe('ACCEPTED')
    expect(invitation.acceptedAt).not.toBeNull()
  })

  it('TC-INVITE-009 the same token cannot be used twice', async () => {
    anonymous()
    const res = await acceptInvitation(
      jsonReq('http://x', 'POST', { password: 'ClaimPass2', confirmPassword: 'ClaimPass2' }) as any,
      { params: { token: 'uat-known-token-claim-001' } }
    )
    expect(res.status).toBe(410)
  })

  it('TC-INVITE-010 an expired invitation is refused', async () => {
    const karta = await account('KARTA-01')
    const other = await prisma.member.findFirstOrThrow({
      where: { families: { some: { familyId: karta.familyId!, leftAt: null } }, userId: null },
    })
    createdMemberIds.push(other.id)

    const raw = 'uat-known-token-expired-001'
    await prisma.memberInvitation.create({
      data: {
        memberId: other.id,
        email: 'expired.invite@uat.test',
        tokenHash: hashInvitationToken(raw),
        invitedBy: karta.userId,
        expiresAt: new Date(Date.now() - 86400000), // yesterday
      },
    })

    anonymous()
    const res = await lookupInvitation(jsonReq('http://x', 'GET') as any, { params: { token: raw } })
    expect(res.status).toBe(410)
    expect((await res.json()).message).toMatch(/expired/i)
  })

  it('TC-INVITE-011 a Karta can revoke a pending invitation, killing the link', async () => {
    const karta = await account('KARTA-01')
    const target = await prisma.member.findFirstOrThrow({
      where: { families: { some: { familyId: karta.familyId!, leftAt: null } }, userId: null },
    })
    createdMemberIds.push(target.id)

    actAs({ userId: karta.userId, roles: karta.roles, memberId: karta.memberId })
    await invite(jsonReq('http://x', 'POST', { email: 'revoke.me@uat.test' }) as any, { params: { id: target.id } })

    const raw = 'uat-known-token-revoke-001'
    await prisma.memberInvitation.updateMany({
      where: { memberId: target.id, status: 'PENDING' },
      data: { tokenHash: hashInvitationToken(raw) },
    })

    actAs({ userId: karta.userId, roles: karta.roles, memberId: karta.memberId })
    expect((await revokeInvite(jsonReq('http://x', 'DELETE') as any, { params: { id: target.id } })).status).toBe(200)

    anonymous()
    const res = await lookupInvitation(jsonReq('http://x', 'GET') as any, { params: { token: raw } })
    expect(res.status).toBe(410)
  })
})

describe('TC-FAMINV — a Karta inviting an existing member to their family (§11, §49)', () => {
  let inviteRequestId: string

  it('TC-FAMINV-001 a Karta invites a registered member who belongs to no family', async () => {
    const karta = await account('KARTA-01')

    actAs({ userId: karta.userId, roles: karta.roles, memberId: karta.memberId })
    const res = await postJoinRequest(
      jsonReq('http://x', 'POST', { direction: 'KARTA_INVITE', memberId: invitee.memberId }) as any,
      { params: { id: karta.familyId! } }
    )
    expect(res.status).toBe(201)
    inviteRequestId = (await res.json()).requestId

    const saved = await prisma.familyJoinRequest.findUniqueOrThrow({ where: { id: inviteRequestId } })
    expect(saved.direction).toBe('KARTA_INVITE')
    expect(saved.status).toBe('PENDING')

    // The invited person is the one notified, not the Karta.
    const notif = await prisma.notification.findFirst({
      where: { recipientId: invitee.userId, title: 'Invitation to join a family' },
      orderBy: { createdAt: 'desc' },
    })
    expect(notif).not.toBeNull()
  })

  it('TC-FAMINV-002 the invited person sees it in their own invitations list', async () => {
    actAs({ userId: invitee.userId, roles: invitee.roles, memberId: invitee.memberId })

    const { invitations } = await (await myInvitations()).json()
    expect(invitations.map((i: any) => i.id)).toContain(inviteRequestId)
  })

  it('TC-FAMINV-003 the KARTA CANNOT accept their own invitation on the invitee\'s behalf', async () => {
    const karta = await account('KARTA-01')
    actAs({ userId: karta.userId, roles: karta.roles, memberId: karta.memberId })

    const res = await respondJoinRequest(
      jsonReq('http://x', 'PATCH', { decision: 'APPROVE' }) as any,
      { params: { id: karta.familyId!, reqId: inviteRequestId } }
    )
    expect(res.status).toBe(403)
    expect((await res.json()).message).toMatch(/only the person who was invited/i)

    // And nothing was added behind the scenes.
    const link = await prisma.familyMember.findFirst({ where: { memberId: invitee.memberId, leftAt: null } })
    expect(link).toBeNull()
  })

  it('TC-FAMINV-004 an unrelated third party cannot accept it either', async () => {
    const stranger = await account('MEMBER-02')
    const karta = await account('KARTA-01')
    actAs({ userId: stranger.userId, roles: stranger.roles, memberId: stranger.memberId })

    const res = await respondJoinRequest(
      jsonReq('http://x', 'PATCH', { decision: 'APPROVE' }) as any,
      { params: { id: karta.familyId!, reqId: inviteRequestId } }
    )
    expect(res.status).toBe(403)
  })

  it('TC-FAMINV-005 the invited person accepts, and only then are they in the family', async () => {
    const karta = await account('KARTA-01')
    actAs({ userId: invitee.userId, roles: invitee.roles, memberId: invitee.memberId })

    const res = await respondJoinRequest(
      jsonReq('http://x', 'PATCH', { decision: 'APPROVE' }) as any,
      { params: { id: karta.familyId!, reqId: inviteRequestId } }
    )
    expect(res.status).toBe(200)

    const link = await prisma.familyMember.findFirst({
      where: { memberId: invitee.memberId, familyId: karta.familyId!, leftAt: null },
    })
    expect(link).not.toBeNull()

    // Detach again so the later direction test starts from "no family".
    await prisma.familyMember.deleteMany({ where: { memberId: invitee.memberId } })
    await prisma.familyJoinRequest.deleteMany({ where: { id: inviteRequestId } })
  })

  it('TC-FAMINV-006 inviting an account-less profile is refused — nobody could consent', async () => {
    const karta = await account('KARTA-02')
    const accountless = await prisma.member.findFirstOrThrow({
      where: { userId: null, families: { none: {} } },
    }).catch(async () => {
      // Any account-less member will do for this check.
      return prisma.member.findFirstOrThrow({ where: { userId: null } })
    })

    actAs({ userId: karta.userId, roles: karta.roles, memberId: karta.memberId })
    const res = await postJoinRequest(
      jsonReq('http://x', 'POST', { direction: 'KARTA_INVITE', memberId: accountless.id }) as any,
      { params: { id: karta.familyId! } }
    )
    expect(res.status).toBe(409)
    expect((await res.json()).message).toMatch(/no account yet/i)
  })

  it('TC-FAMINV-007 a non-Karta cannot send invitations on the family\'s behalf', async () => {
    const plainMember = await account('MEMBER-01')
    const karta = await account('KARTA-02')

    actAs({ userId: plainMember.userId, roles: plainMember.roles, memberId: plainMember.memberId })
    const res = await postJoinRequest(
      jsonReq('http://x', 'POST', { direction: 'KARTA_INVITE', memberId: plainMember.memberId }) as any,
      { params: { id: karta.familyId! } }
    )
    expect(res.status).toBe(403)
  })

  it('TC-FAMINV-008 the original member-asks-Karta direction still works unchanged', async () => {
    const karta = await account('KARTA-02')

    // The member asks.
    actAs({ userId: invitee.userId, roles: invitee.roles, memberId: invitee.memberId })
    const created = await postJoinRequest(
      jsonReq('http://x', 'POST', {}) as any,
      { params: { id: karta.familyId! } }
    )
    expect(created.status).toBe(201)
    const reqId = (await created.json()).requestId

    // The member cannot approve their own request — this direction is the
    // Karta's call, and the direction-aware check must not have opened a hole.
    const selfApprove = await respondJoinRequest(
      jsonReq('http://x', 'PATCH', { decision: 'APPROVE' }) as any,
      { params: { id: karta.familyId!, reqId } }
    )
    expect(selfApprove.status).toBe(403)

    // The Karta can.
    actAs({ userId: karta.userId, roles: karta.roles, memberId: karta.memberId })
    const approved = await respondJoinRequest(
      jsonReq('http://x', 'PATCH', { decision: 'APPROVE' }) as any,
      { params: { id: karta.familyId!, reqId } }
    )
    expect(approved.status).toBe(200)

    await prisma.familyMember.deleteMany({ where: { memberId: invitee.memberId } })
    await prisma.familyJoinRequest.deleteMany({ where: { id: reqId } })
  })
})
