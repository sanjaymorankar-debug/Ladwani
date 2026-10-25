import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { PUT as putSection, GET as getSection } from '@/app/api/members/[id]/additional-details/[section]/route'
import { GET as getOverview } from '@/app/api/members/[id]/additional-details/route'
import { POST as postConsent } from '@/app/api/members/[id]/additional-details/consent/route'
import { PATCH as patchGroupSettings } from '@/app/api/members/[id]/group-settings/route'
import { GET as listGroups } from '@/app/api/interest-groups/route'
import { GET as getGroup } from '@/app/api/interest-groups/[id]/route'
import { POST as joinGroup, DELETE as leaveGroupRoute, PATCH as patchMembership } from '@/app/api/interest-groups/[id]/membership/route'
import { GET as listMembers } from '@/app/api/interest-groups/[id]/members/route'
import { DELETE as removeMember } from '@/app/api/interest-groups/[id]/members/[memberId]/route'
import { POST as assignModerator, GET as getModerators } from '@/app/api/interest-groups/[id]/moderators/route'
import { GET as listPosts, POST as createPost } from '@/app/api/interest-groups/[id]/posts/route'
import { POST as leaveUnmatchedRoute } from '@/app/api/interest-groups/leave-unmatched/route'
import { POST as solvePost } from '@/app/api/posts/[id]/solve/route'
import { POST as votePost } from '@/app/api/posts/[id]/vote/route'
import { POST as rsvpPost } from '@/app/api/posts/[id]/rsvp/route'
import { POST as reportPost } from '@/app/api/posts/[id]/report/route'
import { PATCH as moderatePost } from '@/app/api/posts/[id]/moderate/route'
import { GET as getComments, POST as postComment } from '@/app/api/posts/[id]/comments/route'
import { PATCH as reviewInterest } from '@/app/api/admin/interests/[id]/route'
import { GET as findDonors } from '@/app/api/blood-donors/route'
import { GET as listContacts, POST as requestContact } from '@/app/api/contact-requests/route'
import { PATCH as answerContact } from '@/app/api/contact-requests/[id]/route'
import { GET as getMatchesRoute } from '@/app/api/matches/route'
import { POST as cronDigest } from '@/app/api/cron/group-digest/route'
import { CONSENT_VERSION } from '@/lib/additional-details/server'
import { syncMemberGroups, runDailyDigest, DISTRICT_SUBGROUP_THRESHOLD } from '@/lib/interest-groups'
import { actAs, jsonReq, account } from './helpers'
import {
  cleanupXd, makePerson, makeFamily, grantConsent, grantMinorGroupConsent, interestBySlug, type XdPerson,
} from './extended-fixtures'

// Interest groups (Step 3): auto-creation, auto-join, leaving, minors,
// sensitive topics, district sub-groups, inside-the-group features,
// moderation, notifications and matching.

const as = (p: XdPerson) => actAs({ userId: p.userId!, roles: p.roles, memberId: p.memberId })
const put = (memberId: string, section: string, body: unknown) =>
  putSection(jsonReq('http://x', 'PUT', body) as any, { params: { id: memberId, section } })
const hobbies = (...rows: Record<string, unknown>[]) => ({ answer: 'YES', visibility: 'COMMUNITY', rows })
const groupFor = (interestId: string, district = '') => prisma.communityGroup.findUnique({ where: { autoKey: `interest:${interestId}|${district}` } })
const isIn = async (groupId: string, memberId: string) => {
  const row = await prisma.communityGroupMember.findUnique({ where: { groupId_memberId: { groupId, memberId } } })
  return !!row && !row.leftAt
}
const gparams = (id: string) => ({ params: { id } })

let fam: { id: string }
let asha: XdPerson, ravi: XdPerson, outsider: XdPerson, karta: XdPerson, child: XdPerson
let chess: string, cooking: string, photography: string, singing: string, yoga: string

beforeAll(async () => {
  await cleanupXd()
  fam = await makeFamily('IG')
  karta = await makePerson('IgKarta', { age: 45, familyId: fam.id, isKarta: true, roles: ['KARTA'] })
  asha = await makePerson('IgAsha', { age: 30, gender: 'FEMALE', familyId: fam.id })
  ravi = await makePerson('IgRavi', { age: 33, familyId: (await makeFamily('IG2')).id })
  outsider = await makePerson('IgOut', { age: 40, familyId: (await makeFamily('IG3')).id })
  child = await makePerson('IgChild', { login: false, age: 13, familyId: fam.id })
  for (const p of [asha, ravi, outsider]) await grantConsent(p.memberId, p.userId!)
  await grantConsent(child.memberId, karta.userId!)
  ;[chess, cooking, photography, singing, yoga] = await Promise.all(
    ['chess', 'cooking', 'photography', 'singing', 'yoga'].map(async (s) => (await interestBySlug(s)).id)
  )
})

afterAll(async () => {
  await cleanupXd()
})

