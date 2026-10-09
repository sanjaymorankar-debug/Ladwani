import { prisma } from '@/lib/prisma'
import { calculateAge } from '@/lib/utils'
import type { TeamScope } from '@/lib/additional-details/access'
import { INTEREST_GROUP_TYPE } from '@/lib/interest-groups'

/**
 * Matching suggestions, the blood donor finder, "request contact", and the
 * support/group reports. Every query here enforces visibility itself (rule 8):
 * a suggestion only ever uses sections both people have shared with the
 * whole community, and minors never appear in anyone's suggestions.
 */

const COMMUNITY = 'COMMUNITY'
const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : [])
const isMinorDob = (dob: Date | null) => {
  const age = calculateAge(dob)
  return age !== null && age < 18
}

/** Members (other than `exclude`) who shared `sectionKey` with the whole community. */
async function sharedWithCommunity(sectionKey: string): Promise<Set<string>> {
  const rows = await prisma.memberSectionSetting.findMany({
    where: { sectionKey, answer: 'YES', visibility: COMMUNITY },
    select: { memberId: true },
  })
  return new Set(rows.map((r) => r.memberId))
}

export interface MatchPerson {
  memberId: string
  name: string
  city: string | null
  profilePhotoId: string | null
  reason: string
}

export interface Matches {
  canTeachYou: MatchPerson[]
  lookingForYourOffer: MatchPerson[]
  hobbyInYourCity: MatchPerson[]
  newInYourCity: MatchPerson[]
}

export async function getMatches(memberId: string, limit = 8): Promise<Matches> {
  const empty: Matches = { canTeachYou: [], lookingForYourOffer: [], hobbyInYourCity: [], newInYourCity: [] }
  const me = await prisma.member.findUnique({ where: { id: memberId }, select: { currentCity: true, dateOfBirth: true } })
  if (!me || isMinorDob(me.dateOfBirth)) return empty

  const [hobbyShared, careerShared, housingShared] = await Promise.all([
    sharedWithCommunity('hobbies'), sharedWithCommunity('career'), sharedWithCommunity('housing'),
  ])
  const myCity = me.currentCity?.trim().toLowerCase() || null

  const people = new Map<string, { name: string; city: string | null; profilePhotoId: string | null; dob: Date | null; status: string }>()
  const loadPeople = async (ids: string[]) => {
    const missing = ids.filter((id) => !people.has(id))
    if (!missing.length) return
    for (const m of await prisma.member.findMany({
      where: { id: { in: missing } },
      select: { id: true, firstName: true, lastName: true, currentCity: true, profilePhotoId: true, dateOfBirth: true, status: true, deletedAt: true },
    })) {
      if (m.deletedAt) continue
      people.set(m.id, { name: `${m.firstName} ${m.lastName ?? ''}`.trim(), city: m.currentCity, profilePhotoId: m.profilePhotoId, dob: m.dateOfBirth, status: m.status })
    }
  }
  const push = (list: MatchPerson[], id: string, reason: string) => {
    const p = people.get(id)
    if (!p || id === memberId || p.status !== 'ACTIVE' || isMinorDob(p.dob)) return
    if (list.length >= limit || list.some((x) => x.memberId === id)) return
    list.push({ memberId: id, name: p.name, city: p.city, profilePhotoId: p.profilePhotoId, reason })
  }
  const out: Matches = { canTeachYou: [], lookingForYourOffer: [], hobbyInYourCity: [], newInYourCity: [] }

  if (hobbyShared.has(memberId)) {
    const mine = await prisma.memberHobby.findMany({ where: { memberId }, include: { interest: { select: { name: true, status: true } } } })
    const approved = mine.filter((h) => h.interest.status === 'APPROVED')
    const others = await prisma.memberHobby.findMany({
      where: { interestId: { in: approved.map((h) => h.interestId) }, memberId: { not: memberId } },
    })
    const visible = others.filter((o) => hobbyShared.has(o.memberId))
    await loadPeople(visible.map((o) => o.memberId))
    for (const h of approved) {
      const wantsToLearn = h.level === 'BEGINNER' || (h.needsSupport && arr(h.supportTypes).includes('TRAINING'))
      for (const o of visible.filter((x) => x.interestId === h.interestId)) {
        if (wantsToLearn && o.canTeach) push(out.canTeachYou, o.memberId, `Can teach ${h.interest.name}`)
        const theyWantToLearn = o.level === 'BEGINNER' || (o.needsSupport && arr(o.supportTypes).includes('TRAINING'))
        if (h.canTeach && theyWantToLearn) push(out.lookingForYourOffer, o.memberId, `Wants to learn ${h.interest.name}`)
        const theirCity = people.get(o.memberId)?.city?.trim().toLowerCase()
        if (myCity && theirCity === myCity) push(out.hobbyInYourCity, o.memberId, h.interest.name)
      }
    }
  }

  if (careerShared.has(memberId)) {
    const mine = await prisma.memberAdditionalDetail.findUnique({ where: { memberId }, select: { careerCanOffer: true, careerOfferField: true } })
    const offers = arr(mine?.careerCanOffer)
    if (offers.length) {
      const wanted = new Set<string>()
      if (offers.includes('JOB_REFERRAL')) ['JOB', 'JOB_CHANGE'].forEach((x) => wanted.add(x))
      if (offers.includes('INTERNSHIP')) wanted.add('INTERNSHIP')
      if (offers.includes('BUSINESS_ADVICE')) wanted.add('BUSINESS_PARTNER')
      const seekers = await prisma.memberAdditionalDetail.findMany({
        where: { memberId: { in: Array.from(careerShared), not: memberId } },
        select: { memberId: true, careerLookingFor: true, careerSupportNeeds: true },
      })
      await loadPeople(seekers.map((s) => s.memberId))
      for (const s of seekers) {
        const looking = arr(s.careerLookingFor).filter((l) => wanted.has(l))
        const needsMentor = offers.includes('MENTORING') && arr(s.careerSupportNeeds).includes('CAREER_GUIDANCE')
        if (looking.length) push(out.lookingForYourOffer, s.memberId, `Looking for ${looking.join(', ').toLowerCase().replace(/_/g, ' ')}`)
        else if (needsMentor) push(out.lookingForYourOffer, s.memberId, 'Looking for career guidance')
      }
    }
  }

  if (myCity) {
    // People moving here who asked for local contacts come first.
    const movers = await prisma.memberAdditionalDetail.findMany({
      where: { memberId: { in: Array.from(housingShared), not: memberId }, relocatingWantsContacts: true, relocatingCity: { not: null } },
      select: { memberId: true, relocatingCity: true },
    })
    const comingHere = movers.filter((m) => m.relocatingCity!.trim().toLowerCase() === myCity)
    await loadPeople(comingHere.map((m) => m.memberId))
    for (const m of comingHere) push(out.newInYourCity, m.memberId, `Moving to ${me.currentCity}`)

    const since = new Date(Date.now() - 30 * 86400000)
    const recent = await prisma.member.findMany({
      where: { createdAt: { gte: since }, status: 'ACTIVE', deletedAt: null, id: { not: memberId }, currentCity: { not: null } },
      select: { id: true, currentCity: true },
      take: 200,
      orderBy: { createdAt: 'desc' },
    })
    const sameCity = recent.filter((r) => r.currentCity!.trim().toLowerCase() === myCity)
    await loadPeople(sameCity.map((r) => r.id))
    for (const r of sameCity) push(out.newInYourCity, r.id, 'Recently joined')
  }
  return out
}

