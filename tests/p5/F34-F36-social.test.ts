import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue({ messageId: 'test' }) }))

import { prisma } from '@/lib/prisma'
import { p5Fixtures, actAs, json, png, photoForm, type Person } from './fixtures'
import { POST as memberPhoto } from '@/app/api/members/[id]/photos/route'
import { GET as album, POST as albumAdd } from '@/app/api/families/[id]/album/route'
import { GET as photoFile } from '@/app/api/photos/[photoId]/file/route'
import { POST as report } from '@/app/api/reports/route'
import { POST as reviewReport } from '@/app/api/reports/review/route'
import { GET as friendsGet, POST as friendRequest } from '@/app/api/friends/route'
import { POST as friendAct } from '@/app/api/friends/[id]/route'
import { GET as friendSearch } from '@/app/api/friends/search/route'
import { POST as listCreate } from '@/app/api/friend-lists/route'
import { POST as listAdd } from '@/app/api/friend-lists/[id]/members/route'
import { GET as feed, POST as createPost } from '@/app/api/posts/route'
import { PATCH as editPost, DELETE as deletePost } from '@/app/api/posts/[id]/route'
import { PATCH as moderate } from '@/app/api/posts/[id]/moderate/route'
import { GET as comments, POST as comment } from '@/app/api/posts/[id]/comments/route'
import { POST as react } from '@/app/api/posts/[id]/reactions/route'
import { afterMemberExpired } from '@/lib/family-rules'

const fx = p5Fixtures('p5s')
let geo: Awaited<ReturnType<typeof fx.geography>>
let admin: Person, op: Person, a: Person, b: Person, c: Person, d: Person, outsider: Person
let famId: string, generalType: string

const file = async (as: Person, id: string, variant = '') => { actAs(as); return photoFile(new Request(`http://x/api/photos/${id}/file${variant ? `?variant=${variant}` : ''}`), { params: { photoId: id } }) }
const reportAs = (as: Person, body: object) => { actAs(as); return report(json('http://x', 'POST', body)) }
async function befriend(x: Person, y: Person) {
  actAs(x)
  const { friendshipId } = await (await friendRequest(json('http://x', 'POST', { memberId: y.memberId }))).json()
  actAs(y)
  await friendAct(json('http://x', 'POST', { action: 'accept' }), { params: { id: friendshipId } })
  return friendshipId as string
}
async function newList(owner: Person, name: string, people: Person[]) {
  actAs(owner)
  const { listId } = await (await listCreate(json('http://x', 'POST', { name }))).json()
  for (const p of people) await listAdd(json('http://x', 'POST', { memberId: p.memberId }), { params: { id: listId } })
  return listId as string
}
async function post(as: Person, body: object) {
  actAs(as)
  return createPost(json('http://x', 'POST', { postTypeId: generalType, content: 'Hello everyone', ...body }))
}
const sees = async (as: Person, postId: string) => { actAs(as); return (await (await feed(json('http://x', 'GET'))).json()).posts.some((p: any) => p.id === postId) }

beforeAll(async () => {
  geo = await fx.geography()
  admin = await fx.person('admin', { roles: [{ code: 'ADMIN' }] })
  op = await fx.operator('op', geo.district2)
  a = await fx.adult('a', { villageId: geo.village })
  b = await fx.adult('b', { villageId: geo.village })
  c = await fx.adult('c', { villageId: geo.village2 })
  d = await fx.adult('d', { villageId: geo.village2 })
  outsider = await fx.adult('o', { villageId: geo.village2 })
  famId = await fx.family('Social', a, [{ p: b, role: 'brother' }], { gotra: 'Kashyap' })
  generalType = (await prisma.postType.findFirstOrThrow({ where: { code: 'GENERAL' } })).id
})
afterAll(() => fx.cleanup())

