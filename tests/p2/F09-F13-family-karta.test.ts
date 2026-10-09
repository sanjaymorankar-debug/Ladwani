import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue({ messageId: 'test' }) }))

import { prisma } from '@/lib/prisma'
import { p2Fixtures, actAs, json, type Person } from './fixtures'
import { POST as createFamily, GET as searchFamilies } from '@/app/api/families/route'
import { POST as addMember } from '@/app/api/families/[id]/members/route'
import { DELETE as removeMember } from '@/app/api/families/[id]/members/[memberId]/route'
import { POST as markDeceased } from '@/app/api/members/[id]/deceased/route'
import { POST as addNewborn } from '@/app/api/families/[id]/newborn/route'
import { POST as joinRequest } from '@/app/api/families/[id]/join-requests/route'

const fx = p2Fixtures('p2fam')
let geo: Awaited<ReturnType<typeof fx.geography>>
let admin: Person

beforeAll(async () => {
  geo = await fx.geography()
  admin = await fx.person('admin', { roles: [{ code: 'ADMIN' }] })
})
afterAll(() => fx.cleanup())

const create = (p: Person, body: Record<string, unknown>) => { actAs(p); return createFamily(json('http://x/api/families', 'POST', body) as any) }

describe('F09 Create family and become Karta', () => {
  it('F09 creator becomes Karta; Mul Gaon comes from the location master; the membership records the role', async () => {
    const k = await fx.adult('k1')
    const res = await create(k, { name: 'Bhosale', surname: 'Bhosale', gotra: 'Kashyap', kuladevata: 'Khandoba', mulGaonAreaId: geo.village })
    expect(res.status).toBe(201)
    const { familyId } = await res.json()
    fx.familyIds.push(familyId)
    const fam = await prisma.family.findUniqueOrThrow({ where: { id: familyId } })
    expect(fam).toMatchObject({ kartaMemberId: k.memberId, gotra: 'Kashyap', kuladevata: 'Khandoba', nativeVillage: 'p2fam Village', nativeDistrict: 'p2fam District' })
    expect(fam.registrationNumber).toMatch(/^FAM-/)
    expect(await prisma.familyMember.findFirst({ where: { familyId, memberId: k.memberId } })).toMatchObject({ isKarta: true, relationshipRole: 'karta', status: 'ACTIVE' })
    expect(await prisma.familyArea.findFirst({ where: { familyId, isPrimary: true } })).toMatchObject({ areaId: geo.village })
  })

  it('F09 a person can be Karta of only one family…', async () => {
    const k = await fx.adult('k2')
    await fx.family('First', k)
    expect((await create(k, { name: 'Second' })).status).toBe(409)
  })

  it('F09 …but a member of another family may create their own (rule 1)', async () => {
    const k = await fx.adult('k3')
    const son = await fx.adult('son3')
    await fx.family('Parents', k, [{ p: son, role: 'son' }])
    const res = await create(son, { name: 'Sons' })
    expect(res.status).toBe(201)
    fx.familyIds.push((await res.json()).familyId)
    expect(await prisma.familyMember.count({ where: { memberId: son.memberId, leftAt: null } })).toBe(2)
  })

  it('F09 same surname + Mul Gaon + Gotra is flagged as a possible duplicate; the user can confirm', async () => {
    const k = await fx.adult('k4')
    const other = await fx.adult('k4b')
    await fx.family('Pawar', k, [], { gotra: 'Bharadwaj', nativeVillage: 'p2fam Village' })
    const dup = await create(other, { name: 'Pawar', surname: 'Pawar', gotra: 'Bharadwaj', mulGaonAreaId: geo.village })
    expect(dup.status).toBe(409)
    expect((await dup.json()).possibleDuplicates).toHaveLength(1)
    const ok = await create(other, { name: 'Pawar', surname: 'Pawar', gotra: 'Bharadwaj', mulGaonAreaId: geo.village, confirmNotDuplicate: true })
    expect(ok.status).toBe(201)
    fx.familyIds.push((await ok.json()).familyId)
  })

  it('F09 rule 2: the database refuses a second active Karta in a family', async () => {
    const k = await fx.adult('k5')
    const m = await fx.adult('m5')
    const famId = await fx.family('Rule2', k, [{ p: m, role: 'brother' }])
    await expect(prisma.familyMember.update({
      where: { familyId_memberId: { familyId: famId, memberId: m.memberId } }, data: { isKarta: true },
    })).rejects.toMatchObject({ code: 'P2002' })
  })
})