describe('TC-IG — group master and auto-creation', () => {
  it('TC-IG-001 picking a hobby with no group creates the group and adds the member, who is told', async () => {
    expect(await groupFor(photography)).toBeNull()
    as(asha)
    const res = await put(asha.memberId, 'hobbies', hobbies({ interestId: photography, level: 'EXPERT', canTeach: true }))
    expect(res.status).toBe(200)
    const body = await res.json()
    const group = await groupFor(photography)
    expect(group).toMatchObject({ groupType: 'INTEREST', status: 'ACTIVE', name: 'Photography', interestId: photography })
    expect(body.groups.added).toEqual([{ id: group!.id, name: 'Photography' }])
    expect(await isIn(group!.id, asha.memberId)).toBe(true)
    const note = await prisma.notification.findFirst({ where: { recipientId: asha.userId!, type: 'GROUP_ADDED' } })
    expect(note?.title).toBe('You have been added to these groups')
    expect(note?.body).toContain('Photography')
  })

  it('TC-IG-002 a second member with the same hobby joins the existing group — no duplicate', async () => {
    as(ravi)
    await put(ravi.memberId, 'hobbies', hobbies({ interestId: photography, level: 'BEGINNER', needsSupport: true, supportTypes: ['TRAINING'] }))
    expect(await prisma.communityGroup.count({ where: { interestId: photography } })).toBe(1)
    expect(await isIn((await groupFor(photography))!.id, ravi.memberId)).toBe(true)
  })

  it('TC-IG-003 an "Other" hobby waits for Admin approval before it gets a group; approval adds the member', async () => {
    as(ravi)
    const res = await put(ravi.memberId, 'hobbies', hobbies(
      { interestId: photography, level: 'BEGINNER', needsSupport: true, supportTypes: ['TRAINING'] },
      { interestId: 'NEW:Xd Warli Art', level: 'REGULAR' },
    ))
    expect(res.status).toBe(200)
    const pending = await prisma.interest.findUniqueOrThrow({ where: { slug: 'xd-warli-art' } })
    expect(pending.status).toBe('PENDING')
    expect(await prisma.communityGroup.count({ where: { interestId: pending.id } })).toBe(0)

    const admin = await account('ADMIN-01')
    actAs(admin)
    expect((await reviewInterest(jsonReq('http://x', 'PATCH', { action: 'approve', category: 'Arts' }) as any, gparams(pending.id))).status).toBe(200)
    const group = await groupFor(pending.id)
    expect(group).not.toBeNull()
    expect(await isIn(group!.id, ravi.memberId)).toBe(true)
  })

  it('TC-IG-004 a misspelt "Other" hobby is merged into the existing one instead of making a duplicate group', async () => {
    as(outsider)
    await put(outsider.memberId, 'hobbies', hobbies({ interestId: 'NEW:Xd Photograpy', level: 'REGULAR' }))
    const typo = await prisma.interest.findUniqueOrThrow({ where: { slug: 'xd-photograpy' } })
    const admin = await account('ADMIN-01')
    actAs(admin)
    expect((await reviewInterest(jsonReq('http://x', 'PATCH', { action: 'merge', mergeIntoId: photography }) as any, gparams(typo.id))).status).toBe(200)
    expect(await prisma.memberHobby.findFirst({ where: { memberId: outsider.memberId, interestId: photography } })).not.toBeNull()
    expect(await prisma.communityGroup.count({ where: { interestId: typo.id } })).toBe(0)
    expect(await isIn((await groupFor(photography))!.id, outsider.memberId)).toBe(true)
  })
})