// ── Blood donor finder (rule 10) ──────────────────────────────────

export async function findBloodDonors(bloodGroup: string, city: string, viewerMemberId: string | null) {
  const willing = await prisma.memberAdditionalDetail.findMany({ where: { willingToDonateBlood: true }, select: { memberId: true } })
  const answered = new Set((await prisma.memberSectionSetting.findMany({
    where: { sectionKey: 'skills_share', answer: 'YES', memberId: { in: willing.map((w) => w.memberId) } }, select: { memberId: true },
  })).map((s) => s.memberId))
  const members = await prisma.member.findMany({
    where: {
      id: { in: Array.from(answered), ...(viewerMemberId ? { not: viewerMemberId } : {}) },
      bloodGroup, status: 'ACTIVE', deletedAt: null, userId: { not: null },
      currentCity: { contains: city.trim() },
    },
    select: { id: true, firstName: true, lastName: true, currentCity: true, dateOfBirth: true },
    take: 50,
  })
  // Name and a "request contact" button only — no phone, no blood-donation history.
  return members
    .filter((m) => !isMinorDob(m.dateOfBirth))
    .map((m) => ({ memberId: m.id, name: `${m.firstName} ${m.lastName ?? ''}`.trim(), city: m.currentCity }))
}

/**
 * Minors cannot receive direct contact from adults outside their family
 * (Step 3 rule 9). Applies to every "request contact" in this module.
 */
export async function contactAllowed(fromMemberId: string, toMemberId: string): Promise<{ ok: boolean; reason?: string }> {
  if (fromMemberId === toMemberId) return { ok: false, reason: 'You cannot contact yourself' }
  const [from, to] = await Promise.all([
    prisma.member.findUnique({ where: { id: fromMemberId }, select: { dateOfBirth: true } }),
    prisma.member.findUnique({ where: { id: toMemberId }, select: { dateOfBirth: true, status: true, deletedAt: true } }),
  ])
  if (!from || !to || to.deletedAt || to.status !== 'ACTIVE') return { ok: false, reason: 'Member not found' }
  if (isMinorDob(to.dateOfBirth) && !isMinorDob(from.dateOfBirth)) {
    const toFamilies = await prisma.familyMember.findMany({ where: { memberId: toMemberId, leftAt: null }, select: { familyId: true } })
    const shared = toFamilies.length
      ? await prisma.familyMember.findFirst({ where: { memberId: fromMemberId, leftAt: null, familyId: { in: toFamilies.map((f) => f.familyId) } } })
      : null
    if (!shared) return { ok: false, reason: 'Members under 18 can only be contacted by their own family' }
  }
  return { ok: true }
}

