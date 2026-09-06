import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { POST as postAsset, GET as getAssets } from '@/app/api/assets/route'
import { POST as postBooking, GET as getBookings } from '@/app/api/assets/[id]/bookings/route'
import { POST as settle, GET as mockPay } from '@/app/api/payments/[id]/settle/route'
import { GET as getFees, POST as payFee } from '@/app/api/fees/route'
import { PATCH as patchApproval } from '@/app/api/approvals/[id]/route'
import { POST as createPost } from '@/app/api/posts/route'
import { PATCH as moderatePost } from '@/app/api/posts/[id]/moderate/route'
import { POST as postFamilies } from '@/app/api/families/route'
import { account, actAs, jsonReq } from './helpers'
import { computeSignature } from '@/lib/payments'

const tomorrow = (days = 1, hour = 10) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, 0, 0, 0)
  return d
}

let assetId: string

beforeAll(async () => {
  await prisma.feeType.upsert({
    where: { code: 'FAMILY_REGISTRATION' },
    update: { amountPaise: 200000, isActive: true },
    create: { code: 'FAMILY_REGISTRATION', label: 'Family Registration Fee', amountPaise: 200000, isActive: true },
  })
})

afterAll(async () => {
  if (assetId) {
    await prisma.payment.deleteMany({ where: { booking: { assetId } } })
    await prisma.booking.deleteMany({ where: { assetId } })
    await prisma.assetBlackout.deleteMany({ where: { assetId } })
    await prisma.approval.deleteMany({ where: { entityId: assetId } })
    await prisma.auditLog.deleteMany({ where: { entityId: assetId } })
    await prisma.asset.deleteMany({ where: { id: assetId } })
  }
})

describe('TC-ASSET — registration and approval', () => {
  it('TC-ASSET-001 an owner registers an asset; it starts held for approval', async () => {
    const owner = await account('OWNER-01')
    actAs({ userId: owner.userId, roles: owner.roles, memberId: owner.memberId })

    const res = await postAsset(jsonReq('http://x/api/assets', 'POST', {
      name: 'Samaj Community Hall', assetType: 'HALL', city: 'Pune',
      capacity: 200, bookingMode: 'DAILY', ratePerDay: 5000, // ₹5,000/day
      facilities: ['Parking', 'Kitchen'],
    }) as any)
    expect(res.status).toBe(201)
    assetId = (await res.json()).assetId

    const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } })
    expect(asset.status).toBe('PENDING_APPROVAL')
    expect(asset.ratePerDay).toBe(500000) // stored as paise, no float
  })

  it('TC-ASSET-002 an unapproved asset is not visible to ordinary members', async () => {
    const member = await account('MEMBER-01')
    actAs({ userId: member.userId, roles: member.roles, memberId: member.memberId })
    const res = await getAssets(jsonReq('http://x/api/assets', 'GET') as any)
    const { assets } = await res.json()
    expect(assets.map((a: any) => a.id)).not.toContain(assetId)
  })

  it('TC-ASSET-003 it cannot be booked while unapproved', async () => {
    const member = await account('MEMBER-01')
    actAs({ userId: member.userId, roles: member.roles, memberId: member.memberId })
    const res = await postBooking(
      jsonReq('http://x', 'POST', { startAt: tomorrow(3), endAt: tomorrow(4) }) as any,
      { params: { id: assetId } }
    )
    expect(res.status).toBe(409)
  })

  it('TC-ASSET-004 an operator approves it, and it becomes visible and bookable', async () => {
    const op = await account('OPERATOR-01')
    const approval = await prisma.approval.findFirstOrThrow({
      where: { actionCode: 'asset.create', entityId: assetId, status: 'SUBMITTED' },
    })
    actAs({ userId: op.userId, roles: op.roles, memberId: op.memberId })
    expect((await patchApproval(jsonReq('http://x', 'PATCH', { action: 'approve' }) as any, { params: { id: approval.id } })).status).toBe(200)

    expect((await prisma.asset.findUniqueOrThrow({ where: { id: assetId } })).status).toBe('APPROVED')

    const member = await account('MEMBER-01')
    actAs({ userId: member.userId, roles: member.roles, memberId: member.memberId })
    const { assets } = await (await getAssets(jsonReq('http://x/api/assets', 'GET') as any)).json()
    expect(assets.map((a: any) => a.id)).toContain(assetId)
  })
})