describe('TC-IG — member control (rules 3 and 4)', () => {
  it('TC-IG-010 leaving keeps the hobby, and the system never re-adds the member', async () => {
    const group = (await groupFor(photography))!
    as(asha)
    expect((await leaveGroupRoute(jsonReq('http://x', 'DELETE') as any, gparams(group.id))).status).toBe(200)
    expect(await isIn(group.id, asha.memberId)).toBe(false)
    expect(await prisma.memberHobby.count({ where: { memberId: asha.memberId, interestId: photography } })).toBe(1)
    // Saving again (and a direct re-sync) must not put her back.
    const res = await put(asha.memberId, 'hobbies', hobbies({ interestId: photography, level: 'EXPERT', canTeach: true }))
    expect((await res.json()).groups.added).toEqual([])
    await syncMemberGroups(asha.memberId, null)
    expect(await isIn(group.id, asha.memberId)).toBe(false)
    // She can always choose to come back herself.
    expect((await joinGroup(jsonReq('http://x', 'POST') as any, gparams(group.id))).status).toBe(201)
    expect(await isIn(group.id, asha.memberId)).toBe(true)
  })

  it('TC-IG-011 removing a hobby removes the member from its group only after confirmation', async () => {
    as(asha)
    await put(asha.memberId, 'hobbies', hobbies({ interestId: photography, level: 'EXPERT', canTeach: true }, { interestId: cooking, level: 'REGULAR' }))
    const cookGroup = (await groupFor(cooking))!
    expect(await isIn(cookGroup.id, asha.memberId)).toBe(true)
    const res = await put(asha.memberId, 'hobbies', hobbies({ interestId: photography, level: 'EXPERT', canTeach: true }))
    const body = await res.json()
    expect(body.groups.removable).toEqual([{ id: cookGroup.id, name: 'Cooking' }])
    expect(await isIn(cookGroup.id, asha.memberId)).toBe(true) // not yet — needs confirmation
    const left = await leaveUnmatchedRoute(jsonReq('http://x', 'POST', { memberId: asha.memberId, groupIds: [cookGroup.id, (await groupFor(photography))!.id] }) as any)
    expect((await left.json()).left).toEqual([cookGroup.id]) // still-matching groups are refused
    expect(await isIn(cookGroup.id, asha.memberId)).toBe(false)
    // Picking the hobby again brings her back (she didn't choose to leave).
    const again = await put(asha.memberId, 'hobbies', hobbies({ interestId: photography, level: 'EXPERT', canTeach: true }, { interestId: cooking, level: 'REGULAR' }))
    expect((await again.json()).groups.added.map((g: any) => g.id)).toContain(cookGroup.id)
  })

  it('TC-IG-012 "Do not auto-add me to groups" turns auto-join off', async () => {
    as(outsider)
    expect((await patchGroupSettings(jsonReq('http://x', 'PATCH', { autoAddToGroups: false }) as any, gparams(outsider.memberId))).status).toBe(200)
    const res = await put(outsider.memberId, 'hobbies', hobbies({ interestId: photography, level: 'REGULAR' }, { interestId: singing, level: 'REGULAR' }))
    expect((await res.json()).groups.added).toEqual([])
    const singGroup = await groupFor(singing)
    expect(singGroup).not.toBeNull() // the group exists for others...
    expect(await isIn(singGroup!.id, outsider.memberId)).toBe(false) // ...but she wasn't added
    await patchGroupSettings(jsonReq('http://x', 'PATCH', { autoAddToGroups: true }) as any, gparams(outsider.memberId))
    expect(await isIn(singGroup!.id, outsider.memberId)).toBe(true)
  })

  it('TC-IG-013 notification preference: daily digest by default, every post on request, mute', async () => {
    const group = (await groupFor(photography))!
    as(ravi)
    const g = await (await getGroup(jsonReq('http://x', 'GET') as any, gparams(group.id))).json()
    expect(g.viewer.notifyMode).toBe('DAILY_DIGEST')
    expect((await patchMembership(jsonReq('http://x', 'PATCH', { notifyMode: 'EVERY_POST' }) as any, gparams(group.id))).status).toBe(200)
    expect((await patchMembership(jsonReq('http://x', 'PATCH', { notifyMode: 'HOURLY' }) as any, gparams(group.id))).status).toBe(400)
  })
})

describe('TC-IG — sensitive topics never create or join groups (rule 8)', () => {
  it('TC-IG-020 loans, insurance, adviser, doctor, health, documents, marriage and emergency answers create no groups', async () => {
    const before = await prisma.communityGroup.count({ where: { groupType: 'INTEREST' } })
    const membershipsBefore = await prisma.communityGroupMember.count({ where: { memberId: ravi.memberId, leftAt: null } })
    as(ravi)
    const payloads: Record<string, unknown> = {
      insurance: { answer: 'YES', rows: [{ insuranceType: 'LIFE' }], values: { insuranceNeedsHelp: true }, share: { insuranceNeedsHelp: false } },
      doctor: { answer: 'YES', values: { doctorName: 'Dr X', doctorNeedsHelp: false } },
      adviser: { answer: 'YES', values: { adviserType: 'CA' } },
      banking: { answer: 'YES', rows: [{ loanType: 'BUSINESS', amountBand: '1L_5L' }], values: { hasExistingLoans: false }, share: { answer: false } },
      wellness: { answer: 'YES', values: { wellnessActivities: ['YOGA', 'GYM'], wellnessWants: ['FITNESS_GROUP', 'YOGA_GROUP'] } },
      gov_docs: { answer: 'YES', values: { govDocNeeds: ['PASSPORT'] }, share: { govDocNeeds: false } },
      marriage_support: { answer: 'YES', values: { marriageSupportNeeds: ['FIND_MATCH'] }, share: { marriageSupportNeeds: false } },
      emergency: { answer: 'YES', values: { canHelpEmergency: true, emergencyHelpTypes: ['BLOOD'] } },
    }
    for (const [section, body] of Object.entries(payloads)) {
      const res = await put(ravi.memberId, section, body)
      expect(res.status, section).toBe(200)
      const json = await res.json()
      expect(json.groups, section).toEqual({ added: [], removable: [] })
    }
    expect(await prisma.communityGroup.count({ where: { groupType: 'INTEREST' } })).toBe(before)
    expect(await prisma.communityGroupMember.count({ where: { memberId: ravi.memberId, leftAt: null } })).toBe(membershipsBefore)
    expect(await prisma.communityGroup.findUnique({ where: { autoKey: 'derived:FITNESS_YOGA|' } })).toBeNull()
  })

  it('TC-IG-021 shared sections do create their community groups (farmers, volunteers, blood donors, women, travel)', async () => {
    as(asha)
    await put(asha.memberId, 'farm', { answer: 'YES', rows: [{ taluka: 'Haveli', areaValue: 1, areaUnit: 'ACRE' }] })
    await put(asha.memberId, 'skills_share', { answer: 'YES', values: { volunteerReady: true, willingToDonateBlood: true, bloodGroup: 'O+' } })
    await put(asha.memberId, 'travel', { answer: 'YES', values: { travelInterests: ['PILGRIMAGE'] } })
    await put(asha.memberId, 'culture', { answer: 'YES', values: { cultureInterests: ['WOMENS_WING'] } })
    for (const key of ['FARMERS', 'VOLUNTEERS', 'BLOOD_DONORS', 'TRAVEL_YATRA', 'WOMENS_WING']) {
      const g = await prisma.communityGroup.findUnique({ where: { autoKey: `derived:${key}|` } })
      expect(g, key).not.toBeNull()
      expect(await isIn(g!.id, asha.memberId), key).toBe(true)
    }
  })
})

