import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { p3Fixtures } from './fixtures'
import type { Person } from '../p2/fixtures'

/**
 * P3 data fix (owner's decision): relationship rows whose type does not fit
 * the person's gender — left by the old single-inverse rule — are corrected
 * by database/data-fixes/fix_relationship_gender_*.sql, with a backup table
 * and an exact rollback.
 */
const fx = p3Fixtures('p3g')
let woman: Person, man: Person, child: Person

function statements(file: string) {
  const sql = fs.readFileSync(path.join(__dirname, '../../database/data-fixes', file), 'utf8')
  return sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean)
}
async function run(file: string) {
  for (const s of statements(file)) {
    if (/^select/i.test(s)) await prisma.$queryRawUnsafe(s)
    else await prisma.$executeRawUnsafe(s)
  }
}
const typeId = async (code: string) => (await prisma.relationshipType.findUniqueOrThrow({ where: { code } })).id
const row = (fromMemberId: string, code: string) => prisma.memberRelationship.findFirst({ where: { fromMemberId, toMemberId: child.memberId, relationshipType: { code } } })
const backupExists = async () => ((await prisma.$queryRawUnsafe(`SHOW TABLES LIKE 'zz_fix_relationship_gender_backup'`)) as unknown[]).length > 0

beforeAll(async () => {
  woman = await fx.profile('woman', { gender: 'FEMALE' })
  man = await fx.profile('man', { gender: 'MALE' })
  child = await fx.profile('child', { gender: 'MALE' })
  const add = async (from: Person, code: string) => prisma.memberRelationship.create({ data: { fromMemberId: from.memberId, toMemberId: child.memberId, relationshipTypeId: await typeId(code) } })
  await add(woman, 'father') // the old bug: a mother stored as "father"
  await add(man, 'son') // correct …
  await add(man, 'daughter') // … and a wrong twin of it
  await add(woman, 'fathers_elder_brother') // no female counterpart: left for a person
})
afterAll(async () => {
  if (await backupExists()) await run('fix_relationship_gender_rollback.sql')
  await fx.cleanup()
})

describe('F21 Correct existing relationship rows with the wrong gender (P3 data fix)', () => {
  it('F21 preview lists the rows and changes nothing', async () => {
    await run('fix_relationship_gender_preview.sql')
    expect(await row(woman.memberId, 'father')).toBeTruthy()
    expect(await backupExists()).toBe(false)
  })

  it('F21 apply retypes a wrong row, switches off a wrong twin, leaves rows without a counterpart, and is safe to run twice', async () => {
    const original = await row(woman.memberId, 'father')
    await run('fix_relationship_gender_apply.sql')
    await run('fix_relationship_gender_apply.sql')
    expect(await row(woman.memberId, 'father')).toBeNull()
    expect((await row(woman.memberId, 'mother'))?.id).toBe(original!.id) // same row, new type
    expect(await row(man.memberId, 'son')).toMatchObject({ isActive: true })
    expect(await row(man.memberId, 'daughter')).toMatchObject({ isActive: false }) // kept, not deleted
    expect(await row(woman.memberId, 'fathers_elder_brother')).toMatchObject({ isActive: true })
    const backup = (await prisma.$queryRawUnsafe(`SELECT relationshipId, action FROM zz_fix_relationship_gender_backup WHERE fromMemberId IN (?, ?)`, woman.memberId, man.memberId)) as { action: string }[]
    expect(backup.map((b) => b.action).sort()).toEqual(['DEACTIVATE', 'RETYPE'])
  })

  it('F21 rollback puts every row back exactly and drops the backup table', async () => {
    await run('fix_relationship_gender_rollback.sql')
    expect(await row(woman.memberId, 'father')).toBeTruthy()
    expect(await row(woman.memberId, 'mother')).toBeNull()
    expect(await row(man.memberId, 'daughter')).toMatchObject({ isActive: true })
    expect(await backupExists()).toBe(false)
  })
})