describe('TC-BOOK — booking, availability and payment', () => {
  it('TC-BOOK-001 booking quotes the right price and holds the slot pending payment', async () => {
    const member = await account('MEMBER-01')
    actAs({ userId: member.userId, roles: member.roles, memberId: member.memberId })

    const res = await postBooking(
      jsonReq('http://x', 'POST', { startAt: tomorrow(5), endAt: tomorrow(7), guestCount: 50 }) as any,
      { params: { id: assetId } }
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.booking.status).toBe('PENDING_PAYMENT')
    expect(body.booking.amountPaise).toBe(2 * 500000) // 2 days × ₹5,000
    expect(body.payment.amountPaise).toBe(1000000)
  })

  it('TC-BOOK-002 DOUBLE BOOKING is refused (enforced by the database)', async () => {
    const other = await account('MEMBER-02')
    actAs({ userId: other.userId, roles: other.roles, memberId: other.memberId })

    // Overlaps the slot booked above.
    const res = await postBooking(
      jsonReq('http://x', 'POST', { startAt: tomorrow(6), endAt: tomorrow(8) }) as any,
      { params: { id: assetId } }
    )
    expect(res.status).toBe(409)
    expect((await res.json()).message).toMatch(/just been taken|different time/i)
  })

  it('TC-BOOK-002b CONCURRENT double booking: only one of two simultaneous requests wins', async () => {
    const a = await account('MEMBER-01')
    const b = await account('MEMBER-02')
    const start = tomorrow(20)
    const end = tomorrow(21)

    // Fire both without awaiting in between — this is the race an
    // application-level "is it free?" check would lose.
    const reqA = (async () => {
      actAs({ userId: a.userId, roles: a.roles, memberId: a.memberId })
      return postBooking(jsonReq('http://x', 'POST', { startAt: start, endAt: end }) as any, { params: { id: assetId } })
    })()
    const reqB = (async () => {
      actAs({ userId: b.userId, roles: b.roles, memberId: b.memberId })
      return postBooking(jsonReq('http://x', 'POST', { startAt: start, endAt: end }) as any, { params: { id: assetId } })
    })()

    const [resA, resB] = await Promise.all([reqA, reqB])
    const statuses = [resA.status, resB.status].sort()
    expect(statuses).toEqual([201, 409]) // exactly one succeeded

    const held = await prisma.booking.count({
      where: { assetId, startAt: start, status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] } },
    })
    expect(held).toBe(1)
  })

  it('TC-BOOK-003 a cancelled booking frees the slot again', async () => {
    const member = await account('MEMBER-01')
    const start = tomorrow(30)
    const end = tomorrow(31)
    actAs({ userId: member.userId, roles: member.roles, memberId: member.memberId })

    const first = await postBooking(jsonReq('http://x', 'POST', { startAt: start, endAt: end }) as any, { params: { id: assetId } })
    const { booking } = await first.json()
    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } })

    // The same slot can now be booked by someone else.
    const other = await account('MEMBER-02')
    actAs({ userId: other.userId, roles: other.roles, memberId: other.memberId })
    const second = await postBooking(jsonReq('http://x', 'POST', { startAt: start, endAt: end }) as any, { params: { id: assetId } })
    expect(second.status).toBe(201)
  })

  it('TC-PAY-001 a booking is only CONFIRMED after server-verified payment', async () => {
    const member = await account('MEMBER-01')
    actAs({ userId: member.userId, roles: member.roles, memberId: member.memberId })
    const { booking, payment } = await (await postBooking(
      jsonReq('http://x', 'POST', { startAt: tomorrow(40), endAt: tomorrow(41) }) as any,
      { params: { id: assetId } }
    )).json()

    // Still unconfirmed before payment.
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('PENDING_PAYMENT')

    const creds = await (await mockPay(jsonReq('http://x', 'GET') as any, { params: { id: payment.id } })).json()
    const res = await settle(jsonReq('http://x', 'POST', {
      gatewayPaymentId: creds.gatewayPaymentId, signature: creds.signature,
    }) as any, { params: { id: payment.id } })
    expect(res.status).toBe(200)

    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('CONFIRMED')
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('PAID')
  })

  it('TC-PAY-002 a forged signature never marks a payment paid', async () => {
    const member = await account('MEMBER-01')
    actAs({ userId: member.userId, roles: member.roles, memberId: member.memberId })
    const { booking, payment } = await (await postBooking(
      jsonReq('http://x', 'POST', { startAt: tomorrow(50), endAt: tomorrow(51) }) as any,
      { params: { id: assetId } }
    )).json()

    const res = await settle(jsonReq('http://x', 'POST', {
      gatewayPaymentId: 'pay_forged', signature: 'deadbeef'.repeat(8),
    }) as any, { params: { id: payment.id } })

    expect(res.status).toBe(400)
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('FAILED')
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('PENDING_PAYMENT')
  })

  it('TC-PAY-003 a replayed gateway callback does not double-apply', async () => {
    const member = await account('MEMBER-01')
    actAs({ userId: member.userId, roles: member.roles, memberId: member.memberId })
    const { payment } = await (await postBooking(
      jsonReq('http://x', 'POST', { startAt: tomorrow(60), endAt: tomorrow(61) }) as any,
      { params: { id: assetId } }
    )).json()

    const creds = await (await mockPay(jsonReq('http://x', 'GET') as any, { params: { id: payment.id } })).json()
    const payload = { gatewayPaymentId: creds.gatewayPaymentId, signature: creds.signature }

    const first = await settle(jsonReq('http://x', 'POST', payload) as any, { params: { id: payment.id } })
    const second = await settle(jsonReq('http://x', 'POST', payload) as any, { params: { id: payment.id } })

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect((await second.json()).alreadySettled).toBe(true)
    expect(await prisma.payment.count({ where: { id: payment.id, status: 'PAID' } })).toBe(1)
  })
})