// ── Reports (dashboard) ─────────────────────────────────────────────

/** Which districts' support requests a scope may see; null = all. */
async function scopeDistricts(scope: TeamScope): Promise<string[] | null> {
  if (scope.isAdmin || scope.isOperator || scope.national) return null
  const names = new Set(scope.districts)
  if (scope.states.length) {
    const states = await prisma.area.findMany({ where: { type: 'STATE' }, select: { id: true, name: true } })
    const ids = states.filter((s) => scope.states.includes(s.name.toLowerCase())).map((s) => s.id)
    for (const d of await prisma.area.findMany({ where: { parentId: { in: ids }, type: 'DISTRICT' }, select: { name: true } })) {
      names.add(d.name.toLowerCase())
    }
  }
  return Array.from(names)
}

export async function supportReport(scope: TeamScope) {
  const allowed = await scopeDistricts(scope)
  const open = await prisma.supportRequest.findMany({ where: { status: 'OPEN' }, select: { category: true, district: true } })
  const visible = allowed === null ? open : open.filter((r) => r.district && allowed.includes(r.district.toLowerCase()))
  const count = (key: (r: (typeof visible)[number]) => string) => {
    const m = new Map<string, number>()
    for (const r of visible) m.set(key(r), (m.get(key(r)) ?? 0) + 1)
    return Array.from(m.entries()).map(([k, n]) => ({ key: k, count: n })).sort((a, b) => b.count - a.count)
  }
  return {
    total: visible.length,
    byCategory: count((r) => r.category),
    byDistrict: count((r) => r.district || 'Not given'),
    byDistrictAndCategory: count((r) => `${r.district || 'Not given'}|${r.category}`),
  }
}

/** Named requests — District team of that district only (rule 3). */
export async function namedSupportRequests(scope: TeamScope) {
  if (!scope.districts.length) return []
  const open = await prisma.supportRequest.findMany({
    where: { status: 'OPEN', district: { not: null } },
    include: { member: { select: { id: true, firstName: true, lastName: true, currentCity: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
  return open
    .filter((r) => scope.districts.includes(r.district!.toLowerCase()))
    .map((r) => ({
      id: r.id, category: r.category, district: r.district, note: r.note, createdAt: r.createdAt,
      member: { id: r.member.id, name: `${r.member.firstName} ${r.member.lastName ?? ''}`.trim(), city: r.member.currentCity },
    }))
}

export async function groupReport() {
  const since = new Date(Date.now() - 30 * 86400000)
  const groups = await prisma.communityGroup.findMany({
    where: { groupType: INTEREST_GROUP_TYPE, deletedAt: null, isActive: true },
    select: {
      id: true, name: true, parentGroupId: true,
      _count: { select: { members: { where: { leftAt: null } }, posts: { where: { createdAt: { gte: since }, deletedAt: null } } } },
    },
  })
  const [raised, solved, hobbyTeachers, guidance, careerMentors] = await Promise.all([
    prisma.post.count({ where: { groupPostKind: 'QUESTION', deletedAt: null } }),
    prisma.post.count({ where: { groupPostKind: 'QUESTION', isSolved: true, deletedAt: null } }),
    prisma.memberHobby.findMany({ where: { canTeach: true }, select: { memberId: true, interest: { select: { name: true } } } }),
    prisma.memberAdditionalDetail.findMany({ select: { memberId: true, guidanceFields: true, teachSubjects: true } }),
    prisma.memberAdditionalDetail.findMany({ where: { careerOfferField: { not: null } }, select: { memberId: true, careerOfferField: true, careerCanOffer: true } }),
  ])
  const mentors = new Map<string, Set<string>>()
  const addMentor = (field: string, memberId: string) => {
    if (!mentors.has(field)) mentors.set(field, new Set())
    mentors.get(field)!.add(memberId)
  }
  for (const h of hobbyTeachers) addMentor(h.interest.name, h.memberId)
  for (const g of guidance) for (const f of arr(g.guidanceFields)) addMentor(`Guidance: ${f.charAt(0) + f.slice(1).toLowerCase()}`, g.memberId)
  for (const c of careerMentors) if (arr(c.careerCanOffer).includes('MENTORING')) addMentor(`Career: ${c.careerOfferField!.trim()}`, c.memberId)

  const rows = groups.map((g) => ({ id: g.id, name: g.name, isSubGroup: !!g.parentGroupId, members: g._count.members, posts30d: g._count.posts }))
  return {
    groupCount: rows.length,
    subGroupCount: rows.filter((r) => r.isSubGroup).length,
    membersPerGroup: [...rows].sort((a, b) => b.members - a.members),
    mostActive: [...rows].filter((r) => r.posts30d > 0).sort((a, b) => b.posts30d - a.posts30d).slice(0, 5),
    problems: { raised, solved },
    mentorsByField: Array.from(mentors.entries()).map(([field, set]) => ({ field, count: set.size })).sort((a, b) => b.count - a.count),
  }
}
