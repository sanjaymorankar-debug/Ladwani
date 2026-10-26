import { Prisma } from '@prisma/client'
import { generateMemberNumber } from '@/lib/utils'

/**
 * Shared pieces of the tree builder (F19 ancestors, F20 spouse side,
 * F21 siblings): a non-login person record with a full date or just a birth
 * year, alive or expired.
 */
export interface PersonInput {
  firstName?: string
  lastName?: string | null
  gender?: string
  dateOfBirth?: string | null
  birthYear?: number | string | null
  alive?: boolean
  deceasedAt?: string | null
  maritalStatus?: string | null
}

export interface ParsedPerson {
  firstName: string
  lastName: string | null
  gender: 'MALE' | 'FEMALE' | 'OTHER'
  dateOfBirth: Date | null
  approx: boolean
  deceased: boolean
  deceasedAt: Date | null
  maritalStatus: string | null
}

const MARITAL = ['UNMARRIED', 'MARRIED', 'WIDOWED', 'DIVORCED', 'SEPARATED', 'NOT_STATED']

/** Validates one person; returns an error message or the parsed values. */
export function parsePerson(p: PersonInput | undefined, label: string, gender?: 'MALE' | 'FEMALE'): ParsedPerson | string {
  if (!p) return `Enter the ${label}`
  const firstName = String(p.firstName ?? '').trim()
  if (!firstName) return `Enter the ${label}'s name`
  const g = gender ?? p.gender
  if (g !== 'MALE' && g !== 'FEMALE' && g !== 'OTHER') return `Select the ${label}'s gender`
  let dateOfBirth: Date | null = null
  let approx = false
  if (p.dateOfBirth) {
    dateOfBirth = new Date(p.dateOfBirth)
    if (Number.isNaN(dateOfBirth.getTime())) return `The ${label}'s date of birth is not valid`
  } else if (p.birthYear) {
    const y = Number(p.birthYear)
    if (!Number.isInteger(y) || y < 1800 || y > new Date().getFullYear()) return `The ${label}'s birth year is not valid`
    dateOfBirth = new Date(Date.UTC(y, 0, 1))
    approx = true
  }
  if (dateOfBirth && dateOfBirth > new Date()) return `The ${label}'s date of birth cannot be in the future`
  const deceased = p.alive === false
  let deceasedAt: Date | null = null
  if (deceased && p.deceasedAt) {
    deceasedAt = new Date(p.deceasedAt)
    if (Number.isNaN(deceasedAt.getTime()) || deceasedAt > new Date()) return `The ${label}'s date of death is not valid`
    if (dateOfBirth && deceasedAt < dateOfBirth) return `The ${label}'s date of death cannot be before the date of birth`
  }
  const maritalStatus = p.maritalStatus && MARITAL.includes(p.maritalStatus) ? p.maritalStatus : null
  return { firstName, lastName: p.lastName ? String(p.lastName).trim() || null : null, gender: g, dateOfBirth, approx, deceased, deceasedAt, maritalStatus }
}

export async function createPerson(tx: Prisma.TransactionClient, p: ParsedPerson, actorId: string, maritalStatus?: string) {
  return tx.member.create({
    data: {
      memberNumber: generateMemberNumber(),
      firstName: p.firstName, lastName: p.lastName, gender: p.gender,
      dateOfBirth: p.dateOfBirth, dateOfBirthApprox: p.approx,
      maritalStatus: (maritalStatus ?? p.maritalStatus ?? 'NOT_STATED') as any,
      status: p.deceased ? 'DECEASED' : 'ACTIVE', deceasedAt: p.deceasedAt,
      createdBy: actorId,
    },
  })
}

/** Adds a person to the family, or re-activates an earlier membership. */
export async function addMembership(tx: Prisma.TransactionClient, familyId: string, memberId: string, role: string, relativeTo: string, actorId: string) {
  const previous = await tx.familyMember.findUnique({ where: { familyId_memberId: { familyId, memberId } } })
  const data = { joinedBy: actorId, joinedAt: new Date(), leftAt: null, leftReason: null, status: 'ACTIVE', relationshipRole: role, relativeToMemberId: relativeTo }
  if (previous) return tx.familyMember.update({ where: { id: previous.id }, data })
  return tx.familyMember.create({ data: { familyId, memberId, ...data } })
}
