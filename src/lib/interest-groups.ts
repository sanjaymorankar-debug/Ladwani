import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calculateAge } from '@/lib/utils'
import { memberDistrict } from '@/lib/additional-details/access'
import { hasMinorGroupConsent } from '@/lib/additional-details/server'

/**
 * Interest groups (Step 3). They reuse community_groups / community_group_members
 * with groupType = INTEREST, so the roster, audit and moderation code that
 * already exists keeps working for them.
 *
 * Where groups come from — and, as importantly, where they never come from:
 * only the sections read in desiredGroups() below. Insurance, family doctor,
 * investment adviser, loans and banking, health, government documents,
 * marriage support and emergency details are never read here (rule 8), so no
 * answer in them can create a group or add anyone to one.
 */

export const INTEREST_GROUP_TYPE = 'INTEREST'
export const DISTRICT_SUBGROUP_THRESHOLD = 10
export const NAMED_GROUP_THRESHOLD = 5
/** Leaving or being removed is sticky: the system never re-adds these. */
export const STICKY_LEAVE_REASONS = ['LEFT_BY_MEMBER', 'REMOVED_BY_MODERATOR']

export const DEFAULT_GROUP_RULES = [
  'Be respectful — no abuse, politics or personal attacks.',
  'Stay on the group topic. No advertising unless the group allows it.',
  'Never ask members for money, bank details or documents.',
  'Respect privacy: do not share anyone’s phone number or address without their permission.',
  'Use "Report" for anything that breaks these rules; moderators will act on it.',
].join('\n')

export const DERIVED_GROUPS: Record<string, { name: string; description: string; childSafe?: boolean }> = {
  CAREER: { name: 'Career and jobs', description: 'Jobs, internships, referrals and mentoring.' },
  BUSINESS_OWNERS: { name: 'Business owners', description: 'Members who run a business or practice — buy from and refer each other.' },
  FARMERS: { name: 'Farmers', description: 'Crops, methods, schemes and markets.' },
  FITNESS_YOGA: { name: 'Fitness and yoga', description: 'Practise together and keep each other going.' },
  SENIOR_CITIZENS: { name: 'Senior citizens', description: 'Company, outings and help for our elders.' },
  WOMENS_WING: { name: "Women's wing", description: 'Self-help, skills and business for women.' },
  YOUTH_WING: { name: 'Youth wing', description: 'Events and activities for young members.' },
  TRAVEL_YATRA: { name: 'Travel and yatra', description: 'Group tours, pilgrimages and treks.' },
  VOLUNTEERS: { name: 'Volunteers', description: 'Members ready to help at community events.' },
  BLOOD_DONORS: { name: 'Blood donors', description: 'Members willing to donate blood. Blood groups are never shown here.' },
}

const FITNESS_HOBBY_SLUGS = ['yoga', 'meditation', 'gym-fitness']

export interface DesiredGroup {
  groupKey: string
  name: string
  description: string
  interestId?: string
  isChildSafe: boolean
  /** Named groups (an exam, a profession) only exist once this many members share it. */
  threshold?: number
}

export const normaliseKey = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60)
const titleCase = (s: string) => s.trim().replace(/\s+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : [])