describe('TC-IG — minors (rule 9)', () => {
  it('TC-IG-030 a minor is joined only to child-safe groups, and only after parent/Karta consent', async () => {
    as(karta)
    const res = await put(child.memberId, 'hobbies', hobbies({ interestId: chess, level: 'BEGINNER' }, { interestId: cooking, level: 'BEGINNER' }))
    expect(res.status).toBe(200)
    expect((await res.json()).groups.added).toEqual([]) // no consent yet
    const chessGroup = (await groupFor(chess))!
    expect(chessGroup.isChildSafe).toBe(true)
    expect(await isIn(chessGroup.id, child.memberId)).toBe(false)

    const consent = await postConsent(jsonReq('http://x', 'POST', { agree: true, type: 'MINOR_GROUPS' }) as any, gparams(child.memberId))
    expect(consent.status).toBe(201)
    expect(await isIn(chessGroup.id, child.memberId)).toBe(true)
    expect(await isIn((await groupFor(cooking))!.id, child.memberId)).toBe(false) // cooking is not child-safe
  })

  it('TC-IG-031 a minor sees only child-safe groups and cannot join an adult group', async () => {
    const teen = await makePerson('IgTeen', { age: 15, familyId: fam.id })
    await grantMinorGroupConsent(teen.memberId, karta.userId!)
    as(teen)
    const { groups } = await (await listGroups(new Request('http://x/api/interest-groups') as any)).json()
    expect(groups.length).toBeGreaterThan(0)
    expect(groups.every((g: any) => g.name !== 'Cooking')).toBe(true)
    expect((await joinGroup(jsonReq('http://x', 'POST') as any, gparams((await groupFor(cooking))!.id))).status).toBe(403)
  })

  it('TC-IG-032 adults outside the family cannot contact a minor; family can', async () => {
    as(outsider)
    expect((await requestContact(jsonReq('http://x', 'POST', { toMemberId: child.memberId, purpose: 'CONNECT' }) as any)).status).toBe(403)
    as(asha) // same family
    expect((await requestContact(jsonReq('http://x', 'POST', { toMemberId: child.memberId, purpose: 'CONNECT' }) as any)).status).toBe(201)
  })
})