describe('F10 Karta adds a member', () => {
  let k: Person, famId: string
  beforeAll(async () => { k = await fx.adult('k10'); famId = await fx.family('Add', k) })
  const add = (body: Record<string, unknown>) => { actAs(k); return addMember(json('http://x', 'POST', body), { params: { id: famId } }) }

  it('F10 gender and relationship must agree — "Daughter" needs Female', async () => {
    const res = await add({ firstName: 'Mismatch', gender: 'MALE', relationshipTypeCode: 'daughter', relatedToMemberId: k.memberId, forceCreate: true })
    expect(res.status).toBe(400)
    expect((await res.json()).message).toMatch(/female relationship/)
  })

  it('F10 a new non-login profile joins with its role and relative-to recorded on the membership', async () => {
    const res = await add({ firstName: 'Asha', lastName: 'Add', gender: 'FEMALE', dateOfBirth: '2005-02-02', relationshipTypeCode: 'daughter', relatedToMemberId: k.memberId })
    expect(res.status).toBe(201)
    const { memberId } = await res.json()
    expect(await prisma.familyMember.findFirst({ where: { familyId: famId, memberId } })).toMatchObject({ relationshipRole: 'daughter', relativeToMemberId: k.memberId, status: 'ACTIVE' })
    expect((await prisma.member.findUniqueOrThrow({ where: { id: memberId } })).userId).toBeNull()
  })

  it('F10 duplicate check on name + date of birth, and on name + father\'s name', async () => {
    const byDob = await add({ firstName: 'Asha', lastName: 'Add', gender: 'FEMALE', dateOfBirth: '2005-02-02', relationshipTypeCode: 'daughter', relatedToMemberId: k.memberId })
    expect(byDob.status).toBe(409)
    const kartaName = (await prisma.member.findUniqueOrThrow({ where: { id: k.memberId } })).firstName
    const byFather = await add({ firstName: 'Asha', gender: 'FEMALE', fatherName: kartaName, relationshipTypeCode: 'daughter', relatedToMemberId: k.memberId })
    expect(byFather.status).toBe(409)
  })

  it('F10 an existing account holder is invited, even if they belong to another family (rule 1)', async () => {
    const elsewhere = await fx.adult('else10', { gender: 'FEMALE' })
    const otherK = await fx.adult('ok10')
    await fx.family('Elsewhere', otherK, [{ p: elsewhere, role: 'daughter' }])
    actAs(k)
    const res = await joinRequest(json('http://x', 'POST', { direction: 'KARTA_INVITE', memberId: elsewhere.memberId, relationshipTypeCode: 'daughter_in_law', relatedToMemberId: k.memberId }), { params: { id: famId } })
    expect(res.status).toBe(201)
  })
})