/** The groups this member's own answers point to. Pure read; changes nothing. */
export async function desiredGroups(memberId: string): Promise<DesiredGroup[]> {
  const [member, settings, detail, hobbies, sports, businessCount] = await Promise.all([
    prisma.member.findUnique({ where: { id: memberId }, select: { dateOfBirth: true, gender: true, occupationCategory: true } }),
    prisma.memberSectionSetting.findMany({ where: { memberId }, select: { sectionKey: true, answer: true } }),
    prisma.memberAdditionalDetail.findUnique({ where: { memberId } }),
    prisma.memberHobby.findMany({ where: { memberId }, include: { interest: true } }),
    prisma.memberSport.findMany({ where: { memberId }, include: { interest: true } }),
    prisma.business.count({ where: { memberId, isActive: true } }),
  ])
  if (!member) return []
  const yes = new Set(settings.filter((s) => s.answer === 'YES').map((s) => s.sectionKey))
  const age = calculateAge(member.dateOfBirth)
  const out: DesiredGroup[] = []
  const add = (key: string, extra: Partial<DesiredGroup> = {}) => {
    if (out.some((g) => g.groupKey === `derived:${key}`)) return
    const d = DERIVED_GROUPS[key]
    out.push({ groupKey: `derived:${key}`, name: d.name, description: d.description, isChildSafe: !!d.childSafe, ...extra })
  }
  const addInterest = (i: { id: string; name: string; status: string | null; isChildSafe: boolean | null; isActive: boolean | null }) => {
    if (i.status !== 'APPROVED' || i.isActive === false) return // "Other" waits for Admin approval
    if (out.some((g) => g.groupKey === `interest:${i.id}`)) return
    out.push({ groupKey: `interest:${i.id}`, name: i.name, description: `Members who enjoy ${i.name.toLowerCase()}.`, interestId: i.id, isChildSafe: !!i.isChildSafe })
  }

  if (yes.has('hobbies')) {
    for (const h of hobbies) {
      addInterest(h.interest)
      if (h.interest.status === 'APPROVED' && FITNESS_HOBBY_SLUGS.includes(h.interest.slug)) add('FITNESS_YOGA')
    }
  }
  if (yes.has('sports')) for (const s of sports) if (s.interest) addInterest(s.interest)
  if (yes.has('career') && detail) {
    const looking = arr(detail.careerLookingFor)
    if (looking.some((l) => ['JOB', 'JOB_CHANGE', 'INTERNSHIP'].includes(l)) || arr(detail.careerCanOffer).length) add('CAREER')
  }
  if (yes.has('business') && businessCount > 0) add('BUSINESS_OWNERS')
  if (yes.has('farm')) add('FARMERS')
  const culture = yes.has('culture') ? arr(detail?.cultureInterests) : []
  if (age !== null && age >= 60 && (yes.has('senior') || culture.includes('SENIOR_CLUB'))) add('SENIOR_CITIZENS')
  if (member.gender === 'FEMALE' && (yes.has('women') || culture.includes('WOMENS_WING'))) add('WOMENS_WING')
  if (culture.includes('YOUTH_WING')) add('YOUTH_WING')
  const travel = yes.has('travel') ? arr(detail?.travelInterests) : []
  const seniorNeeds = yes.has('senior') ? arr(detail?.seniorNeeds) : []
  if (travel.some((t) => ['GROUP_TOURS', 'PILGRIMAGE', 'TREKKING'].includes(t)) || seniorNeeds.includes('TRAVEL_GROUP')) add('TRAVEL_YATRA')
  if (yes.has('skills_share') && detail?.volunteerReady) add('VOLUNTEERS')
  if (yes.has('skills_share') && detail?.willingToDonateBlood) add('BLOOD_DONORS')
  if (yes.has('students') && detail?.studentExamName && arr(detail.studentNeeds).includes('COMPETITIVE_EXAM')) {
    const key = normaliseKey(detail.studentExamName)
    if (key) out.push({
      groupKey: `exam:${key}`, name: `Exam preparation — ${detail.studentExamName.trim().toUpperCase()}`,
      description: 'Students preparing for this exam.', isChildSafe: true, threshold: NAMED_GROUP_THRESHOLD,
    })
  }
  if (member.occupationCategory) {
    const key = normaliseKey(member.occupationCategory)
    if (key) out.push({
      groupKey: `profession:${key}`, name: `Profession — ${titleCase(member.occupationCategory)}`,
      description: 'Members who share this profession.', isChildSafe: false, threshold: NAMED_GROUP_THRESHOLD,
    })
  }
  return out
}

/** Members who currently qualify for a named (thresholded) group key. */
async function membersForNamedKey(groupKey: string): Promise<string[]> {
  const [kind, key] = groupKey.split(':')
  if (kind === 'exam') {
    const rows = await prisma.memberAdditionalDetail.findMany({
      where: { studentExamName: { not: null } },
      select: { memberId: true, studentExamName: true, studentNeeds: true },
    })
    const answered = new Set((await prisma.memberSectionSetting.findMany({
      where: { sectionKey: 'students', answer: 'YES', memberId: { in: rows.map((r) => r.memberId) } }, select: { memberId: true },
    })).map((s) => s.memberId))
    return rows.filter((r) => answered.has(r.memberId) && normaliseKey(r.studentExamName!) === key && arr(r.studentNeeds).includes('COMPETITIVE_EXAM')).map((r) => r.memberId)
  }
  if (kind === 'profession') {
    const rows = await prisma.member.findMany({
      where: { occupationCategory: { not: null }, status: 'ACTIVE', deletedAt: null },
      select: { id: true, occupationCategory: true },
    })
    return rows.filter((r) => normaliseKey(r.occupationCategory!) === key).map((r) => r.id)
  }
  return []
}