describe('TC-IG — district sub-groups (rule 5)', () => {
  it(`TC-IG-040 a district sub-group is created at ${DISTRICT_SUBGROUP_THRESHOLD} members in the same district, not before`, async () => {
    const carrom = (await interestBySlug('carrom')).id
    const people: XdPerson[] = []
    for (let i = 0; i < DISTRICT_SUBGROUP_THRESHOLD; i++) {
      people.push(await makePerson(`IgCarrom${i}`, { login: false, age: 30 + i, district: 'Nashik', city: 'Nashik' }))
    }
    // a minor in the same district, to check the members list later
    const teen = await makePerson('IgCarromTeen', { login: false, age: 16, district: 'Nashik', city: 'Nashik' })
    await grantMinorGroupConsent(teen.memberId, karta.userId!)
    await prisma.interest.update({ where: { id: carrom }, data: { isChildSafe: true } })
    const addHobby = async (p: XdPerson) => {
      await prisma.memberSectionSetting.create({ data: { memberId: p.memberId, sectionKey: 'hobbies', answer: 'YES', visibility: 'COMMUNITY' } })
      await prisma.memberHobby.create({ data: { memberId: p.memberId, interestId: carrom, level: 'REGULAR' } })
      return syncMemberGroups(p.memberId, null)
    }
    for (const p of people.slice(0, DISTRICT_SUBGROUP_THRESHOLD - 1)) await addHobby(p)
    await addHobby(teen) // 10 in district including the minor
    const parent = (await groupFor(carrom))!
    expect(await prisma.communityGroup.count({ where: { parentGroupId: parent.id } })).toBe(1)
    await prisma.communityGroup.deleteMany({ where: { parentGroupId: parent.id } })

    // Recount without the minor's row being special: remove her, check 9 → none, add 10th → created.
    await prisma.communityGroupMember.deleteMany({ where: { memberId: teen.memberId } })
    await syncMemberGroups(people[0].memberId, null)
    expect(await prisma.communityGroup.count({ where: { parentGroupId: parent.id } })).toBe(0)
    const result = await addHobby(people[DISTRICT_SUBGROUP_THRESHOLD - 1])
    const sub = await prisma.communityGroup.findFirstOrThrow({ where: { parentGroupId: parent.id } })
    expect(sub).toMatchObject({ district: 'Nashik', name: 'Carrom — Nashik' })
    expect(await prisma.communityGroupMember.count({ where: { groupId: sub.id, leftAt: null } })).toBe(DISTRICT_SUBGROUP_THRESHOLD)
    expect(result.added.map((g) => g.id)).toContain(sub.id)

    // The minor joins the sub-group but is hidden from its members list.
    await syncMemberGroups(teen.memberId, null)
    expect(await isIn(sub.id, teen.memberId)).toBe(true)
    const admin = await account('ADMIN-01')
    actAs(admin)
    const list = await (await listMembers(jsonReq('http://x', 'GET') as any, gparams(sub.id))).json()
    expect(list.members.map((m: any) => m.memberId)).not.toContain(teen.memberId)
    expect(list.members).toHaveLength(DISTRICT_SUBGROUP_THRESHOLD)
  })
})

describe('TC-IG — what a group reveals (rule 7)', () => {
  it('TC-IG-050 the members list shows only name, photo, city and hobby level, and mentors', async () => {
    const group = (await groupFor(photography))!
    as(ravi)
    const res = await listMembers(jsonReq('http://x', 'GET') as any, gparams(group.id))
    expect(res.status).toBe(200)
    const { members, mentors } = await res.json()
    for (const m of members) expect(Object.keys(m).sort()).toEqual(['city', 'isMentor', 'level', 'memberId', 'name', 'profilePhotoId', 'role'])
    expect(mentors.map((m: any) => m.memberId)).toContain(asha.memberId)
    expect(JSON.stringify(members)).not.toMatch(/mobile|email|dateOfBirth|9822/)
  })

  it('TC-IG-051 being in the same group does not let members see other profile sections', async () => {
    as(asha)
    await put(asha.memberId, 'house', { answer: 'YES', visibility: 'ONLY_ME', values: { houseOwnership: 'OWN', houseType: 'FLAT' } })
    await put(asha.memberId, 'career', { answer: 'YES', visibility: 'FAMILY', values: { careerLookingFor: ['JOB'] } })
    as(ravi) // shares the Photography group with Asha
    expect((await getSection(jsonReq('http://x', 'GET') as any, { params: { id: asha.memberId, section: 'house' } })).status).toBe(404)
    expect((await getSection(jsonReq('http://x', 'GET') as any, { params: { id: asha.memberId, section: 'career' } })).status).toBe(404)
    expect((await getSection(jsonReq('http://x', 'GET') as any, { params: { id: asha.memberId, section: 'farm' } })).status).toBe(404)
    const ov = await (await getOverview(jsonReq('http://x', 'GET') as any, gparams(asha.memberId))).json()
    expect(ov.sections.map((s: any) => s.key).sort()).toEqual(['culture', 'hobbies', 'skills_share', 'travel'].sort())
  })

  it('TC-IG-052 non-members cannot read a group\'s posts, members or comments', async () => {
    const group = (await groupFor(photography))!
    const stranger = await makePerson('IgStranger', { age: 50 })
    as(stranger)
    expect((await listPosts(new Request('http://x') as any, gparams(group.id))).status).toBe(403)
    expect((await listMembers(jsonReq('http://x', 'GET') as any, gparams(group.id))).status).toBe(403)
  })
})

