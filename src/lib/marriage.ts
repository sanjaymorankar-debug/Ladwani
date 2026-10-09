import { prisma } from '@/lib/prisma'
import { ageOn } from '@/lib/validators'
import { notifyUser } from '@/lib/notify'
import { kartaUserIdOf } from '@/lib/family-rules'
import { parentsOf } from '@/lib/relations'

/** F23 legal age: 18 for a woman, 21 for a man, on the marriage date. */
export const LEGAL_AGE = { FEMALE: 18, MALE: 21 } as const

export function legalAgeError(p: { firstName: string; gender: string | null; dateOfBirth: Date | null }, on: Date) {
  const min = p.gender === 'FEMALE' ? LEGAL_AGE.FEMALE : p.gender === 'MALE' ? LEGAL_AGE.MALE : null
  if (!min || !p.dateOfBirth) return null
  return ageOn(p.dateOfBirth, on) < min ? `${p.firstName} is under the legal age for marriage (${min})` : null
}

/**
 * F23 — after a marriage is recorded: for each partner, a request is created
 * to the Karta of every family the *other* partner belongs to, to add them as
 * daughter-in-law / son-in-law (or wife / husband when the spouse has no
 * parent in that family). Nobody leaves their birth family. The Kartas of
 * the partner's own families are told. The person hears the result when the
 * Karta decides (join-request flow).
 */
export async function afterMarriage(aId: string, bId: string, actorId: string) {
  const people = await prisma.member.findMany({ where: { id: { in: [aId, bId] } }, select: { id: true, firstName: true, lastName: true, gender: true } })
  const name = (id: string) => { const p = people.find((x) => x.id === id); return [p?.firstName, p?.lastName].filter(Boolean).join(' ') }
  const created: string[] = []
  for (const [x, y] of [[aId, bId], [bId, aId]]) {
    const person = people.find((p) => p.id === x)
    if (!person) continue
    const xFamilies = new Set((await prisma.familyMember.findMany({ where: { memberId: x, leftAt: null }, select: { familyId: true } })).map((f) => f.familyId))
    const yFamilies = await prisma.familyMember.findMany({ where: { memberId: y, leftAt: null }, select: { familyId: true, family: { select: { name: true } } } })
    const yParents = await parentsOf(y)
    for (const fam of yFamilies) {
      if (xFamilies.has(fam.familyId)) continue
      const open = await prisma.familyJoinRequest.findFirst({ where: { familyId: fam.familyId, memberId: x, status: 'PENDING' } })
      if (open) continue
      const parentHere = yParents.father ?? yParents.mother
      const inFamily = parentHere && await prisma.familyMember.findFirst({ where: { familyId: fam.familyId, memberId: parentHere.id, leftAt: null } })
      const role = inFamily
        ? (person.gender === 'FEMALE' ? 'daughter_in_law' : 'son_in_law')
        : (person.gender === 'FEMALE' ? 'wife' : 'husband')
      const reqRow = await prisma.familyJoinRequest.create({
        data: {
          familyId: fam.familyId, memberId: x, direction: 'MEMBER_REQUEST', origin: 'MARRIAGE',
          relationshipTypeCode: role, relatedToMemberId: inFamily ? parentHere!.id : y,
          requestedBy: actorId, responseNote: null,
        },
      })
      created.push(reqRow.id)
      const karta = await kartaUserIdOf(fam.familyId)
      if (karta) {
        await notifyUser({
          userId: karta, type: 'MARRIAGE_FAMILY_REQUEST', title: `Add ${name(x)} to the ${fam.family.name} family?`,
          body: `${name(x)} has married ${name(y)}. Accept to add them to your family; they stay in their birth family too.`,
          data: { familyId: fam.familyId, joinRequestId: reqRow.id },
        })
      }
    }
    // The person's own (birth) family Kartas are told.
    for (const familyId of Array.from(xFamilies)) {
      const karta = await kartaUserIdOf(familyId)
      if (karta && karta !== actorId) {
        await notifyUser({
          userId: karta, type: 'MARRIAGE_RECORDED', title: `${name(x)} is married`,
          body: `${name(x)} has married ${name(y)}. ${name(x)} stays in your family.`, data: { familyId, memberId: x },
        })
      }
    }
  }
  return created
}