describe('F34 Upload photos', () => {
  it('F34 a mistyped visibility is refused (it used to make the photo visible to everyone)', async () => {
    actAs(a)
    const res = await memberPhoto(photoForm(await png(), { visibility: 'FAMILY' }), { params: { id: a.memberId } })
    expect(res.status).toBe(400)
  })

  it('F34 family album: "Family" means members of that family; outsiders see nothing', async () => {
    actAs(b)
    const res = await albumAdd(photoForm(await png(), { visibility: 'SAME_FAMILY', caption: 'Diwali' }), { params: { id: famId } })
    expect(res.status).toBe(201)
    const { photoId } = await res.json()
    expect((await file(a, photoId)).status).toBe(200)
    expect((await file(outsider, photoId)).status).toBe(403)
    actAs(outsider)
    expect((await (await album(json('http://x', 'GET'), { params: { id: famId } })).json()).photos).toHaveLength(0)
    actAs(outsider)
    expect((await albumAdd(photoForm(await png()), { params: { id: famId } })).status).toBe(403)
  })

  it('F34 "Friends" and "a friend list" visibility', async () => {
    await befriend(a, c)
    await befriend(a, d)
    const list = await newList(a, 'School', [c])
    actAs(a)
    const friendsOnly = await (await memberPhoto(photoForm(await png(), { visibility: 'FRIENDS' }), { params: { id: a.memberId } })).json()
    expect((await file(c, friendsOnly.photo?.id ?? friendsOnly.photoId ?? friendsOnly.id)).status).toBe(200)
    expect((await file(outsider, friendsOnly.photo?.id ?? friendsOnly.photoId ?? friendsOnly.id)).status).toBe(403)
    actAs(a)
    const listOnly = await (await memberPhoto(photoForm(await png(), { visibility: 'FRIEND_LIST', audienceListId: list }), { params: { id: a.memberId } })).json()
    const id = listOnly.photo?.id ?? listOnly.photoId ?? listOnly.id
    expect((await file(c, id)).status).toBe(200)
    expect((await file(d, id)).status).toBe(403) // a friend, but not on that list
  })

  it('F34 the original (with camera data) is for the owner only; a file that is not really JPEG/PNG/WEBP is refused', async () => {
    actAs(a)
    const up = await (await memberPhoto(photoForm(await png(), { visibility: 'REGISTERED_MEMBERS' }), { params: { id: a.memberId } })).json()
    const id = up.photo?.id ?? up.photoId ?? up.id
    const uploaded = await png()
    const other = await file(outsider, id, 'original')
    expect(other.status).toBe(200)
    expect(other.headers.get('content-type')).toBe('image/jpeg') // served the re-encoded copy
    const own = Buffer.from(await (await file(a, id, 'original')).arrayBuffer())
    expect(own.equals(uploaded)).toBe(true) // the owner gets the untouched original
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>')
    actAs(a)
    expect((await memberPhoto(photoForm(svg, {}, 'image/png'), { params: { id: a.memberId } })).status).toBe(400)
  })

  it('F34 report abuse: once three different people report a photo it is hidden until a moderator reviews it', async () => {
    actAs(a)
    const up = await (await memberPhoto(photoForm(await png(), { visibility: 'REGISTERED_MEMBERS' }), { params: { id: a.memberId } })).json()
    const id = up.photo?.id ?? up.photoId ?? up.id
    expect((await reportAs(a, { type: 'photo', id, reason: 'mine' })).status).toBe(404) // not your own
    expect((await reportAs(b, { type: 'photo', id, reason: 'Offensive' })).status).toBe(201)
    expect((await reportAs(b, { type: 'photo', id, reason: 'Offensive' })).status).toBe(409)
    expect((await reportAs(c, { type: 'photo', id, reason: 'Offensive' })).status).toBe(201)
    expect((await file(outsider, id)).status).toBe(200) // still visible after two
    expect(await (await reportAs(d, { type: 'photo', id, reason: 'Spam' })).json()).toMatchObject({ hidden: true })
    expect((await file(outsider, id)).status).toBe(404)
    expect((await file(a, id)).status).toBe(200) // the owner still sees it
    actAs(b)
    expect((await reviewReport(json('http://x', 'POST', { type: 'photo', id, action: 'restore' }))).status).toBe(403)
    actAs(admin)
    expect((await reviewReport(json('http://x', 'POST', { type: 'photo', id, action: 'restore' }))).status).toBe(200)
    expect((await file(outsider, id)).status).toBe(200)
  })
})

