import { describe, it, expect, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { GET as getMember } from '@/app/api/members/[id]/route'
import { GET as getVisibility, PATCH as patchVisibility } from '@/app/api/members/[id]/visibility/route'
import { GET as listProfiles } from '@/app/api/matrimony/profiles/route'
import { POST as postInterest, GET as getInterests } from '@/app/api/matrimony/interests/route'
import { PATCH as patchInterest } from '@/app/api/matrimony/interests/[id]/route'
import { account, actAs, jsonReq } from './helpers'

describe('TC-PRIV — field visibility', () => {
  it('TC-PRIV-001 a member can set their mobile to Private and another member stops seeing it', async () => {
    const owner = await account('MEMBER-01')
    const other = await account('MEMBER-02')
    await prisma.member.update({ where: { id: owner.memberId }, data: { mobilePrimary: '9800000001' } })

    actAs({ userId: owner.userId, roles: owner.roles, memberId: owner.memberId })
    const saveRes = await patchVisibility(
      jsonReq('http://x', 'PATCH', { settings: { mobile_primary: 'PRIVATE' } }) as any,
      { params: { id: owner.memberId } }
    )
    expect(saveRes.status).toBe(200)

    // The owner still sees their own number...
    const own = await (await getMember(jsonReq('http://x', 'GET') as any, { params: { id: owner.memberId } })).json()
    expect(own.mobilePrimary).toBe('9800000001')

    // ...another member does not.
    actAs({ userId: other.userId, roles: other.roles, memberId: other.memberId })
    const seen = await (await getMember(jsonReq('http://x', 'GET') as any, { params: { id: owner.memberId } })).json()
    expect(seen.mobilePrimary).toBeNull()
  })

  it('TC-PRIV-002 privacy settings persist and are readable back by the owner', async () => {
    const owner = await account('MEMBER-01')
    actAs({ userId: owner.userId, roles: owner.roles, memberId: owner.memberId })
    const res = await getVisibility(jsonReq('http://x', 'GET') as any, { params: { id: owner.memberId } })
    expect((await res.json()).settings.mobile_primary).toBe('PRIVATE')
  })

  it('TC-PRIV-003 staff can still see the field (support access), and it is a deliberate exception', async () => {
    const owner = await account('MEMBER-01')
    const op = await account('OPERATOR-01')
    actAs({ userId: op.userId, roles: op.roles, memberId: op.memberId })
    const seen = await (await getMember(jsonReq('http://x', 'GET') as any, { params: { id: owner.memberId } })).json()
    expect(seen.mobilePrimary).toBe('9800000001')
  })

  it('TC-PRIV-004 widening visibility to community makes the field visible again', async () => {
    const owner = await account('MEMBER-01')
    const other = await account('MEMBER-02')
    actAs({ userId: owner.userId, roles: owner.roles, memberId: owner.memberId })
    await patchVisibility(
      jsonReq('http://x', 'PATCH', { settings: { mobile_primary: 'REGISTERED_MEMBERS' } }) as any,
      { params: { id: owner.memberId } }
    )

    actAs({ userId: other.userId, roles: other.roles, memberId: other.memberId })
    const seen = await (await getMember(jsonReq('http://x', 'GET') as any, { params: { id: owner.memberId } })).json()
    expect(seen.mobilePrimary).toBe('9800000001')

    // restore the conservative default for later runs
    actAs({ userId: owner.userId, roles: owner.roles, memberId: owner.memberId })
    await patchVisibility(jsonReq('http://x', 'PATCH', { settings: { mobile_primary: 'PRIVATE' } }) as any, { params: { id: owner.memberId } })
  })
})

describe('TC-MAT — matrimony', () => {
  async function ensureProfile(memberId: string, isVisible: boolean) {
    return prisma.matrimonialProfile.upsert({
      where: { memberId },
      update: { isVisible },
      create: { memberId, isVisible, about: 'UAT profile' },
    })
  }

  it('TC-MAT-001/002 a visible profile is listed; opting out removes it', async () => {
    const m = await account('MEMBER-02')
    const viewer = await account('MEMBER-01')
    await ensureProfile(m.memberId, true)

    actAs({ userId: viewer.userId, roles: viewer.roles, memberId: viewer.memberId })
    let listed = await (await listProfiles(jsonReq('http://x/api/matrimony/profiles', 'GET') as any)).json()
    const ids = (listed.profiles ?? listed).map?.((p: any) => p.memberId) ?? []
    expect(ids).toContain(m.memberId)

    await ensureProfile(m.memberId, false) // opt out
    listed = await (await listProfiles(jsonReq('http://x/api/matrimony/profiles', 'GET') as any)).json()
    const idsAfter = (listed.profiles ?? listed).map?.((p: any) => p.memberId) ?? []
    expect(idsAfter).not.toContain(m.memberId)
  })

  it('TC-MAT-007/008 interest can be sent, then accepted, and notifies the sender', async () => {
    const from = await account('MEMBER-01')
    const to = await account('MEMBER-02')
    await ensureProfile(to.memberId, true)
    await prisma.matrimonialInterest.deleteMany({ where: { fromMemberId: from.memberId, toMemberId: to.memberId } })

    actAs({ userId: from.userId, roles: from.roles, memberId: from.memberId })
    const sendRes = await postInterest(jsonReq('http://x', 'POST', { toMemberId: to.memberId }) as any)
    expect(sendRes.status).toBe(201)
    const { interest } = await sendRes.json()

    // Recipient is notified.
    const notif = await prisma.notification.findFirst({
      where: { recipientId: to.userId, type: 'MATRIMONIAL_INTEREST' }, orderBy: { createdAt: 'desc' },
    })
    expect(notif).not.toBeNull()

    // Recipient accepts.
    actAs({ userId: to.userId, roles: to.roles, memberId: to.memberId })
    const acceptRes = await patchInterest(jsonReq('http://x', 'PATCH', { action: 'accept' }) as any, { params: { id: interest.id } })
    expect(acceptRes.status).toBe(200)
    expect((await prisma.matrimonialInterest.findUniqueOrThrow({ where: { id: interest.id } })).status).toBe('ACCEPTED')
  })

  it('TC-MAT-009 a third party cannot accept someone else\'s interest', async () => {
    const from = await account('MEMBER-01')
    const to = await account('MEMBER-02')
    const stranger = await account('KARTA-02')
    await prisma.matrimonialInterest.deleteMany({ where: { fromMemberId: from.memberId, toMemberId: to.memberId } })

    actAs({ userId: from.userId, roles: from.roles, memberId: from.memberId })
    const { interest } = await (await postInterest(jsonReq('http://x', 'POST', { toMemberId: to.memberId }) as any)).json()

    actAs({ userId: stranger.userId, roles: stranger.roles, memberId: stranger.memberId })
    const res = await patchInterest(jsonReq('http://x', 'PATCH', { action: 'accept' }) as any, { params: { id: interest.id } })
    expect(res.status).toBe(403)

    await prisma.matrimonialInterest.deleteMany({ where: { id: interest.id } })
  })

  it('TC-MAT-010 DEFECT CHECK: does a MARRIED member still appear in matrimony results?', async () => {
    const m = await account('MEMBER-02')
    const viewer = await account('MEMBER-01')
    await ensureProfile(m.memberId, true)
    await prisma.member.update({ where: { id: m.memberId }, data: { maritalStatus: 'MARRIED' } })

    actAs({ userId: viewer.userId, roles: viewer.roles, memberId: viewer.memberId })
    const listed = await (await listProfiles(jsonReq('http://x/api/matrimony/profiles', 'GET') as any)).json()
    const ids = (listed.profiles ?? listed).map?.((p: any) => p.memberId) ?? []

    await prisma.member.update({ where: { id: m.memberId }, data: { maritalStatus: 'UNMARRIED' } })
    await ensureProfile(m.memberId, false)

    // Documents current behaviour: listing filters on isVisible only, so a
    // married member is NOT excluded automatically.
    expect(ids).toContain(m.memberId)
  })
})
