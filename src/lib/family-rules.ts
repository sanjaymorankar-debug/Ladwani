import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { notifyUser } from '@/lib/notify'
import { recordAudit } from '@/lib/audit'
import { districtOf } from '@/lib/locations'
import { ageOn } from '@/lib/validators'

/**
 * P2 family rules (F09–F18) shared by the family routes.
 *
 * Rule 1: one person = one member row; each family they belong to is a
 * family_members row with its own relationship role, relative-to person and
 * status. Rule 2: exactly one active Karta per family — the database refuses
 * a second (unique generated kartaGuard); a family without one is KARTA_VACANT.
 */
type Db = Prisma.TransactionClient | typeof prisma

/** F09: a person can be the active Karta of only one family (member of many). */
export async function kartaFamilyOf(memberId: string, db: Db = prisma) {
  const row = await db.familyMember.findFirst({ where: { memberId, isKarta: true, leftAt: null }, select: { familyId: true } })
  return row?.familyId ?? null
}

/** F10: a gendered relationship must match the person's gender ('Daughter' needs Female). */
export async function roleGenderError(roleCode: string | null | undefined, gender: string | null | undefined) {
  if (!roleCode) return null
  const type = await prisma.relationshipType.findUnique({ where: { code: roleCode } })
  if (!type || !type.isActive) return 'Choose a relationship from the list'
  if (type.genderApplicable && ['MALE', 'FEMALE'].includes(type.genderApplicable)
    && gender && ['MALE', 'FEMALE'].includes(gender) && type.genderApplicable !== gender) {
    return `"${type.label}" is a ${type.genderApplicable === 'MALE' ? 'male' : 'female'} relationship — check the gender or the relationship`
  }
  return null
}

/** Account holders who belong (actively) to the family. */
export async function familyUserIds(familyId: string, exceptUserId?: string | null) {
  const rows = await prisma.familyMember.findMany({
    where: { familyId, leftAt: null }, select: { member: { select: { userId: true } } },
  })
  return Array.from(new Set(rows.map((r) => r.member.userId).filter((id): id is string => !!id && id !== exceptUserId)))
}

export async function kartaUserIdOf(familyId: string) {
  const row = await prisma.familyMember.findFirst({
    where: { familyId, isKarta: true, leftAt: null }, select: { member: { select: { userId: true } } },
  })
  return row?.member.userId ?? null
}

/**
 * The family's district, for Operator scope (F16, F18): its primary area
 * (set from its Mul Gaon at F09), else the Karta's — or any member's — Mul Gaon.
 */
export async function familyDistrict(familyId: string): Promise<string | null> {
  const area = await prisma.familyArea.findFirst({ where: { familyId, isPrimary: true }, select: { areaId: true } })
  if (area) return districtOf(area.areaId)
  const members = await prisma.familyMember.findMany({
    where: { familyId, leftAt: null }, orderBy: { isKarta: 'desc' },
    select: { member: { select: { memberAreas: { where: { isPrimary: true }, select: { areaId: true } } } } },
  })
  for (const m of members) {
    const id = m.member.memberAreas[0]?.areaId
    if (id) return districtOf(id)
  }
  return null
}