describe('TC-IG — inside a group (rules 6, 10, 11)', () => {
  let groupId = ''
  let questionId = ''

  it('TC-IG-060 group rules must be accepted on first entry before posting', async () => {
    groupId = (await groupFor(photography))!.id
    as(ravi)
    const g = await (await getGroup(jsonReq('http://x', 'GET') as any, gparams(groupId))).json()
    expect(g.viewer.mustAcceptRules).toBe(true)
    expect(g.group.rules).toContain('Be respectful')
    expect((await createPost(jsonReq('http://x', 'POST', { kind: 'POST', content: 'Hi' }) as any, gparams(groupId))).status).toBe(412)
    await patchMembership(jsonReq('http://x', 'PATCH', { acceptRules: true }) as any, gparams(groupId))
    as(asha)
    await patchMembership(jsonReq('http://x', 'PATCH', { acceptRules: true }) as any, gparams(groupId))
  })

  it('TC-IG-061 a "Problem / need help" question can be answered and marked solved by the asker', async () => {
    as(ravi)
    const res = await createPost(jsonReq('http://x', 'POST', { kind: 'QUESTION', title: 'Which lens for portraits?', content: 'Budget is small' }) as any, gparams(groupId))
    expect(res.status).toBe(201)
    questionId = (await res.json()).postId
    as(asha)
    expect((await postComment(jsonReq('http://x', 'POST', { content: '50mm f/1.8' }) as any, gparams(questionId))).status).toBe(201)
    const comment = await prisma.comment.findFirstOrThrow({ where: { postId: questionId } })
    expect((await solvePost(jsonReq('http://x', 'POST', { commentId: comment.id }) as any, gparams(questionId))).status).toBe(403) // not the asker
    as(ravi)
    expect((await solvePost(jsonReq('http://x', 'POST', { commentId: comment.id }) as any, gparams(questionId))).status).toBe(200)
    expect(await prisma.post.findUniqueOrThrow({ where: { id: questionId } })).toMatchObject({ isSolved: true, solvedCommentId: comment.id })
    // The community feed never carries group posts, and outsiders can't read the thread.
    expect(await prisma.post.count({ where: { id: questionId, groupId: null } })).toBe(0)
    const stranger = await makePerson('IgStranger2', { age: 50 })
    as(stranger)
    expect((await getComments(jsonReq('http://x', 'GET') as any, gparams(questionId))).status).toBe(404)
  })

  it('TC-IG-062 polls (one vote each), events with RSVP, and Knowledge only from moderators', async () => {
    as(asha)
    const poll = await createPost(jsonReq('http://x', 'POST', { kind: 'POLL', title: 'Next photo walk?', pollOptions: ['Saturday', 'Sunday'] }) as any, gparams(groupId))
    const pollId = (await poll.json()).postId
    const opts = await prisma.postPollOption.findMany({ where: { postId: pollId }, orderBy: { sortOrder: 'asc' } })
    await votePost(jsonReq('http://x', 'POST', { optionId: opts[0].id }) as any, gparams(pollId))
    await votePost(jsonReq('http://x', 'POST', { optionId: opts[1].id }) as any, gparams(pollId))
    expect(await prisma.postPollVote.count({ where: { postId: pollId } })).toBe(1)

    const ev = await createPost(jsonReq('http://x', 'POST', { kind: 'EVENT', title: 'Photo walk', eventDate: new Date(Date.now() + 7 * 86400000).toISOString() }) as any, gparams(groupId))
    const evId = (await ev.json()).postId
    expect((await rsvpPost(jsonReq('http://x', 'POST', { response: 'GOING' }) as any, gparams(evId))).status).toBe(200)
    expect((await createPost(jsonReq('http://x', 'POST', { kind: 'EVENT', title: 'No date' }) as any, gparams(groupId))).status).toBe(400)

    expect((await createPost(jsonReq('http://x', 'POST', { kind: 'KNOWLEDGE', title: 'Guide', linkUrl: 'https://example.org/guide' }) as any, gparams(groupId))).status).toBe(403)
    const posts = await (await listPosts(new Request('http://x?kind=POLL') as any, gparams(groupId))).json()
    expect(posts.posts[0].poll.options.map((o: any) => o.votes)).toEqual([0, 1])
  })

  it('TC-IG-063 moderators: Admin assigns (expert suggested), they publish Knowledge, hide posts and remove members', async () => {
    const admin = await account('ADMIN-01')
    actAs(admin)
    const mods = await (await getModerators(jsonReq('http://x', 'GET') as any, gparams(groupId))).json()
    expect(mods.suggestion.memberId).toBe(asha.memberId) // EXPERT + mentor
    expect((await assignModerator(jsonReq('http://x', 'POST', { memberId: asha.memberId }) as any, gparams(groupId))).status).toBe(200)
    as(ravi)
    expect((await assignModerator(jsonReq('http://x', 'POST', { memberId: ravi.memberId }) as any, gparams(groupId))).status).toBe(403)

    as(asha)
    const k = await createPost(jsonReq('http://x', 'POST', { kind: 'KNOWLEDGE', title: 'Beginner guide', linkUrl: 'https://example.org/guide' }) as any, gparams(groupId))
    expect(k.status).toBe(201)
    expect((await prisma.post.findUniqueOrThrow({ where: { id: (await k.json()).postId } })).isPinned).toBe(true)

    // Existing moderation flow, used by the group moderator for this group's post.
    const spam = await prisma.post.create({ data: { authorId: outsider.userId!, postTypeId: (await prisma.postType.findFirstOrThrow({ where: { code: 'GROUP_POST' } })).id, groupId, groupPostKind: 'POST', content: 'spam', status: 'PUBLISHED' } })
    expect((await moderatePost(jsonReq('http://x', 'PATCH', { action: 'hide' }) as any, gparams(spam.id))).status).toBe(200)
    expect((await prisma.post.findUniqueOrThrow({ where: { id: spam.id } })).status).toBe('HIDDEN')
    as(ravi) // an ordinary member can't
    expect((await moderatePost(jsonReq('http://x', 'PATCH', { action: 'approve' }) as any, gparams(spam.id))).status).toBe(403)

    as(asha)
    expect((await removeMember(jsonReq('http://x', 'DELETE', { reason: 'spam' }) as any, { params: { id: groupId, memberId: outsider.memberId } })).status).toBe(200)
    await syncMemberGroups(outsider.memberId, null)
    expect(await isIn(groupId, outsider.memberId)).toBe(false) // removed members are never re-added
  })

  it('TC-IG-064 reports from three members flag a post into the moderation queue', async () => {
    const reporters = [ravi, asha, karta]
    await prisma.communityGroupMember.upsert({ where: { groupId_memberId: { groupId, memberId: karta.memberId } }, update: { leftAt: null }, create: { groupId, memberId: karta.memberId } })
    as(ravi)
    const res = await createPost(jsonReq('http://x', 'POST', { kind: 'POST', content: 'rude words' }) as any, gparams(groupId))
    const postId = (await res.json()).postId
    for (const r of reporters) {
      as(r)
      expect((await reportPost(jsonReq('http://x', 'POST', { reason: 'Abusive' }) as any, gparams(postId))).status).toBe(201)
    }
    expect((await prisma.post.findUniqueOrThrow({ where: { id: postId } })).status).toBe('FLAGGED')
  })

  it('TC-IG-065 every-post members are notified at once; everyone else gets one daily digest', async () => {
    await prisma.notification.deleteMany({ where: { recipientId: { in: [ravi.userId!, asha.userId!] }, type: { in: ['GROUP_POST', 'GROUP_DIGEST'] } } })
    as(asha)
    await createPost(jsonReq('http://x', 'POST', { kind: 'POST', content: 'Golden hour tonight' }) as any, gparams(groupId))
    expect(await prisma.notification.count({ where: { recipientId: ravi.userId!, type: 'GROUP_POST' } })).toBe(1) // ravi chose EVERY_POST
    expect(await prisma.notification.count({ where: { recipientId: karta.userId!, type: 'GROUP_POST' } })).toBe(0)
    await runDailyDigest(new Date(Date.now() + 1000))
    const digest = await prisma.notification.findFirst({ where: { recipientId: karta.userId!, type: 'GROUP_DIGEST' } })
    expect(digest?.body).toContain('Photography')
    // Muted members get nothing.
    await prisma.communityGroupMember.update({ where: { groupId_memberId: { groupId, memberId: karta.memberId } }, data: { isMuted: true } })
    await createPost(jsonReq('http://x', 'POST', { kind: 'POST', content: 'Another one' }) as any, gparams(groupId))
    await prisma.notification.deleteMany({ where: { recipientId: karta.userId!, type: 'GROUP_DIGEST' } })
    await runDailyDigest(new Date(Date.now() + 2000))
    expect(await prisma.notification.count({ where: { recipientId: karta.userId!, type: 'GROUP_DIGEST' } })).toBe(0)
    // The cron endpoint refuses callers without the secret.
    expect((await cronDigest(new Request('http://x', { method: 'POST' }) as any)).status).toBe(403)
  })
})