describe('TC-FEE — family registration fee', () => {
  it('TC-FEE-001 registering a family raises an invoice against the Karta', async () => {
    const m = await account('MEMBER-02')
    await prisma.familyMember.deleteMany({ where: { memberId: m.memberId } })
    actAs({ userId: m.userId, roles: ['MEMBER'], memberId: m.memberId })

    const res = await postFamilies(jsonReq('http://x/api/families', 'POST', { name: 'FeeTest' }) as any)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.registrationFee).not.toBeNull()
    expect(body.registrationFee.amountPaise).toBe(200000) // ₹2,000

    const invoice = await prisma.feeInvoice.findUniqueOrThrow({ where: { id: body.registrationFee.invoiceId } })
    expect(invoice.memberId).toBe(m.memberId) // billed to the Karta
    expect(invoice.status).toBe('PENDING')

    // Paying it settles the invoice.
    const payRes = await payFee(jsonReq('http://x/api/fees', 'POST', { invoiceId: invoice.id }) as any)
    const { payment } = await payRes.json()
    const creds = await (await mockPay(jsonReq('http://x', 'GET') as any, { params: { id: payment.id } })).json()
    await settle(jsonReq('http://x', 'POST', {
      gatewayPaymentId: creds.gatewayPaymentId, signature: creds.signature,
    }) as any, { params: { id: payment.id } })

    expect((await prisma.feeInvoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe('PAID')

    // cleanup
    const familyId = body.familyId
    await prisma.payment.deleteMany({ where: { feeInvoiceId: invoice.id } })
    await prisma.feeInvoice.deleteMany({ where: { id: invoice.id } })
    await prisma.userRole.deleteMany({ where: { userId: m.userId, familyId } })
    await prisma.familyMember.deleteMany({ where: { familyId } })
    await prisma.approval.deleteMany({ where: { entityId: familyId } })
    await prisma.auditLog.deleteMany({ where: { entityId: familyId } })
    await prisma.family.delete({ where: { id: familyId } })
  })

  it('TC-FEE-002 a member who JOINS an existing family is never billed', async () => {
    const joiner = await account('MEMBER-01') // plain member of Family-01
    const invoices = await prisma.feeInvoice.findMany({ where: { memberId: joiner.memberId } })
    expect(invoices).toHaveLength(0)

    actAs({ userId: joiner.userId, roles: joiner.roles, memberId: joiner.memberId })
    const res = await getFees()
    expect((await res.json()).invoices).toHaveLength(0)
  })

  it('TC-FEE-003 nobody else can pay another member\'s invoice', async () => {
    const karta = await account('KARTA-01')
    const stranger = await account('MEMBER-01')
    const feeType = await prisma.feeType.findUniqueOrThrow({ where: { code: 'FAMILY_REGISTRATION' } })
    const invoice = await prisma.feeInvoice.create({
      data: {
        reference: `FEE-TEST-${Date.now()}`, feeTypeId: feeType.id, familyId: karta.familyId,
        memberId: karta.memberId, amountPaise: 200000, status: 'PENDING',
      },
    })

    actAs({ userId: stranger.userId, roles: stranger.roles, memberId: stranger.memberId })
    const res = await payFee(jsonReq('http://x/api/fees', 'POST', { invoiceId: invoice.id }) as any)
    expect(res.status).toBe(403)

    await prisma.feeInvoice.delete({ where: { id: invoice.id } })
  })
})

describe('TC-POST — moderation', () => {
  const created: string[] = []
  afterAll(async () => {
    if (created.length) {
      await prisma.notification.deleteMany({ where: { data: { path: ['postId'], not: undefined } } }).catch(() => {})
      await prisma.auditLog.deleteMany({ where: { entityId: { in: created } } })
      await prisma.post.deleteMany({ where: { id: { in: created } } })
    }
  })

  it('TC-POST-001 a member\'s post is held for approval, not published', async () => {
    const member = await account('MEMBER-01')
    const postType = await prisma.postType.findFirstOrThrow({ where: { code: 'GENERAL' } })
    actAs({ userId: member.userId, roles: member.roles, memberId: member.memberId })

    const res = await createPost(jsonReq('http://x/api/posts', 'POST', {
      postTypeId: postType.id, title: 'Hello', content: 'Awaiting moderation',
    }) as any)
    expect(res.status).toBe(201)
    const body = await res.json()
    created.push(body.postId)

    expect(body.status).toBe('PENDING_APPROVAL')
    expect(body.message).toMatch(/moderator/i)

    // Not in the feed.
    const feed = await prisma.post.findMany({ where: { status: 'PUBLISHED', deletedAt: null } })
    expect(feed.map((p) => p.id)).not.toContain(body.postId)
  })

  it('TC-POST-002 an ordinary member cannot moderate', async () => {
    const member = await account('MEMBER-02')
    actAs({ userId: member.userId, roles: member.roles, memberId: member.memberId })
    const res = await moderatePost(jsonReq('http://x', 'PATCH', { action: 'approve' }) as any, { params: { id: created[0] } })
    expect(res.status).toBe(403)
  })

  it('TC-POST-003 an operator approves it and it appears in the feed, author notified', async () => {
    const op = await account('OPERATOR-01')
    const member = await account('MEMBER-01')
    actAs({ userId: op.userId, roles: op.roles, memberId: op.memberId })

    const res = await moderatePost(jsonReq('http://x', 'PATCH', { action: 'approve' }) as any, { params: { id: created[0] } })
    expect(res.status).toBe(200)
    expect((await prisma.post.findUniqueOrThrow({ where: { id: created[0] } })).status).toBe('PUBLISHED')

    const notif = await prisma.notification.findFirst({
      where: { recipientId: member.userId, type: 'APPROVAL_STATUS' }, orderBy: { createdAt: 'desc' },
    })
    expect(notif?.title).toMatch(/live/i)
  })

  it('TC-POST-004 a rejected post stays out of the feed', async () => {
    const member = await account('MEMBER-01')
    const op = await account('OPERATOR-01')
    const postType = await prisma.postType.findFirstOrThrow({ where: { code: 'GENERAL' } })

    actAs({ userId: member.userId, roles: member.roles, memberId: member.memberId })
    const { postId } = await (await createPost(jsonReq('http://x/api/posts', 'POST', {
      postTypeId: postType.id, content: 'Should be rejected',
    }) as any)).json()
    created.push(postId)

    actAs({ userId: op.userId, roles: op.roles, memberId: op.memberId })
    await moderatePost(jsonReq('http://x', 'PATCH', { action: 'reject', note: 'Not suitable' }) as any, { params: { id: postId } })

    const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } })
    expect(post.status).toBe('REJECTED')
    expect(post.reviewNote).toBe('Not suitable')
  })

  it('TC-POST-005 a staff post goes live immediately', async () => {
    const admin = await account('ADMIN-01')
    const postType = await prisma.postType.findFirstOrThrow({ where: { code: 'ANNOUNCEMENT' } })
    actAs({ userId: admin.userId, roles: admin.roles, memberId: admin.memberId })

    const { postId, status } = await (await createPost(jsonReq('http://x/api/posts', 'POST', {
      postTypeId: postType.id, content: 'Official announcement',
    }) as any)).json()
    created.push(postId)
    expect(status).toBe('PUBLISHED')
  })
})