async function ensureGroup(d: DesiredGroup, actorUserId: string | null, district: string | null = null, parentGroupId: string | null = null) {
  const autoKey = `${d.groupKey}|${district ?? ''}`
  const existing = await prisma.communityGroup.findUnique({ where: { autoKey } })
  if (existing) return { group: existing, created: false }
  try {
    const group = await prisma.communityGroup.create({
      data: {
        name: district ? `${d.name} — ${district}` : d.name,
        groupType: INTEREST_GROUP_TYPE,
        description: d.description,
        maxMembers: null,
        status: 'ACTIVE',
        groupKey: d.groupKey,
        autoKey,
        interestId: d.interestId ?? null,
        parentGroupId,
        district,
        isChildSafe: d.isChildSafe,
        rules: DEFAULT_GROUP_RULES,
        createdBy: actorUserId,
      },
    })
    await prisma.auditLog.create({
      data: {
        actorId: actorUserId ?? (await systemActorId()),
        action: 'interest_group.auto_create', entityType: 'group', entityId: group.id,
        newValue: { name: group.name, groupKey: d.groupKey, district },
      },
    })
    return { group, created: true }
  } catch (e) {
    // Two saves racing to create the same group: the unique autoKey wins.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { group: await prisma.communityGroup.findUniqueOrThrow({ where: { autoKey } }), created: false }
    }
    throw e
  }
}

let cachedSystemActor: string | null = null
/** Audit rows need an actor; background work is attributed to the first Admin. */
async function systemActorId(): Promise<string> {
  if (cachedSystemActor) return cachedSystemActor
  const admin = await prisma.userRole.findFirst({ where: { role: { code: 'ADMIN' } }, select: { userId: true } })
  cachedSystemActor = admin!.userId
  return cachedSystemActor
}

interface MemberGroupProfile {
  id: string
  isMinor: boolean
  minorConsent: boolean
  autoAdd: boolean
  active: boolean
}

async function groupProfile(memberId: string): Promise<MemberGroupProfile | null> {
  const [m, detail] = await Promise.all([
    prisma.member.findUnique({ where: { id: memberId }, select: { id: true, dateOfBirth: true, status: true, deletedAt: true } }),
    prisma.memberAdditionalDetail.findUnique({ where: { memberId }, select: { autoAddToGroups: true } }),
  ])
  if (!m) return null
  const age = calculateAge(m.dateOfBirth)
  const isMinor = age !== null && age < 18
  return {
    id: m.id,
    isMinor,
    minorConsent: isMinor ? await hasMinorGroupConsent(memberId) : true,
    autoAdd: detail?.autoAddToGroups !== false,
    active: m.status === 'ACTIVE' && !m.deletedAt,
  }
}

/** Whether the system may add this member to this group on its own. */
async function mayAutoJoin(p: MemberGroupProfile, group: { id: string; isChildSafe: boolean | null }) {
  if (!p.active || !p.autoAdd) return false
  if (p.isMinor && (!group.isChildSafe || !p.minorConsent)) return false
  const row = await prisma.communityGroupMember.findUnique({ where: { groupId_memberId: { groupId: group.id, memberId: p.id } } })
  if (!row) return true
  if (!row.leftAt) return false // already in
  return !STICKY_LEAVE_REASONS.includes(row.leftReason ?? '')
}

async function addMember(groupId: string, memberId: string, addedBy: string | null, autoJoined: boolean) {
  await prisma.communityGroupMember.upsert({
    where: { groupId_memberId: { groupId, memberId } },
    update: { leftAt: null, leftReason: null, autoJoined, joinedAt: new Date(), addedBy },
    create: { groupId, memberId, roleInGroup: 'MEMBER', addedBy, autoJoined },
  })
}

/**
 * Community-level group → district sub-group once 10+ of its members live in
 * the same district (rule 5). Everyone in that district who is in the parent
 * group is added (subject to the same opt-out and minor rules).
 */