describe('TC-IG — named groups need 5 members (exam, profession)', () => {
  it('TC-IG-070 an exam group appears when the 5th student names it, and all 5 are added', async () => {
    const students: XdPerson[] = []
    for (let i = 0; i < 5; i++) {
      const s = await makePerson(`IgStudent${i}`, { age: 20 })
      await grantConsent(s.memberId, s.userId!)
      students.push(s)
    }
    for (const [i, s] of students.entries()) {
      as(s)
      await put(s.memberId, 'students', { answer: 'YES', values: { studentNeeds: ['COMPETITIVE_EXAM'], studentExamName: i % 2 ? 'neet' : 'NEET ' } })
      const g = await prisma.communityGroup.findUnique({ where: { autoKey: 'exam:NEET|' } })
      if (i < 4) expect(g, `after ${i + 1}`).toBeNull()
      else expect(g).not.toBeNull()
    }
    const g = (await prisma.communityGroup.findUnique({ where: { autoKey: 'exam:NEET|' } }))!
    expect(await prisma.communityGroupMember.count({ where: { groupId: g.id, leftAt: null } })).toBe(5)
    expect(g.isChildSafe).toBe(true)
  })

  it('TC-IG-071 a profession group appears at 5 members of that profession', async () => {
    const ps: XdPerson[] = []
    for (let i = 0; i < 5; i++) ps.push(await makePerson(`IgTeacher${i}`, { age: 40, occupation: i ? 'Teacher' : 'teacher ' }))
    for (const p of ps) await syncMemberGroups(p.memberId, null)
    const g = await prisma.communityGroup.findUnique({ where: { autoKey: 'profession:TEACHER|' } })
    expect(g).not.toBeNull()
    expect(await prisma.communityGroupMember.count({ where: { groupId: g!.id, leftAt: null } })).toBe(5)
  })
})