describe('TC-MAT — matrimony opt-in is restricted to those free to marry', () => {
  it('TC-MAT-011 a MARRIED member cannot publish a matrimony listing', async () => {
    const { PATCH: patchProfile } = await import('@/app/api/matrimony/profiles/[id]/route')
    const m = await account('MEMBER-02')
    const profile = await prisma.matrimonialProfile.upsert({
      where: { memberId: m.memberId }, update: { isVisible: false }, create: { memberId: m.memberId, isVisible: false },
    })
    await prisma.member.update({ where: { id: m.memberId }, data: { maritalStatus: 'MARRIED' } })

    actAs({ userId: m.userId, roles: m.roles, memberId: m.memberId })
    const res = await patchProfile(jsonReq('http://x', 'PATCH', { isVisible: true }) as any, { params: { id: profile.id } })
    expect(res.status).toBe(403)
    expect((await res.json()).message).toMatch(/married/i)

    await prisma.member.update({ where: { id: m.memberId }, data: { maritalStatus: 'UNMARRIED' } })
  })

  it('TC-MAT-012 an UNMARRIED member can opt in, and only opted-in profiles are listed', async () => {
    const { PATCH: patchProfile } = await import('@/app/api/matrimony/profiles/[id]/route')
    const { GET: listProfiles } = await import('@/app/api/matrimony/profiles/route')
    const m = await account('MEMBER-02')
    const viewer = await account('KARTA-02')
    const profile = await prisma.matrimonialProfile.findUniqueOrThrow({ where: { memberId: m.memberId } })

    // Not opted in yet -> absent.
    actAs({ userId: viewer.userId, roles: viewer.roles, memberId: viewer.memberId })
    let { profiles } = await (await listProfiles(jsonReq('http://x/api/matrimony/profiles', 'GET') as any)).json()
    expect(profiles.map((p: any) => p.memberId)).not.toContain(m.memberId)

    // Opt in -> present.
    actAs({ userId: m.userId, roles: m.roles, memberId: m.memberId })
    expect((await patchProfile(jsonReq('http://x', 'PATCH', { isVisible: true }) as any, { params: { id: profile.id } })).status).toBe(200)

    actAs({ userId: viewer.userId, roles: viewer.roles, memberId: viewer.memberId })
    ;({ profiles } = await (await listProfiles(jsonReq('http://x/api/matrimony/profiles', 'GET') as any)).json())
    expect(profiles.map((p: any) => p.memberId)).toContain(m.memberId)
  })

  it('TC-MAT-013 becoming married withdraws the listing automatically', async () => {
    const { GET: listProfiles } = await import('@/app/api/matrimony/profiles/route')
    const { applySpouseLink } = await import('@/lib/approvals')
    const m = await account('MEMBER-02')
    const viewer = await account('KARTA-02')

    await prisma.$transaction((tx) => applySpouseLink(tx, m.memberId, { externalSpouseName: 'Someone' }, m.userId))

    actAs({ userId: viewer.userId, roles: viewer.roles, memberId: viewer.memberId })
    const { profiles } = await (await listProfiles(jsonReq('http://x/api/matrimony/profiles', 'GET') as any)).json()
    expect(profiles.map((p: any) => p.memberId)).not.toContain(m.memberId)
    expect((await prisma.matrimonialProfile.findUniqueOrThrow({ where: { memberId: m.memberId } })).isVisible).toBe(false)

    // reset for other runs
    await prisma.marriageRecord.deleteMany({ where: { memberId1: m.memberId } })
    await prisma.maritalStatusHistory.deleteMany({ where: { memberId: m.memberId } })
    await prisma.member.update({ where: { id: m.memberId }, data: { maritalStatus: 'UNMARRIED' } })
  })
})