export async function ensureDistrictSubGroup(parentId: string, district: string | null, actorUserId: string | null) {
  if (!district) return null
  const parent = await prisma.communityGroup.findUnique({ where: { id: parentId } })
  if (!parent || parent.parentGroupId || !parent.groupKey) return null
  const roster = await prisma.communityGroupMember.findMany({ where: { groupId: parentId, leftAt: null }, select: { memberId: true } })
  const addresses = await prisma.address.findMany({
    where: { memberId: { in: roster.map((r) => r.memberId) }, addressType: 'CURRENT' },
    select: { memberId: true, district: true },
  })
  const target = district.trim().toLowerCase()
  const inDistrict = addresses.filter((a) => a.district?.trim().toLowerCase() === target).map((a) => a.memberId!)
  if (inDistrict.length < DISTRICT_SUBGROUP_THRESHOLD) return null

  const canonical = district.trim()
  const { group } = await ensureGroup(
    { groupKey: parent.groupKey, name: parent.name, description: parent.description ?? '', interestId: parent.interestId ?? undefined, isChildSafe: !!parent.isChildSafe },
    actorUserId, canonical, parent.id,
  )
  for (const memberId of inDistrict) {
    const p = await groupProfile(memberId)
    if (p && (await mayAutoJoinSubGroup(p, group))) await addMember(group.id, memberId, actorUserId, true)
  }
  return group
}

// Sub-groups follow the parent: being in the parent is the opt-in, so the
// member's auto-add setting was already applied when they joined it.
async function mayAutoJoinSubGroup(p: MemberGroupProfile, group: { id: string; isChildSafe: boolean | null }) {
  if (!p.active) return false
  if (p.isMinor && (!group.isChildSafe || !p.minorConsent)) return false
  const row = await prisma.communityGroupMember.findUnique({ where: { groupId_memberId: { groupId: group.id, memberId: p.id } } })
  if (!row) return true
  if (!row.leftAt) return false
  return !STICKY_LEAVE_REASONS.includes(row.leftReason ?? '')
}

export interface GroupRef {
  id: string
  name: string
}

export interface SyncResult {
  added: GroupRef[]
  /** Auto-joined groups the member no longer matches — removed only after they confirm. */
  removable: GroupRef[]
}

/**
 * Called after every Additional Details save. Creates any missing groups,
 * auto-joins where allowed, and reports groups that no longer match.
 */
export async function syncMemberGroups(memberId: string, actorUserId: string | null): Promise<SyncResult> {
  const profile = await groupProfile(memberId)
  if (!profile) return { added: [], removable: [] }
  const desired = await desiredGroups(memberId)
  const district = await memberDistrict(memberId)
  const added: GroupRef[] = []
  const matchedKeys = new Set<string>()

  for (const d of desired) {
    matchedKeys.add(d.groupKey)
    let qualifying: string[] | null = null
    if (d.threshold) {
      qualifying = await membersForNamedKey(d.groupKey)
      if (qualifying.length < d.threshold) continue
    }
    const { group, created } = await ensureGroup(d, actorUserId)
    if (await mayAutoJoin(profile, group)) {
      await addMember(group.id, memberId, actorUserId, true)
      added.push({ id: group.id, name: group.name })
    }
    // A named group that has just reached its threshold takes in everyone else who qualifies.
    if (created && qualifying) {
      for (const other of qualifying.filter((id) => id !== memberId)) {
        const p = await groupProfile(other)
        if (p && (await mayAutoJoin(p, group))) await addMember(group.id, other, actorUserId, true)
      }
    }
    const sub = await ensureDistrictSubGroup(group.id, district, actorUserId)
    if (sub && added.some((a) => a.id === group.id)) {
      const inSub = await prisma.communityGroupMember.findUnique({ where: { groupId_memberId: { groupId: sub.id, memberId } } })
      if (inSub && !inSub.leftAt) added.push({ id: sub.id, name: sub.name })
    }
  }

  const memberships = await prisma.communityGroupMember.findMany({
    where: { memberId, leftAt: null, autoJoined: true, group: { groupType: INTEREST_GROUP_TYPE, parentGroupId: null } },
    include: { group: { select: { id: true, name: true, groupKey: true } } },
  })
  const removable = memberships
    .filter((m) => m.group.groupKey && !matchedKeys.has(m.group.groupKey))
    .map((m) => ({ id: m.group.id, name: m.group.name }))

  return { added, removable }
}

/** Leaves a group and its district sub-groups. `reason` decides whether auto-join may re-add later. */
export async function leaveGroup(groupId: string, memberId: string, reason: 'LEFT_BY_MEMBER' | 'NO_LONGER_MATCHES' | 'REMOVED_BY_MODERATOR') {
  const subIds = (await prisma.communityGroup.findMany({ where: { parentGroupId: groupId }, select: { id: true } })).map((g) => g.id)
  await prisma.communityGroupMember.updateMany({
    where: { memberId, groupId: { in: [groupId, ...subIds] }, leftAt: null },
    data: { leftAt: new Date(), leftReason: reason },
  })
}