describe('F35 Friends and friend lists', () => {
  it('F35 request → accept; a request cannot be answered by the person who sent it', async () => {
    const before = await prisma.notification.count({ where: { recipientId: d.userId, type: 'FRIEND_REQUEST' } })
    actAs(b)
    const { friendshipId } = await (await friendRequest(json('http://x', 'POST', { memberId: d.memberId }))).json()
    expect(await prisma.notification.count({ where: { recipientId: d.userId, type: 'FRIEND_REQUEST' } })).toBe(before + 1)
    expect((await friendAct(json('http://x', 'POST', { action: 'accept' }), { params: { id: friendshipId } })).status).toBe(409)
    actAs(d)
    expect((await friendAct(json('http://x', 'POST', { action: 'accept' }), { params: { id: friendshipId } })).status).toBe(200)
    actAs(b)
    expect((await (await friendsGet()).json()).friends.map((f: any) => f.memberId)).toContain(d.memberId)
    // Only friends can go in a list.
    const { listId } = await (await listCreate(json('http://x', 'POST', { name: 'Work' }))).json()
    expect((await listAdd(json('http://x', 'POST', { memberId: outsider.memberId }), { params: { id: listId } })).status).toBe(400)
  })

  it('F35 removing a friend silently removes them from all lists (both people\'s)', async () => {
    const fid = await befriend(c, outsider)
    const l1 = await newList(c, 'Cricket', [outsider])
    const l2 = await newList(outsider, 'Neighbours', [c])
    expect(await prisma.friendListMember.count({ where: { listId: { in: [l1, l2] } } })).toBe(2)
    actAs(outsider)
    expect((await friendAct(json('http://x', 'POST', { action: 'remove' }), { params: { id: fid } })).status).toBe(200)
    expect(await prisma.friendListMember.count({ where: { listId: { in: [l1, l2] } } })).toBe(0)
  })

  it('F35 search by name, Gotra, Mul Gaon or district — no contact details', async () => {
    actAs(c)
    const res = await (await friendSearch(json(`http://x/api/friends/search?gotra=Kashyap`, 'GET'))).json()
    expect(res.people.map((p: any) => p.memberId)).toEqual(expect.arrayContaining([a.memberId, b.memberId]))
    expect(JSON.stringify(res)).not.toMatch(/mobile|email/i)
    const byDistrict = await (await friendSearch(json(`http://x/api/friends/search?district=${encodeURIComponent('p5s District Two')}`, 'GET'))).json()
    expect(byDistrict.people.map((p: any) => p.memberId)).toContain(d.memberId)
  })

  it('F12 → F35 an expired member is removed from friends and lists', async () => {
    const gone = await fx.adult('gone')
    await befriend(a, gone)
    const list = await newList(a, 'Old friends', [gone])
    await afterMemberExpired(gone.memberId, admin.userId)
    expect(await prisma.friendListMember.count({ where: { listId: list } })).toBe(0)
    expect(await prisma.friendship.count({ where: { status: 'ACCEPTED', OR: [{ requesterMemberId: gone.memberId }, { addresseeMemberId: gone.memberId }] } })).toBe(0)
  })
})

