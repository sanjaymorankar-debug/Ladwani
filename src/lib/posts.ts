import { Session } from 'next-auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { areaChain, chainLevel } from '@/lib/locations'
import { mulGaonOf } from '@/lib/verification'
import { friendIdsOf, inFriendList } from '@/lib/friends'
import { notifyUser } from '@/lib/notify'

/**
 * F36 — who a post is for, who sees it and who moderates it.
 *   COMMUNITY     everyone signed in (existing behaviour; members' posts are
 *                 held for an Operator / Admin, as before)
 *   FAMILY        one family the author belongs to          — no moderation
 *   FRIEND_LIST   one of the author's friend lists           — no moderation
 *   ORGANISATION  an organisation / body the author is in    — no moderation
 *   DISTRICT / STATE / NATIONAL — the author's own district / state, or the
 *                 nation: held until that LadWani body (its President or
 *                 Secretary) or an Admin approves it.
 */
export const AUDIENCES = ['COMMUNITY', 'FAMILY', 'FRIEND_LIST', 'ORGANISATION', 'DISTRICT', 'STATE', 'NATIONAL'] as const
export type Audience = (typeof AUDIENCES)[number]
export const BODY_MODERATED = ['DISTRICT', 'STATE', 'NATIONAL']
const BODY_FOR: Record<string, string> = { DISTRICT: 'DISTRICT_BODY', STATE: 'STATE_BODY', NATIONAL: 'NATIONAL_BODY' }

const rolesOf = (s: Session | null) => ((s?.user as any)?.roles ?? []) as string[]
const memberOf = (s: Session | null) => ((s?.user as any)?.memberId ?? null) as string | null

/** The viewer's district and state (from their Mul Gaon). */
export async function homeAreas(memberId: string | null) {
  const mg = memberId ? await mulGaonOf(memberId) : null
  if (!mg) return { district: null as string | null, state: null as string | null, country: null as string | null }
  const chain = await areaChain(mg)
  return { district: chainLevel(chain, 'DISTRICT')?.id ?? null, state: chainLevel(chain, 'STATE')?.id ?? null, country: chainLevel(chain, 'COUNTRY')?.id ?? null }
}

/** Checks the author may address this audience; returns the stored id or an error. */
export async function resolveAudience(session: Session, type: string, id: unknown): Promise<{ type: Audience; id: string | null } | { error: string }> {
  const t = (AUDIENCES as readonly string[]).includes(type) ? (type as Audience) : 'COMMUNITY'
  const me = memberOf(session)
  const sid = typeof id === 'string' && id ? id : null
  if (t === 'COMMUNITY' || t === 'NATIONAL') return { type: t, id: null }
  if (!me) return { error: 'Complete your profile first' }
  if (t === 'FAMILY') {
    const ok = sid && await prisma.familyMember.findFirst({ where: { familyId: sid, memberId: me, leftAt: null } })
    return ok ? { type: t, id: sid } : { error: 'Choose one of your families' }
  }
  if (t === 'FRIEND_LIST') {
    const list = sid ? await prisma.friendList.findUnique({ where: { id: sid } }) : null
    return list && list.ownerMemberId === me ? { type: t, id: sid } : { error: 'Choose one of your friend lists' }
  }
  if (t === 'ORGANISATION') {
    const ok = sid && await prisma.organisationMember.findFirst({ where: { organisationId: sid, memberId: me, status: 'ACTIVE' } })
    const org = ok ? await prisma.organisation.findUnique({ where: { id: sid! }, select: { status: true } }) : null
    return ok && org?.status === 'ACTIVE' ? { type: t, id: sid } : { error: 'Choose an organisation you belong to' }
  }
  const home = await homeAreas(me)
  const area = t === 'DISTRICT' ? home.district : home.state
  if (!area && !rolesOf(session).includes('ADMIN')) return { error: 'Your Mul Gaon is not set, so you have no district / state group' }
  return { type: t, id: rolesOf(session).includes('ADMIN') && sid ? sid : area }
}

async function authorMemberId(authorUserId: string) {
  return (await prisma.member.findUnique({ where: { userId: authorUserId }, select: { id: true } }))?.id ?? null
}

/** Officers of the LadWani body for a district / state / nation (President, Secretary). */
async function bodyOfficerMemberIds(audienceType: string, audienceId: string | null) {
  const kind = BODY_FOR[audienceType]
  if (!kind) return []
  const body = await prisma.organisation.findFirst({ where: { kind, status: 'ACTIVE', ...(audienceId ? { areaId: audienceId } : {}) } })
  if (!body) return []
  const rows = await prisma.organisationMember.findMany({ where: { organisationId: body.id, status: 'ACTIVE', designation: { in: ['PRESIDENT', 'SECRETARY'] } }, select: { memberId: true } })
  return rows.map((r) => r.memberId)
}

export async function canModeratePost(session: Session | null, post: { audienceType: string; audienceId: string | null }) {
  const roles = rolesOf(session)
  if (roles.includes('ADMIN')) return true
  if (BODY_MODERATED.includes(post.audienceType)) {
    const me = memberOf(session)
    return !!me && (await bodyOfficerMemberIds(post.audienceType, post.audienceId)).includes(me)
  }
  return roles.includes('OPERATOR')
}