/** Confirmed removal after a hobby/interest was taken off the profile. Only genuinely unmatched groups are touched. */
export async function leaveUnmatched(memberId: string, groupIds: string[]): Promise<string[]> {
  const { removable } = await syncMemberGroups(memberId, null)
  const allowed = new Set(removable.map((g) => g.id))
  const left: string[] = []
  for (const id of groupIds) {
    if (allowed.has(id)) {
      await leaveGroup(id, memberId, 'NO_LONGER_MATCHES')
      left.push(id)
    }
  }
  return left
}

/** After Admin approves or merges a hobby, bring everyone who picked it into its group. */
export async function backfillInterest(interestId: string, actorUserId: string | null) {
  const holders = new Set([
    ...(await prisma.memberHobby.findMany({ where: { interestId }, select: { memberId: true } })).map((h) => h.memberId),
    ...(await prisma.memberSport.findMany({ where: { interestId }, select: { memberId: true } })).map((h) => h.memberId),
  ])
  for (const memberId of Array.from(holders)) await syncMemberGroups(memberId, actorUserId)
}

// ── Group access ────────────────────────────────────────────────────

export interface GroupAccess {
  group: Awaited<ReturnType<typeof prisma.communityGroup.findUnique>>
  isMember: boolean
  isModerator: boolean
  isStaff: boolean
  membership: Awaited<ReturnType<typeof prisma.communityGroupMember.findUnique>>
}

export async function getGroupAccess(session: any, groupId: string): Promise<GroupAccess> {
  const group = await prisma.communityGroup.findUnique({ where: { id: groupId } })
  const roles = ((session?.user?.roles ?? []) as string[])
  const isStaff = roles.includes('ADMIN') || roles.includes('OPERATOR')
  const memberId = session?.user?.memberId as string | null
  const membership = group && memberId
    ? await prisma.communityGroupMember.findUnique({ where: { groupId_memberId: { groupId, memberId } } })
    : null
  const isMember = !!membership && !membership.leftAt
  let isModerator = isMember && (membership!.roleInGroup === 'MODERATOR' || membership!.roleInGroup === 'CONVENER')
  // A parent group's moderators also moderate its district sub-groups.
  if (!isModerator && group?.parentGroupId && memberId) {
    const parentRow = await prisma.communityGroupMember.findUnique({ where: { groupId_memberId: { groupId: group.parentGroupId, memberId } } })
    isModerator = !!parentRow && !parentRow.leftAt && parentRow.roleInGroup === 'MODERATOR'
  }
  return { group, isMember, isModerator, isStaff, membership }
}

/** Notifications for a new group post: immediate only for EVERY_POST members; the rest get the daily digest. */
export async function notifyGroupPost(postId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId }, include: { group: true } })
  if (!post?.groupId || post.status !== 'PUBLISHED') return 0
  const rows = await prisma.communityGroupMember.findMany({
    where: { groupId: post.groupId, leftAt: null, notifyMode: 'EVERY_POST', isMuted: { not: true } },
    include: { member: { select: { userId: true } } },
  })
  const recipients = rows.map((r) => r.member.userId).filter((u): u is string => !!u && u !== post.authorId)
  if (!recipients.length) return 0
  await prisma.notification.createMany({
    data: recipients.map((recipientId) => ({
      recipientId, senderId: post.authorId, type: 'GROUP_POST',
      title: `New in ${post.group!.name}`, body: post.title ?? post.content?.slice(0, 140) ?? null,
      data: { groupId: post.groupId, postId: post.id },
    })),
  })
  return recipients.length
}

/**
 * Daily digest (rule 11): one notification per person summarising new posts
 * in their DAILY_DIGEST groups since their last digest. Run from cron via
 * /api/cron/group-digest.
 */