describe('TC-IG — blood donor finder and contact (rule 10)', () => {
  it('TC-IG-080 donors are found only by blood group + city, and the phone is shared only after accepting', async () => {
    await prisma.member.update({ where: { id: asha.memberId }, data: { mobilePrimary: '9822011111' } })
    as(ravi)
    expect((await findDonors(new Request('http://x?bloodGroup=O%2B') as any)).status).toBe(400) // city required
    const found = await (await findDonors(new Request('http://x?bloodGroup=O%2B&city=Pune') as any)).json()
    expect(found.donors).toEqual([{ memberId: asha.memberId, name: 'IgAsha Xd', city: 'Pune' }])
    expect((await (await findDonors(new Request('http://x?bloodGroup=A%2B&city=Pune') as any)).json()).donors).toEqual([])

    const sent = await requestContact(jsonReq('http://x', 'POST', { toMemberId: asha.memberId, purpose: 'BLOOD_DONOR' }) as any)
    expect(sent.status).toBe(201)
    const { id } = await sent.json()
    let mine = await (await listContacts()).json()
    expect(mine.outgoing.find((o: any) => o.id === id).to.phone).toBeNull()
    as(asha)
    expect((await answerContact(jsonReq('http://x', 'PATCH', { action: 'accept' }) as any, gparams(id))).status).toBe(200)
    as(ravi)
    mine = await (await listContacts()).json()
    expect(mine.outgoing.find((o: any) => o.id === id).to.phone).toBe('9822011111')
    // Someone not listed as a donor can't be asked through the finder.
    expect((await requestContact(jsonReq('http://x', 'POST', { toMemberId: outsider.memberId, purpose: 'BLOOD_DONOR' }) as any)).status).toBe(404)
  })
})

describe('TC-IG — matching suggestions (rule 12)', () => {
  it('TC-IG-090 suggestions use only what both people share with the community', async () => {
    as(ravi) // photography beginner wanting training, Pune
    let m = (await (await getMatchesRoute()).json()).matches
    expect(m.canTeachYou.map((x: any) => x.memberId)).toContain(asha.memberId)
    expect(m.hobbyInYourCity.map((x: any) => x.memberId)).toContain(asha.memberId)
    as(asha)
    m = (await (await getMatchesRoute()).json()).matches
    expect(m.lookingForYourOffer.map((x: any) => x.memberId)).toContain(ravi.memberId)
    // Asha narrows her hobbies to her family: she drops out of Ravi's suggestions.
    const current = await (await getSection(jsonReq('http://x', 'GET') as any, { params: { id: asha.memberId, section: 'hobbies' } })).json()
    await put(asha.memberId, 'hobbies', { answer: 'YES', visibility: 'FAMILY', rows: current.section.rows })
    as(ravi)
    m = (await (await getMatchesRoute()).json()).matches
    expect(m.canTeachYou.map((x: any) => x.memberId)).not.toContain(asha.memberId)
    // Minors never appear.
    expect(JSON.stringify(m)).not.toContain(child.memberId)
  })

  it('TC-IG-091 "New in your city" lists recent members and people moving here who asked for contacts', async () => {
    const mover = await makePerson('IgMover', { age: 26, city: 'Mumbai', district: 'Mumbai' })
    await grantConsent(mover.memberId, mover.userId!)
    as(mover)
    await put(mover.memberId, 'housing', { answer: 'YES', visibility: 'COMMUNITY', values: { relocatingCity: 'Pune', relocatingWantsContacts: true } })
    as(ravi)
    const m = (await (await getMatchesRoute()).json()).matches
    expect(m.newInYourCity.map((x: any) => x.memberId)).toContain(mover.memberId)
  })
})

describe('TC-IG — child-safe groups with minors hold posts for a moderator', () => {
  it('TC-IG-100 an adult post in a child-safe group that has a minor is held; elsewhere it publishes', async () => {
    const chessGroup = (await groupFor(chess))!
    expect(await isIn(chessGroup.id, child.memberId)).toBe(true)
    await prisma.communityGroupMember.upsert({
      where: { groupId_memberId: { groupId: chessGroup.id, memberId: ravi.memberId } },
      update: { leftAt: null, rulesAcceptedAt: new Date() }, create: { groupId: chessGroup.id, memberId: ravi.memberId, rulesAcceptedAt: new Date() },
    })
    as(ravi)
    const res = await createPost(jsonReq('http://x', 'POST', { kind: 'POST', content: 'Chess club on Sunday' }) as any, gparams(chessGroup.id))
    expect((await res.json()).status).toBe('PENDING_APPROVAL')
  })
})
