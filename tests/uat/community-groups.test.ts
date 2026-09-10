import { describe, it, expect, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { POST as postGroup, GET as getGroups } from '@/app/api/groups/route'
import { GET as getGroup, PATCH as patchGroup, DELETE as deleteGroup } from '@/app/api/groups/[id]/route'
import { GET as getRoster, POST as addRoster, DELETE as removeRoster } from '@/app/api/groups/[id]/members/route'
import { POST as reviewRoster } from '@/app/api/groups/[id]/roster-review/route'
import { PATCH as patchApproval } from '@/app/api/approvals/[id]/route'
import { account, jsonReq, actAs } from './helpers'

let groupId: string

afterAll(async () => {
  if (groupId) {
    await prisma.communityGroupMember.deleteMany({ where: { groupId } })
    await prisma.approval.deleteMany({ where: { entityId: groupId } })
    await prisma.auditLog.deleteMany({ where: { entityId: groupId } })
    await prisma.communityGroup.deleteMany({ where: { id: groupId } })
  }
})

describe('TC-GROUP — registration and approval', () => {
  it('TC-GROUP-001 a member registers a community group; it starts held for approval, convener auto-added', async () => {
    const convener = await account('MEMBER-01')
    actAs({ userId: convener.userId, roles: convener.roles, memberId: convener.memberId })

    const res = await postGroup(jsonReq('http://x/api/groups', 'POST', {
      name: 'Kothrud Yuvak Mandal', groupType: 'YUVAK_MANDAL', maxMembers: 25,
    }) as any)
    expect(res.status).toBe(201)
    groupId = (await res.json()).groupId

    const group = await prisma.communityGroup.findUniqueOrThrow({ where: { id: groupId } })
    expect(group.status).toBe('PENDING_APPROVAL')
    expect(group.convenerMemberId).toBe(convener.memberId)

    const roster = await prisma.communityGroupMember.findMany({ where: { groupId } })
    expect(roster).toHaveLength(1)
    expect(roster[0].memberId).toBe(convener.memberId)
    expect(roster[0].roleInGroup).toBe('CONVENER')
  })

  it('TC-GROUP-002 an unapproved group is not visible to ordinary members', async () => {
    const other = await account('MEMBER-02')
    actAs({ userId: other.userId, roles: other.roles, memberId: other.memberId })
    const res = await getGroups(jsonReq('http://x/api/groups', 'GET') as any)
    const { groups } = await res.json()
    expect(groups.map((g: any) => g.id)).not.toContain(groupId)
  })

  it('TC-GROUP-003 a stranger cannot GET the pending group directly, but the convener can', async () => {
    const other = await account('MEMBER-02')
    actAs({ userId: other.userId, roles: other.roles, memberId: other.memberId })
    expect((await getGroup(jsonReq('http://x', 'GET') as any, { params: { id: groupId } })).status).toBe(404)

    const convener = await account('MEMBER-01')
    actAs({ userId: convener.userId, roles: convener.roles, memberId: convener.memberId })
    expect((await getGroup(jsonReq('http://x', 'GET') as any, { params: { id: groupId } })).status).toBe(200)
  })

  it('TC-GROUP-004 an operator approves it, and it becomes visible to everyone', async () => {
    const op = await account('OPERATOR-01')
    const approval = await prisma.approval.findFirstOrThrow({
      where: { actionCode: 'group.create', entityId: groupId, status: 'SUBMITTED' },
    })
    actAs({ userId: op.userId, roles: op.roles, memberId: op.memberId })
    expect((await patchApproval(jsonReq('http://x', 'PATCH', { action: 'approve' }) as any, { params: { id: approval.id } })).status).toBe(200)

    expect((await prisma.communityGroup.findUniqueOrThrow({ where: { id: groupId } })).status).toBe('ACTIVE')

    const other = await account('MEMBER-02')
    actAs({ userId: other.userId, roles: other.roles, memberId: other.memberId })
    const { groups } = await (await getGroups(jsonReq('http://x/api/groups', 'GET') as any)).json()
    expect(groups.map((g: any) => g.id)).toContain(groupId)
  })
})

describe('TC-ROSTER — roster management and periodic review', () => {
  it('TC-ROSTER-001 a non-convener, non-staff member cannot add to the roster', async () => {
    const stranger = await account('MEMBER-02')
    const target = await account('KARTA-01')
    actAs({ userId: stranger.userId, roles: stranger.roles, memberId: stranger.memberId })

    const res = await addRoster(
      jsonReq('http://x', 'POST', { memberId: target.memberId }) as any,
      { params: { id: groupId } }
    )
    expect(res.status).toBe(403)
  })

  it('TC-ROSTER-002 the convener adds a member to the roster', async () => {
    const convener = await account('MEMBER-01')
    const target = await account('KARTA-01')
    actAs({ userId: convener.userId, roles: convener.roles, memberId: convener.memberId })

    const res = await addRoster(
      jsonReq('http://x', 'POST', { memberId: target.memberId }) as any,
      { params: { id: groupId } }
    )
    expect(res.status).toBe(201)

    const roster = await (await getRoster(jsonReq('http://x', 'GET') as any, { params: { id: groupId } })).json()
    expect(roster.roster.map((r: any) => r.memberId)).toContain(target.memberId)
  })

  it('TC-ROSTER-003 adding the same member twice is refused', async () => {
    const convener = await account('MEMBER-01')
    const target = await account('KARTA-01')
    actAs({ userId: convener.userId, roles: convener.roles, memberId: convener.memberId })

    const res = await addRoster(
      jsonReq('http://x', 'POST', { memberId: target.memberId }) as any,
      { params: { id: groupId } }
    )
    expect(res.status).toBe(409)
  })

  it('TC-ROSTER-004 the roster is capped at maxMembers', async () => {
    const convener = await account('MEMBER-01')
    await prisma.communityGroup.update({ where: { id: groupId }, data: { maxMembers: 2 } })
    actAs({ userId: convener.userId, roles: convener.roles, memberId: convener.memberId })

    const other = await account('KARTA-02')
    const res = await addRoster(
      jsonReq('http://x', 'POST', { memberId: other.memberId }) as any,
      { params: { id: groupId } }
    )
    expect(res.status).toBe(409)
    expect((await res.json()).message).toMatch(/capped/i)

    await prisma.communityGroup.update({ where: { id: groupId }, data: { maxMembers: 25 } })
  })

  it('TC-ROSTER-005 the convener removes a member; they leave with history intact', async () => {
    const convener = await account('MEMBER-01')
    const target = await account('KARTA-01')
    actAs({ userId: convener.userId, roles: convener.roles, memberId: convener.memberId })

    const res = await removeRoster(
      jsonReq(`http://x?memberId=${target.memberId}`, 'DELETE') as any,
      { params: { id: groupId } }
    )
    expect(res.status).toBe(200)

    const active = await prisma.communityGroupMember.findFirst({ where: { groupId, memberId: target.memberId, leftAt: null } })
    expect(active).toBeNull()
    const historical = await prisma.communityGroupMember.findFirst({ where: { groupId, memberId: target.memberId } })
    expect(historical).not.toBeNull()
    expect(historical!.leftAt).not.toBeNull()
  })

  it('TC-ROSTER-006 the convener confirms the roster is current — updates the review timestamp', async () => {
    const convener = await account('MEMBER-01')
    actAs({ userId: convener.userId, roles: convener.roles, memberId: convener.memberId })

    const before = (await prisma.communityGroup.findUniqueOrThrow({ where: { id: groupId } })).lastRosterReviewAt
    expect(before).toBeNull()

    const res = await reviewRoster(jsonReq('http://x', 'POST', {}) as any, { params: { id: groupId } })
    expect(res.status).toBe(200)

    const after = await prisma.communityGroup.findUniqueOrThrow({ where: { id: groupId } })
    expect(after.lastRosterReviewAt).not.toBeNull()
    expect(after.lastRosterReviewBy).toBe(convener.userId)
  })

  it('TC-ROSTER-007 a non-convener cannot edit the group, but staff can', async () => {
    const stranger = await account('MEMBER-02')
    actAs({ userId: stranger.userId, roles: stranger.roles, memberId: stranger.memberId })
    expect((await patchGroup(jsonReq('http://x', 'PATCH', { name: 'Hijacked' }) as any, { params: { id: groupId } })).status).toBe(403)

    const op = await account('OPERATOR-01')
    actAs({ userId: op.userId, roles: op.roles, memberId: op.memberId })
    const res = await patchGroup(jsonReq('http://x', 'PATCH', { meetingSchedule: 'First Friday, 7pm' }) as any, { params: { id: groupId } })
    expect(res.status).toBe(200)
    expect((await prisma.communityGroup.findUniqueOrThrow({ where: { id: groupId } })).meetingSchedule).toBe('First Friday, 7pm')
  })

  it('TC-ROSTER-008 only the convener or staff can soft-delete the group', async () => {
    const stranger = await account('MEMBER-02')
    actAs({ userId: stranger.userId, roles: stranger.roles, memberId: stranger.memberId })
    expect((await deleteGroup(jsonReq('http://x', 'DELETE') as any, { params: { id: groupId } })).status).toBe(403)
  })
})