export async function runDailyDigest(now = new Date()) {
  const rows = await prisma.communityGroupMember.findMany({
    where: { leftAt: null, isMuted: { not: true }, OR: [{ notifyMode: 'DAILY_DIGEST' }, { notifyMode: null }], group: { groupType: INTEREST_GROUP_TYPE } },
    include: { member: { select: { userId: true } }, group: { select: { id: true, name: true } } },
  })
  const perUser = new Map<string, { groups: { name: string; count: number }[]; rowIds: string[] }>()
  for (const r of rows) {
    const userId = r.member.userId
    if (!userId) continue
    const since = new Date(Math.max((r.lastDigestAt ?? r.joinedAt).getTime(), now.getTime() - 7 * 86400000))
    const count = await prisma.post.count({
      where: { groupId: r.groupId, status: 'PUBLISHED', deletedAt: null, createdAt: { gt: since, lte: now }, authorId: { not: userId } },
    })
    const entry = perUser.get(userId) ?? { groups: [], rowIds: [] }
    entry.rowIds.push(r.id)
    if (count) entry.groups.push({ name: r.group.name, count })
    perUser.set(userId, entry)
  }
  let sent = 0
  for (const [userId, { groups, rowIds }] of Array.from(perUser.entries())) {
    if (groups.length) {
      const total = groups.reduce((s, g) => s + g.count, 0)
      await prisma.notification.create({
        data: {
          recipientId: userId, type: 'GROUP_DIGEST',
          title: `${total} new post${total === 1 ? '' : 's'} in your groups`,
          body: groups.map((g) => `${g.name}: ${g.count}`).join('\n'),
          data: { groups },
        },
      })
      sent++
    }
    await prisma.communityGroupMember.updateMany({ where: { id: { in: rowIds } }, data: { lastDigestAt: now } })
  }
  return sent
}

/** Moderator suggestion (rule 10): the most active member who is an expert or a mentor in this group. */
export async function suggestModerator(groupId: string) {
  const group = await prisma.communityGroup.findUnique({ where: { id: groupId } })
  if (!group) return null
  const roster = await prisma.communityGroupMember.findMany({
    where: { groupId, leftAt: null },
    include: { member: { select: { id: true, firstName: true, lastName: true, userId: true, dateOfBirth: true } } },
  })
  const experts = new Set<string>()
  if (group.interestId) {
    for (const h of await prisma.memberHobby.findMany({
      where: { interestId: group.interestId, memberId: { in: roster.map((r) => r.memberId) }, OR: [{ level: 'EXPERT' }, { canTeach: true }] },
      select: { memberId: true },
    })) experts.add(h.memberId)
  }
  let best: { memberId: string; name: string; posts: number; expert: boolean } | null = null
  for (const r of roster) {
    const age = calculateAge(r.member.dateOfBirth)
    if (age !== null && age < 18) continue
    const posts = r.member.userId ? await prisma.post.count({ where: { groupId, authorId: r.member.userId, deletedAt: null } }) : 0
    const expert = experts.has(r.memberId)
    const better = !best || (expert && !best.expert) || (expert === best.expert && posts > best.posts)
    if (better) best = { memberId: r.memberId, name: `${r.member.firstName} ${r.member.lastName ?? ''}`.trim(), posts, expert }
  }
  return best
}

/** Group posts are readable only inside their group (plus staff). Null post → not found. */
export async function getPostAccess(session: any, postId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } })
  if (!post || post.deletedAt) return { post: null, allowed: false, isModerator: false, isStaff: false }
  if (!post.groupId) return { post, allowed: true, isModerator: false, isStaff: false }
  const access = await getGroupAccess(session, post.groupId)
  return { post, allowed: access.isMember || access.isStaff, isModerator: access.isModerator || access.isStaff, isStaff: access.isStaff }
}

/** Post type rows for group post kinds (seeded; created on demand if a deployment skipped the seed). */
export const GROUP_POST_TYPES: Record<string, { code: string; label: string; icon: string }> = {
  POST: { code: 'GROUP_POST', label: 'Group post', icon: '💬' },
  QUESTION: { code: 'GROUP_QUESTION', label: 'Problem / need help', icon: '🙋' },
  KNOWLEDGE: { code: 'GROUP_KNOWLEDGE', label: 'Knowledge', icon: '📘' },
  EVENT: { code: 'GROUP_EVENT', label: 'Event / meet-up', icon: '📅' },
  POLL: { code: 'GROUP_POLL', label: 'Poll', icon: '📊' },
}

export async function groupPostTypeId(kind: string): Promise<string> {
  const t = GROUP_POST_TYPES[kind]
  const row = await prisma.postType.upsert({ where: { code: t.code }, update: {}, create: t })
  return row.id
}

/** Whether any current member of the group is under 18. */
export async function groupHasMinors(groupId: string): Promise<boolean> {
  const rows = await prisma.communityGroupMember.findMany({
    where: { groupId, leftAt: null },
    select: { member: { select: { dateOfBirth: true } } },
  })
  return rows.some((r) => {
    const age = calculateAge(r.member.dateOfBirth)
    return age !== null && age < 18
  })
}
