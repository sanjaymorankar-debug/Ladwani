import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type Db = Prisma.TransactionClient | typeof prisma

/**
 * Gendered counterparts in the relationship master. The master stores one
 * inverseCode per type ("mother" → "son"), which is wrong for a daughter;
 * this table picks the right one for the person the inverse describes.
 */
const PAIRS: [string, string][] = [
  ['father', 'mother'], ['son', 'daughter'], ['brother', 'sister'], ['husband', 'wife'],
  ['grandfather_p', 'grandmother_p'], ['grandfather_m', 'grandmother_m'],
  ['great_grandfather_p', 'great_grandmother_p'], ['great_grandfather_m', 'great_grandmother_m'],
  ['grandson', 'granddaughter'], ['grandson_sons_son', 'granddaughter_sons_daughter'],
  ['grandson_daughters_son', 'granddaughter_daughters_daughter'],
  ['uncle', 'aunt'], ['nephew', 'niece'], ['nephew_brothers', 'niece_brothers'], ['nephew_sisters', 'niece_sisters'],
  ['father_in_law', 'mother_in_law'], ['son_in_law', 'daughter_in_law'],
  ['husbands_brother', 'husbands_sister'], ['wifes_brother', 'wifes_sister'],
]
const MALE_OF: Record<string, string> = {}
const FEMALE_OF: Record<string, string> = {}
for (const [m, f] of PAIRS) { MALE_OF[m] = m; MALE_OF[f] = m; FEMALE_OF[m] = f; FEMALE_OF[f] = f }

/** The variant of `code` that fits a person of `gender` (unchanged when unknown or ungendered). */
export function genderedCode(code: string, gender: string | null | undefined) {
  if (gender === 'MALE') return MALE_OF[code] ?? code
  if (gender === 'FEMALE') return FEMALE_OF[code] ?? code
  return code
}

/** Codes that mean "from is the parent of to". */
export const PARENT_CODES = ['father', 'mother']
/** Codes that mean "from is the child of to". */
export const CHILD_CODES = ['son', 'daughter']

/**
 * Writes `from` is <code> of `to`, and the inverse (`to` is <inverse> of
 * `from`) with the inverse picked for `to`'s gender. Idempotent; reactivates
 * an inactive row.
 */
export async function linkPeople(db: Db, fromId: string, toId: string, code: string, actorId: string | null, familyId?: string | null) {
  const [from, to] = await Promise.all([
    db.member.findUnique({ where: { id: fromId }, select: { gender: true } }),
    db.member.findUnique({ where: { id: toId }, select: { gender: true } }),
  ])
  const type = await db.relationshipType.findUnique({ where: { code: genderedCode(code, from?.gender) } })
  if (!type) return
  await upsertRow(db, fromId, toId, type.id, actorId, familyId)
  if (type.inverseCode) {
    const inverse = await db.relationshipType.findUnique({ where: { code: genderedCode(type.inverseCode, to?.gender) } })
    if (inverse) await upsertRow(db, toId, fromId, inverse.id, actorId, familyId)
  }
}

async function upsertRow(db: Db, fromMemberId: string, toMemberId: string, relationshipTypeId: string, createdBy: string | null, familyId?: string | null) {
  await db.memberRelationship.upsert({
    where: { fromMemberId_toMemberId_relationshipTypeId: { fromMemberId, toMemberId, relationshipTypeId } },
    update: { isActive: true, ...(familyId ? { familyId } : {}) },
    create: { fromMemberId, toMemberId, relationshipTypeId, familyId: familyId ?? null, createdBy },
  })
}

/** Recorded parents of a person (from either direction of the parent/child rows). */
export async function parentsOf(memberId: string, db: Db = prisma) {
  const rows = await db.memberRelationship.findMany({
    where: {
      isActive: true,
      OR: [
        { toMemberId: memberId, relationshipType: { code: { in: PARENT_CODES } } },
        { fromMemberId: memberId, relationshipType: { code: { in: CHILD_CODES } } },
      ],
    },
    select: { fromMemberId: true, toMemberId: true, fromMember: { select: { id: true, gender: true } }, toMember: { select: { id: true, gender: true } } },
  })
  const parents = new Map<string, { id: string; gender: string }>()
  for (const r of rows) {
    const p = r.toMemberId === memberId ? r.fromMember : r.toMember
    parents.set(p.id, p as any)
  }
  const list = Array.from(parents.values())
  return { father: list.find((p) => p.gender === 'MALE') ?? null, mother: list.find((p) => p.gender === 'FEMALE') ?? null, all: list }
}

/** True when two people have a recorded blood (BIRTH) link — used to refuse impossible parent pairs. */
export async function bloodRelated(a: string, b: string, db: Db = prisma) {
  const row = await db.memberRelationship.findFirst({
    where: {
      isActive: true,
      OR: [{ fromMemberId: a, toMemberId: b }, { fromMemberId: b, toMemberId: a }],
      // Anything but a marriage link (older master rows have no linkType).
      relationshipType: { isSpouse: false, OR: [{ linkType: null }, { linkType: { not: 'MARRIAGE' } }] },
    },
    select: { id: true },
  })
  return !!row
}