describe('F11 Karta removes a member', () => {
  let k: Person, m: Person, famId: string, otherFam: string
  beforeAll(async () => {
    k = await fx.adult('k11')
    m = await fx.adult('m11')
    famId = await fx.family('Remove', k, [{ p: m, role: 'brother' }])
    otherFam = await fx.family('Keep', await fx.adult('k11b'), [{ p: m, role: 'son_in_law' }])
  })
  const remove = (who: Person, memberId: string, reason?: string) => { actAs(who); return removeMember(json('http://x', 'DELETE', { reason }), { params: { id: famId, memberId } }) }

  it('F11 only the Karta removes, a reason is required, and the Karta cannot remove themself', async () => {
    expect((await remove(m, k.memberId, 'DUPLICATE')).status).toBe(403)
    expect((await remove(k, m.memberId)).status).toBe(400)
    expect((await remove(k, k.memberId, 'MOVED_OUT')).status).toBe(409)
  })

  it('F11 removal ends only this membership; the person and their other family stay; history kept; member told', async () => {
    expect((await remove(k, m.memberId, 'MOVED_OUT')).status).toBe(200)
    const row = await prisma.familyMember.findFirstOrThrow({ where: { familyId: famId, memberId: m.memberId } })
    expect(row).toMatchObject({ status: 'REMOVED', leftReason: 'MOVED_OUT' })
    expect(row.leftAt).not.toBeNull()
    expect(await prisma.familyMember.findFirst({ where: { familyId: otherFam, memberId: m.memberId, leftAt: null } })).not.toBeNull()
    expect(await prisma.member.findUnique({ where: { id: m.memberId } })).not.toBeNull()
    expect(await prisma.auditLog.count({ where: { action: 'family.member.remove', entityId: row.id } })).toBe(1)
    expect(await prisma.notification.count({ where: { recipientId: m.userId, type: 'FAMILY_MEMBERSHIP' } })).toBe(1)
  })
})

describe('F12 Mark member as Expired', () => {
  it('F12 date of death cannot be in the future or before the date of birth', async () => {
    const k = await fx.adult('k12a')
    const old = await fx.profile('old12a', { dob: '1950-01-01' })
    const famId = await fx.family('Dates', k, [{ p: old, role: 'father' }])
    actAs(k)
    const future = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    expect((await markDeceased(json('http://x', 'POST', { deceasedAt: future }), { params: { id: old.memberId } })).status).toBe(400)
    expect((await markDeceased(json('http://x', 'POST', { deceasedAt: '1949-12-31' }), { params: { id: old.memberId } })).status).toBe(400)
    expect(famId).toBeTruthy()
  })

  it('F12 a Karta can mark any member of the family — including one with their own login', async () => {
    const k = await fx.adult('k12b')
    const grown = await fx.adult('grown12b')
    await fx.family('Login', k, [{ p: grown, role: 'brother' }])
    actAs(k)
    // Queued for review (existing §28 rule), not refused.
    expect((await markDeceased(json('http://x', 'POST', { deceasedAt: '2024-05-01' }), { params: { id: grown.memberId } })).status).toBe(202)
  })

  it('F12 → F16: when a Karta dies, login stops, their family becomes KARTA_VACANT with the eldest adult suggested, other Kartas are told', async () => {
    const k = await fx.adult('k12c', { dob: '1955-01-01' })
    const elder = await fx.adult('elder12c', { dob: '1975-01-01' })
    const younger = await fx.adult('young12c', { dob: '1985-01-01' })
    const child = await fx.profile('child12c', { dob: '2015-01-01' })
    const famId = await fx.family('Vacant', k, [{ p: elder, role: 'son' }, { p: younger, role: 'son' }, { p: child, role: 'grandson_sons_son' }], { villageId: geo.village })
    const inLawK = await fx.adult('inlaw12c')
    await fx.family('InLaws', inLawK, [{ p: k, role: 'son_in_law' }])

    actAs(admin)
    expect((await markDeceased(json('http://x', 'POST', { deceasedAt: '2026-09-01' }), { params: { id: k.memberId } })).status).toBe(200)

    expect((await prisma.user.findUniqueOrThrow({ where: { id: k.userId } })).status).toBe('DEACTIVATED')
    const fam = await prisma.family.findUniqueOrThrow({ where: { id: famId } })
    expect(fam.status).toBe('KARTA_VACANT')
    expect(fam.kartaMemberId).toBeNull()
    const transfer = await prisma.kartaTransfer.findFirstOrThrow({ where: { familyId: famId, kind: 'VACANCY' } })
    expect(transfer.suggestedMemberId).toBe(elder.memberId)
    expect(await prisma.notification.count({ where: { recipientId: inLawK.userId, type: 'MEMBER_EXPIRED' } })).toBe(1)
    expect(await prisma.notification.count({ where: { recipientId: elder.userId, type: 'KARTA_VACANT' } })).toBe(1)
    // Still in both trees (shown as "Late").
    expect(await prisma.familyMember.count({ where: { memberId: k.memberId, leftAt: null } })).toBe(2)
  })
})