/** Operator mapped to this family's district (Roles & Access, F16 / F18), or an Admin. */
export async function operatorCoversFamily(userId: string, roles: string[], familyId: string) {
  if (roles.includes('ADMIN')) return true
  if (!roles.includes('OPERATOR')) return false
  const district = await familyDistrict(familyId)
  if (!district) return false
  const grant = await prisma.userRole.findFirst({
    where: { userId, areaId: district, role: { code: 'OPERATOR' }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
  })
  return !!grant
}

/** F16: the eldest adult, active, account-holding member — suggested as the next Karta. */
export async function eldestAdultCandidate(familyId: string, exceptMemberId?: string | null) {
  const rows = await prisma.familyMember.findMany({
    where: { familyId, leftAt: null, memberId: exceptMemberId ? { not: exceptMemberId } : undefined },
    select: { member: { select: { id: true, userId: true, status: true, dateOfBirth: true } } },
  })
  return rows.map((r) => r.member)
    .filter((m) => m.userId && m.status === 'ACTIVE' && m.dateOfBirth && ageOn(m.dateOfBirth) >= 18)
    .sort((a, b) => a.dateOfBirth!.getTime() - b.dateOfBirth!.getTime())[0] ?? null
}

/** Operators mapped to a district, District team of it, and Admins — for vacancy alerts. */
export async function districtResponders(districtId: string | null) {
  const ids = new Set<string>()
  if (districtId) {
    const rows = await prisma.userRole.findMany({
      where: { areaId: districtId, role: { code: { in: ['OPERATOR', 'DISTRICT_TEAM'] } }, user: { status: 'ACTIVE', deletedAt: null } },
      select: { userId: true },
    })
    rows.forEach((r) => ids.add(r.userId))
  }
  const admins = await prisma.user.findMany({
    where: { status: 'ACTIVE', deletedAt: null, userRoles: { some: { role: { code: 'ADMIN' } } } }, select: { id: true },
  })
  admins.forEach((a) => ids.add(a.id))
  return Array.from(ids)
}

/**
 * F12 → F16: a Karta has died. Their Karta flag and role go, the family is
 * marked KARTA_VACANT, the eldest adult is suggested, and the family, the
 * district's Operators / team and the Admins are alerted (SMS + in-app).
 */
export async function openKartaVacancy(familyId: string, deceasedMemberId: string, actorId: string) {
  const family = await prisma.family.findUnique({ where: { id: familyId }, select: { name: true } })
  if (!family) return null
  const candidate = await eldestAdultCandidate(familyId, deceasedMemberId)
  const kartaRole = await prisma.role.findUnique({ where: { code: 'KARTA' } })
  const deceased = await prisma.member.findUnique({ where: { id: deceasedMemberId }, select: { userId: true } })

  const transfer = await prisma.$transaction(async (tx) => {
    await tx.familyMember.updateMany({ where: { familyId, memberId: deceasedMemberId, isKarta: true }, data: { isKarta: false } })
    if (kartaRole && deceased?.userId) {
      await tx.userRole.deleteMany({ where: { userId: deceased.userId, roleId: kartaRole.id, familyId } })
    }
    await tx.family.update({ where: { id: familyId }, data: { status: 'KARTA_VACANT', kartaMemberId: null, updatedBy: actorId } })
    await tx.kartaTransfer.updateMany({ where: { familyId, status: 'PENDING' }, data: { status: 'CANCELLED' } })
    return tx.kartaTransfer.create({
      data: { familyId, kind: 'VACANCY', fromMemberId: deceasedMemberId, suggestedMemberId: candidate?.id ?? null, requestedBy: actorId },
    })
  })
  await recordAudit({
    actorId, action: 'family.karta.vacant', entityType: 'family', entityId: familyId,
    oldValue: { kartaMemberId: deceasedMemberId, status: 'ACTIVE' }, newValue: { kartaMemberId: null, status: 'KARTA_VACANT' },
    metadata: { transferId: transfer.id, suggestedMemberId: candidate?.id ?? null },
  })
  const recipients = new Set([...(await familyUserIds(familyId)), ...(await districtResponders(await familyDistrict(familyId)))])
  for (const userId of recipients) {
    await notifyUser({
      userId, type: 'KARTA_VACANT', title: `The ${family.name} family needs a new Karta`,
      body: 'The Karta has passed away. An Operator of the district will confirm the new Karta.',
      data: { familyId, transferId: transfer.id }, also: ['SMS'],
    })
  }
  return transfer
}

/**
 * F12 follow-up, run after a member is marked Expired (directly, or when a
 * queued request is approved): every other family's Karta is told; any family
 * the person headed becomes KARTA_VACANT (F16). The person stays in every tree
 * (shown as "Late"); login, matrimony and friend lists were handled when the
 * status was applied.
 */
export async function afterMemberExpired(memberId: string, actorId: string, actingFamilyId?: string | null) {
  // F31: an expired person's organisation posts and body seats fall vacant.
  const { onMemberExpired } = await import('@/lib/organisations')
  await onMemberExpired(memberId, actorId)
  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { firstName: true, lastName: true } })
  const memberships = await prisma.familyMember.findMany({
    where: { memberId, leftAt: null }, select: { familyId: true, isKarta: true, family: { select: { name: true } } },
  })
  const name = [member?.firstName, member?.lastName].filter(Boolean).join(' ')
  for (const m of memberships) {
    if (m.isKarta) {
      await openKartaVacancy(m.familyId, memberId, actorId)
      continue
    }
    if (m.familyId === actingFamilyId) continue
    const karta = await kartaUserIdOf(m.familyId)
    if (karta && karta !== actorId) {
      await notifyUser({
        userId: karta, type: 'MEMBER_EXPIRED', title: `${name} has passed away`,
        body: `${name}, a member of the ${m.family.name} family, has been marked as expired. They remain in the family tree as "Late".`,
        data: { memberId, familyId: m.familyId },
      })
    }
  }
}