/** Can this person see this post (its audience, or as its author / a moderator)? */
export async function canViewPost(session: Session | null, post: { authorId: string; status: string; deletedAt: Date | null; audienceType: string; audienceId: string | null }) {
  if (!session?.user?.id || post.deletedAt) return false
  if (post.authorId === session.user.id) return true
  if (post.status !== 'PUBLISHED') return canModeratePost(session, post)
  const me = memberOf(session)
  switch (post.audienceType) {
    case 'COMMUNITY': case 'NATIONAL': return true
    case 'FAMILY': return !!me && !!post.audienceId && !!(await prisma.familyMember.findFirst({ where: { familyId: post.audienceId, memberId: me, leftAt: null } }))
    case 'FRIEND_LIST': {
      const owner = await authorMemberId(post.authorId)
      return !!owner && !!post.audienceId && inFriendList(post.audienceId, owner, me)
    }
    case 'ORGANISATION': return !!me && !!post.audienceId && !!(await prisma.organisationMember.findFirst({ where: { organisationId: post.audienceId, memberId: me, status: 'ACTIVE' } }))
    case 'DISTRICT': case 'STATE': {
      if (rolesOf(session).includes('ADMIN')) return true
      const home = await homeAreas(me)
      return post.audienceId === (post.audienceType === 'DISTRICT' ? home.district : home.state)
    }
  }
  return false
}

/** Prisma filter for the feed: published posts whose audience includes the viewer, plus their own. */
export async function feedWhere(session: Session): Promise<Prisma.PostWhereInput> {
  const me = memberOf(session)
  const or: Prisma.PostWhereInput[] = [{ audienceType: { in: ['COMMUNITY', 'NATIONAL'] } }]
  if (me) {
    const [families, orgs, listRows, friends, home] = await Promise.all([
      prisma.familyMember.findMany({ where: { memberId: me, leftAt: null }, select: { familyId: true } }),
      prisma.organisationMember.findMany({ where: { memberId: me, status: 'ACTIVE' }, select: { organisationId: true } }),
      prisma.friendListMember.findMany({ where: { friendMemberId: me }, select: { listId: true } }),
      friendIdsOf(me),
      homeAreas(me),
    ])
    const lists = await prisma.friendList.findMany({ where: { id: { in: listRows.map((l) => l.listId) }, ownerMemberId: { in: friends } }, select: { id: true } })
    or.push({ audienceType: 'FAMILY', audienceId: { in: families.map((f) => f.familyId) } })
    or.push({ audienceType: 'ORGANISATION', audienceId: { in: orgs.map((o) => o.organisationId) } })
    or.push({ audienceType: 'FRIEND_LIST', audienceId: { in: lists.map((l) => l.id) } })
    if (home.district) or.push({ audienceType: 'DISTRICT', audienceId: home.district })
    if (home.state) or.push({ audienceType: 'STATE', audienceId: home.state })
  }
  return { deletedAt: null, OR: [{ status: 'PUBLISHED', OR: or }, { authorId: session.user!.id, status: { not: 'REMOVED' } }] }
}

/** F36 "alert to audience" — for the bounded audiences (a family, a friend list, an organisation). */
export async function alertAudience(post: { id: string; authorId: string; audienceType: string; audienceId: string | null; title: string | null }) {
  let memberIds: string[] = []
  if (post.audienceType === 'FAMILY' && post.audienceId) {
    memberIds = (await prisma.familyMember.findMany({ where: { familyId: post.audienceId, leftAt: null }, select: { memberId: true } })).map((r) => r.memberId)
  } else if (post.audienceType === 'FRIEND_LIST' && post.audienceId) {
    memberIds = (await prisma.friendListMember.findMany({ where: { listId: post.audienceId }, select: { friendMemberId: true } })).map((r) => r.friendMemberId)
  } else if (post.audienceType === 'ORGANISATION' && post.audienceId) {
    memberIds = (await prisma.organisationMember.findMany({ where: { organisationId: post.audienceId, status: 'ACTIVE' }, select: { memberId: true } })).map((r) => r.memberId)
  } else return 0
  const users = await prisma.member.findMany({ where: { id: { in: memberIds }, userId: { not: null } }, select: { userId: true } })
  const author = await prisma.member.findUnique({ where: { userId: post.authorId }, select: { firstName: true } })
  let sent = 0
  for (const u of users) {
    if (u.userId === post.authorId) continue
    await notifyUser({ userId: u.userId!, type: 'NEW_POST', title: `${author?.firstName ?? 'Someone'} posted${post.title ? `: ${post.title}` : ''}`, body: 'Open the community feed to read it.', data: { postId: post.id } })
    sent++
  }
  return sent
}

/** Safe author shape for posts and comments: names only (never the user row). */
export const AUTHOR_SELECT = { select: { id: true, member: { select: { id: true, firstName: true, lastName: true, profilePhotoId: true } } } } as const
