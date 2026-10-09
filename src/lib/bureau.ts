import { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { MATRIMONY_ELIGIBLE_STATUSES } from '@/lib/matrimony'
import { isEarning } from '@/lib/occupation'
import { legalAgeError } from '@/lib/marriage'
import { areaChain, chainLevel } from '@/lib/locations'
import { notifyUser } from '@/lib/notify'
import { ageOn } from '@/lib/validators'

/**
 * F37 / F38 marriage bureau.
 *
 * Always: legal age (18 F / 21 M); a limited profile card (no contact
 * details); contact shared only once an interest is accepted; same-Gotra
 * flag; income as a band; the Karta is told on opt-in and may answer interests.
 *
 * With Setting `bureau.workbook_rules` = true (the workbook): only Unmarried
 * AND earning members may list, and only listed members and their Karta may
 * browse and send interests. Off (default) keeps the earlier rules
 * (Unmarried / Divorced / Widowed may list; any member may browse), because
 * existing tests and users rely on them — see the P5 report.
 */
export async function workbookRules() {
  const s = await prisma.setting.findUnique({ where: { key: 'bureau.workbook_rules' } })
  const v = typeof s?.value === 'string' ? JSON.parse(s.value) : s?.value
  return v === true || v === 'true'
}

export async function bureauEligibility(memberId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const m = await prisma.member.findUnique({
    where: { id: memberId },
    select: { firstName: true, gender: true, dateOfBirth: true, status: true, maritalStatus: true, employmentStatus: true, profileDetails: { select: { annualIncomeRange: true, isEarning: true } } },
  })
  if (!m || m.status !== 'ACTIVE') return { ok: false, reason: 'Only active members can be listed.' }
  const strict = await workbookRules()
  const age = legalAgeError({ firstName: m.firstName, gender: m.gender, dateOfBirth: m.dateOfBirth }, new Date())
  if (age) return { ok: false, reason: age }
  if (strict) {
    if (!m.dateOfBirth) return { ok: false, reason: 'Add your date of birth first.' }
    if (m.maritalStatus !== 'UNMARRIED') return { ok: false, reason: 'Only unmarried members can register for the marriage bureau.' }
    const earning = isEarning(m.employmentStatus, m.profileDetails?.annualIncomeRange) || m.profileDetails?.isEarning === true
    if (!earning) return { ok: false, reason: 'The marriage bureau is for members who are earning (set your social status and income band).' }
  } else if (!MATRIMONY_ELIGIBLE_STATUSES.includes(m.maritalStatus)) {
    return { ok: false, reason: m.maritalStatus === 'MARRIED' ? 'A married member cannot be listed in matrimony.' : 'This marital status is not eligible for matrimony listings.' }
  }
  return { ok: true }
}

/** Families this person belongs to, and their Kartas' member ids. */
async function kartasOf(memberId: string) {
  const fams = await prisma.familyMember.findMany({ where: { memberId, leftAt: null }, select: { familyId: true } })
  const kartas = await prisma.familyMember.findMany({ where: { familyId: { in: fams.map((f) => f.familyId) }, isKarta: true, leftAt: null }, select: { memberId: true, member: { select: { userId: true, firstName: true, lastName: true, mobilePrimary: true, email: true } } } })
  return kartas.filter((k) => k.memberId !== memberId)
}

/** Is the viewer a Karta of a family `memberId` belongs to? */
export async function isKartaOf(viewerMemberId: string | null, memberId: string) {
  if (!viewerMemberId) return false
  return (await kartasOf(memberId)).some((k) => k.memberId === viewerMemberId)
}

/** Members the viewer may act for in the bureau: themselves, and (as Karta) their families' listed members. */
export async function actingFor(viewerMemberId: string | null) {
  if (!viewerMemberId) return []
  const fams = await prisma.familyMember.findMany({ where: { memberId: viewerMemberId, isKarta: true, leftAt: null }, select: { familyId: true } })
  const members = await prisma.familyMember.findMany({ where: { familyId: { in: fams.map((f) => f.familyId) }, leftAt: null }, select: { memberId: true } })
  return Array.from(new Set([viewerMemberId, ...members.map((m) => m.memberId)]))
}

/** F38: who may browse. Workbook rule: listed members and their Kartas (Admins always). */
export async function canBrowse(session: Session | null) {
  if (!session?.user?.id) return false
  if (!(await workbookRules())) return true
  if (((session.user as any).roles ?? []).includes('ADMIN')) return true
  const ids = await actingFor((session.user as any).memberId ?? null)
  const listed = await prisma.matrimonialProfile.findMany({ where: { memberId: { in: ids }, isVisible: true }, select: { memberId: true } })
  for (const l of listed) if ((await bureauEligibility(l.memberId)).ok) return true
  return false
}

/** F37 step 3: the Kartas of the person's families are told when they list. */
export async function tellKartasOfListing(memberId: string, actorUserId: string) {
  const m = await prisma.member.findUnique({ where: { id: memberId }, select: { firstName: true, lastName: true } })
  for (const k of await kartasOf(memberId)) {
    if (k.member.userId && k.member.userId !== actorUserId) {
      await notifyUser({ userId: k.member.userId, type: 'BUREAU_LISTED', title: `${[m?.firstName, m?.lastName].filter(Boolean).join(' ')} joined the marriage bureau`, body: 'You can see and answer interests for them.', data: { memberId } })
    }
  }
}

async function gotraOf(memberId: string | null) {
  if (!memberId) return null
  const f = await prisma.familyMember.findFirst({ where: { memberId, leftAt: null, family: { gotra: { not: null } } }, select: { family: { select: { gotra: true } } } })
  return f?.family.gotra?.trim().toLowerCase() || null
}

/** F38 limited profile: no contact details; income as a band; same-Gotra flagged. */
export async function profileCards(profileIds: string[], viewerMemberId: string | null) {
  const rows = await prisma.matrimonialProfile.findMany({
    where: { id: { in: profileIds } },
    select: {
      id: true, memberId: true, about: true, heightCm: true, languages: true, expectations: true, horoscope: true,
      member: {
        select: {
          firstName: true, lastName: true, gender: true, dateOfBirth: true, maritalStatus: true, employmentStatus: true, occupationCategory: true,
          education: { where: { isHighest: true }, take: 1, select: { level: true, qualification: true } },
          profileDetails: { select: { annualIncomeRange: true } },
          memberAreas: { where: { isPrimary: true }, select: { areaId: true } },
          families: { where: { leftAt: null }, take: 1, select: { family: { select: { gotra: true } } } },
        },
      },
    },
  })
  const myGotra = await gotraOf(viewerMemberId)
  const out: any[] = []
  for (const p of rows) {
    const m = p.member
    const chain = m.memberAreas[0] ? await areaChain(m.memberAreas[0].areaId) : []
    const gotra = m.families[0]?.family.gotra ?? null
    out.push({
      id: p.id, memberId: p.memberId,
      name: `${m.firstName} ${m.lastName ? `${m.lastName[0]}.` : ''}`.trim(),
      gender: m.gender, age: m.dateOfBirth ? ageOn(m.dateOfBirth) : null, maritalStatus: m.maritalStatus,
      heightCm: p.heightCm, about: p.about, expectations: p.expectations, horoscope: p.horoscope ?? null, languages: p.languages,
      education: m.education[0] ?? null, occupation: m.occupationCategory ?? m.employmentStatus ?? null,
      incomeBand: m.profileDetails?.annualIncomeRange ?? null,
      mulGaon: chain[0]?.name ?? null, district: chainLevel(chain, 'DISTRICT')?.name ?? null, gotra,
      sameGotra: !!myGotra && !!gotra && gotra.trim().toLowerCase() === myGotra,
    })
  }
  return profileIds.map((id) => out.find((o) => o.id === id)).filter(Boolean)
}

/** F38: contact shared on mutual acceptance, per the person's contact preference. */
export async function contactFor(memberId: string) {
  const [profile, m] = await Promise.all([
    prisma.matrimonialProfile.findUnique({ where: { memberId }, select: { contactPreference: true } }),
    prisma.member.findUnique({ where: { id: memberId }, select: { firstName: true, lastName: true, mobilePrimary: true, email: true, user: { select: { mobile: true, email: true } } } }),
  ])
  const pref = profile?.contactPreference ?? 'SELF'
  const self = { name: [m?.firstName, m?.lastName].filter(Boolean).join(' '), mobile: m?.user?.mobile ?? m?.mobilePrimary ?? null, email: m?.user?.email ?? m?.email ?? null }
  const karta = (await kartasOf(memberId))[0]?.member
  const kartaContact = karta ? { name: [karta.firstName, karta.lastName].filter(Boolean).join(' '), mobile: karta.mobilePrimary, email: karta.email } : null
  return { preference: pref, person: pref === 'KARTA' && kartaContact ? null : self, karta: pref === 'SELF' ? null : kartaContact }
}