/** F16: after a Karta change is applied (directly or by Admin review), close the open transfer. */
export async function closeKartaTransfer(familyId: string, newKartaMemberId: string, actorId: string) {
  await prisma.kartaTransfer.updateMany({
    where: { familyId, status: { in: ['PENDING', 'ACCEPTED'] }, OR: [{ toMemberId: newKartaMemberId }, { kind: 'VACANCY' }] },
    data: { status: 'CONFIRMED', toMemberId: newKartaMemberId, confirmedBy: actorId, confirmedAt: new Date() },
  })
  const family = await prisma.family.findUnique({ where: { id: familyId }, select: { name: true } })
  for (const userId of await familyUserIds(familyId)) {
    await notifyUser({
      userId, type: 'KARTA_CHANGED', title: `New Karta for the ${family?.name ?? ''} family`,
      body: 'The family has a new Karta.', data: { familyId, newKartaMemberId },
    })
  }
}

/** F15: join-request expiry window in days — Setting family.join_request_expiry_days, default 30. */
export async function joinRequestExpiryDays() {
  const s = await prisma.setting.findUnique({ where: { key: 'family.join_request_expiry_days' } })
  const n = Number(typeof s?.value === 'string' ? JSON.parse(s.value) : s?.value)
  return Number.isFinite(n) && n > 0 ? n : 30
}

export async function joinRequestExpired(createdAt: Date) {
  return Date.now() - createdAt.getTime() > (await joinRequestExpiryDays()) * 86400000
}

/** F15: mark unanswered requests past the window EXPIRED (one family, or all from cron). */
export async function expireStaleJoinRequests(familyId?: string) {
  const cutoff = new Date(Date.now() - (await joinRequestExpiryDays()) * 86400000)
  const res = await prisma.familyJoinRequest.updateMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff }, ...(familyId ? { familyId } : {}) },
    data: { status: 'EXPIRED' },
  })
  return res.count
}

/** Daily cron jobs for P2 (F15 expiry, F16 vacancy SLA). */
export async function runDailyFamilyJobs(now = new Date()) {
  const expired = await expireStaleJoinRequests()
  const { slaDays } = await import('@/lib/verification')
  const cutoff = new Date(now.getTime() - (await slaDays()) * 86400000)
  const overdue = await prisma.kartaTransfer.findMany({
    where: { kind: 'VACANCY', status: 'PENDING', slaAlertedAt: null, createdAt: { lt: cutoff } },
  })
  for (const t of overdue) {
    const district = await familyDistrict(t.familyId)
    const team = district
      ? (await prisma.userRole.findMany({ where: { areaId: district, role: { code: 'DISTRICT_TEAM' }, user: { status: 'ACTIVE' } }, select: { userId: true } })).map((r) => r.userId)
      : []
    const admins = (await prisma.user.findMany({ where: { status: 'ACTIVE', deletedAt: null, userRoles: { some: { role: { code: 'ADMIN' } } } }, select: { id: true } })).map((a) => a.id)
    const family = await prisma.family.findUnique({ where: { id: t.familyId }, select: { name: true } })
    for (const userId of new Set([...team, ...admins])) {
      await notifyUser({
        userId, type: 'KARTA_VACANT_SLA', title: `The ${family?.name ?? ''} family is still without a Karta`,
        body: 'No new Karta has been confirmed within the SLA. An Operator of the district needs to confirm one.',
        data: { familyId: t.familyId, transferId: t.id }, also: ['EMAIL'],
      })
    }
    await prisma.kartaTransfer.update({ where: { id: t.id }, data: { slaAlertedAt: now } })
  }
  return { joinRequestsExpired: expired, vacanciesEscalated: overdue.length }
}