describe('F13 Add new-born baby', () => {
  let k: Person, wife: Person, famId: string
  beforeAll(async () => {
    k = await fx.adult('k13', { dob: '1990-01-01' })
    wife = await fx.adult('w13', { gender: 'FEMALE', dob: '1992-01-01' })
    famId = await fx.family('Baby', k, [{ p: wife, role: 'wife' }])
  })
  const born = (who: Person, body: Record<string, unknown>) => { actAs(who); return addNewborn(json('http://x', 'POST', body), { params: { id: famId } }) }

  it('F13 the baby is linked to both parents, has no login, may be named "Baby of <mother>", and family members are told', async () => {
    const res = await born(k, { fatherId: k.memberId, motherId: wife.memberId, gender: 'FEMALE', dateOfBirth: '2026-09-20' })
    expect(res.status).toBe(201)
    const { memberId, name } = await res.json()
    expect(name).toBe('Baby of w13')
    const baby = await prisma.member.findUniqueOrThrow({ where: { id: memberId } })
    expect(baby.userId).toBeNull()
    const links = await prisma.memberRelationship.findMany({ where: { fromMemberId: memberId }, include: { relationshipType: true } })
    expect(links.map((l) => [l.toMemberId, l.relationshipType.code]).sort()).toEqual([[k.memberId, 'daughter'], [wife.memberId, 'daughter']].sort())
    expect(await prisma.familyMember.findFirst({ where: { familyId: famId, memberId } })).toMatchObject({ relationshipRole: 'daughter', relativeToMemberId: k.memberId })
    expect(await prisma.consentRecord.count({ where: { userId: k.userId, consentType: 'MINOR_DATA_PARENTAL' } })).toBe(1) // OP-07
    expect(await prisma.notification.count({ where: { recipientId: wife.userId, type: 'NEW_BORN' } })).toBe(1)
    expect(await prisma.idProof.count({ where: { memberId } })).toBe(0)
  })

  it('F13 parents must be in the family, of the right gender, and older than the baby; only the Karta adds', async () => {
    const stranger = await fx.adult('s13', { gender: 'FEMALE' })
    expect((await born(k, { fatherId: k.memberId, motherId: stranger.memberId, gender: 'MALE', dateOfBirth: '2026-09-20' })).status).toBe(400)
    expect((await born(k, { fatherId: wife.memberId, motherId: k.memberId, gender: 'MALE', dateOfBirth: '2026-09-20' })).status).toBe(400)
    expect((await born(k, { fatherId: k.memberId, motherId: wife.memberId, gender: 'MALE', dateOfBirth: '1980-01-01' })).status).toBe(400)
    expect((await born(k, { fatherId: k.memberId, motherId: wife.memberId, gender: 'MALE', dateOfBirth: '2999-01-01' })).status).toBe(400)
    expect((await born(wife, { fatherId: k.memberId, motherId: wife.memberId, gender: 'MALE', dateOfBirth: '2026-09-20' })).status).toBe(403)
  })
})

describe('F14 Search is a limited view', () => {
  it('F14 search by Karta name or Gotra returns a summary only — no address or description', async () => {
    const k = await fx.adult('kartasearch14')
    await fx.family('Searchable', k, [], { gotra: 'Vasishtha14' })
    await prisma.family.updateMany({ where: { name: 'Searchable' }, data: { description: 'private note' } })
    actAs(await fx.adult('looker14'))
    const byGotra = await (await searchFamilies(json('http://x/api/families?gotra=Vasishtha14', 'GET') as any)).json()
    expect(byGotra.families).toHaveLength(1)
    expect(byGotra.families[0]).not.toHaveProperty('description')
    expect(byGotra.families[0]).not.toHaveProperty('addresses')
    expect(byGotra.families[0].karta.firstName).toBe('kartasearch14')
    const byKarta = await (await searchFamilies(json('http://x/api/families?karta=kartasearch14', 'GET') as any)).json()
    expect(byKarta.families.map((f: any) => f.name)).toEqual(['Searchable'])
  })
})