describe('F36 Posts to groups', () => {
  it('F36 a family post goes straight to that family; outsiders cannot see, comment or react; members are alerted', async () => {
    const res = await post(a, { audienceType: 'FAMILY', audienceId: famId, title: 'Family dinner' })
    expect(res.status).toBe(201)
    const { postId, status } = await res.json()
    expect(status).toBe('PUBLISHED')
    expect(await sees(b, postId)).toBe(true)
    expect(await sees(outsider, postId)).toBe(false)
    actAs(outsider)
    expect((await comment(json('http://x', 'POST', { content: 'hi' }), { params: { id: postId } })).status).toBe(404)
    actAs(outsider)
    expect((await react(json('http://x', 'POST', {}), { params: { id: postId } })).status).toBe(404)
    expect(await prisma.notification.count({ where: { recipientId: b.userId, type: 'NEW_POST' } })).toBeGreaterThan(0)
    // Someone not in that family cannot post to it.
    expect((await post(outsider, { audienceType: 'FAMILY', audienceId: famId })).status).toBe(400)
  })

  it('F36 a friend-list post reaches only that list', async () => {
    const list = await newList(a, 'Close', [c])
    const { postId } = await (await post(a, { audienceType: 'FRIEND_LIST', audienceId: list })).json()
    expect(await sees(c, postId)).toBe(true)
    expect(await sees(d, postId)).toBe(false) // a friend of a, but not on the list
  })

  it('F36 district posts wait for that District body (its President), not any Operator; then only that district sees them', async () => {
    const { postId, status } = await (await post(a, { audienceType: 'DISTRICT' })).json()
    expect(status).toBe('PENDING_APPROVAL')
    expect(await sees(b, postId)).toBe(false)
    actAs(op)
    expect((await moderate(json('http://x', 'PATCH', { action: 'approve' }), { params: { id: postId } })).status).toBe(403)
    // The District body for geo.district with b as President.
    const body = await prisma.organisation.create({ data: { kind: 'DISTRICT_BODY', bodyKey: `DISTRICT_BODY:${geo.district}`, areaId: geo.district, name: 'Body', status: 'ACTIVE' } })
    await prisma.organisationMember.create({ data: { organisationId: body.id, memberId: b.memberId, designation: 'PRESIDENT', status: 'ACTIVE' } })
    actAs(b)
    expect((await moderate(json('http://x', 'PATCH', { action: 'reject' }), { params: { id: postId } })).status).toBe(400) // a rejection gives a reason (owner's decision)
    expect((await moderate(json('http://x', 'PATCH', { action: 'approve' }), { params: { id: postId } })).status).toBe(200)
    expect(await sees(b, postId)).toBe(true)
    expect(await sees(c, postId)).toBe(false) // another district
    actAs(b)
    expect((await moderate(json('http://x', 'PATCH', { action: 'approve' }), { params: { id: postId } })).status).toBe(409) // already live
    await prisma.organisationMember.deleteMany({ where: { organisationId: body.id } })
    await prisma.organisation.delete({ where: { id: body.id } })
  })

  it('F36 community-wide posts keep Operator moderation (owner\'s decision): pending until an Operator or Admin approves', async () => {
    const { postId } = await (await post(a, { audienceType: 'COMMUNITY' })).json()
    expect((await prisma.post.findUniqueOrThrow({ where: { id: postId } })).status).toBe('PENDING_APPROVAL')
    expect(await sees(b, postId)).toBe(false)
    actAs(b)
    expect((await moderate(json('http://x', 'PATCH', { action: 'approve' }), { params: { id: postId } })).status).toBe(403)
    actAs(op)
    expect((await moderate(json('http://x', 'PATCH', { action: 'approve' }), { params: { id: postId } })).status).toBe(200)
    expect(await sees(b, postId)).toBe(true)
    await prisma.post.update({ where: { id: postId }, data: { deletedAt: new Date() } })
  })

  it('F36 the author edits and deletes their own post; editing a moderated post sends it back for approval', async () => {
    const { postId } = await (await post(a, { audienceType: 'COMMUNITY' })).json()
    actAs(admin)
    await moderate(json('http://x', 'PATCH', { action: 'approve' }), { params: { id: postId } })
    actAs(b)
    expect((await editPost(json('http://x', 'PATCH', { content: 'hijacked' }), { params: { id: postId } })).status).toBe(404)
    actAs(a)
    const edit = await editPost(json('http://x', 'PATCH', { content: 'Hello, edited' }), { params: { id: postId } })
    expect((await edit.json()).status).toBe('PENDING_APPROVAL')
    actAs(a)
    expect((await deletePost(json('http://x', 'DELETE'), { params: { id: postId } })).status).toBe(200)
    expect((await prisma.post.findUniqueOrThrow({ where: { id: postId } })).deletedAt).not.toBeNull()
  })

  it('F36 three reports hide a post until reviewed; comment authors are names only (no password hash, email or mobile)', async () => {
    const { postId } = await (await post(a, { audienceType: 'FAMILY', audienceId: famId })).json()
    actAs(b)
    await comment(json('http://x', 'POST', { content: 'Nice' }), { params: { id: postId } })
    actAs(b)
    const listed = JSON.stringify(await (await comments(json('http://x', 'GET'), { params: { id: postId } })).json())
    expect(listed).not.toMatch(/passwordHash|"email"|"mobile"|lastLoginIp/)
    expect(listed).toContain('firstName')

    const famC = await fx.family('Social2', c, [{ p: d, role: 'brother' }, { p: outsider, role: 'brother' }])
    const { postId: p2 } = await (await post(c, { audienceType: 'FAMILY', audienceId: famC })).json()
    await fx.family('Social3', await fx.adult('k3'), [])
    for (const who of [d, outsider]) expect((await reportAs(who, { type: 'post', id: p2, reason: 'Spam' })).status).toBe(201)
    await prisma.familyMember.create({ data: { familyId: famC, memberId: a.memberId, relationshipRole: 'brother' } })
    expect(await (await reportAs(a, { type: 'post', id: p2, reason: 'Spam' })).json()).toMatchObject({ hidden: true })
    expect((await prisma.post.findUniqueOrThrow({ where: { id: p2 } })).status).toBe('FLAGGED')
    expect(await sees(d, p2)).toBe(false)
    actAs(admin)
    await reviewReport(json('http://x', 'POST', { type: 'post', id: p2, action: 'remove', note: 'Spam' }))
    expect((await prisma.post.findUniqueOrThrow({ where: { id: p2 } })).status).toBe('REMOVED')
  })
})
