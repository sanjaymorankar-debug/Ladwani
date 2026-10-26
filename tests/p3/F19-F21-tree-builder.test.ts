import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue({ messageId: 'test' }) }))

import { prisma } from '@/lib/prisma'
import { p3Fixtures, actAs, json, type Person } from './fixtures'
import { POST as addParents } from '@/app/api/families/[id]/tree/parents/route'
import { POST as addSibling } from '@/app/api/families/[id]/tree/siblings/route'
import { POST as addMember } from '@/app/api/families/[id]/members/route'
import { GET as getTree } from '@/app/api/families/[id]/tree/route'
import { linkPeople } from '@/lib/relations'
import { layoutTree, descendantsOf } from '@/lib/tree-layout'

const fx = p3Fixtures('p3b')

async function tree(famId: string, as: Person) {
  actAs(as)
  const res = await getTree(json('http://x', 'GET'), { params: { id: famId } })
  return { status: res.status, body: await res.json() }
}
const parents = (as: Person, famId: string, body: Record<string, unknown>) => { actAs(as); return addParents(json('http://x', 'POST', body), { params: { id: famId } }) }
const sibling = (as: Person, famId: string, body: Record<string, unknown>) => { actAs(as); return addSibling(json('http://x', 'POST', body), { params: { id: famId } }) }
const code = async (from: string, to: string) =>
  (await prisma.memberRelationship.findMany({ where: { fromMemberId: from, toMemberId: to, isActive: true }, include: { relationshipType: true } })).map((r) => r.relationshipType.code)

let k: Person, wife: Person, son: Person, famId: string
let dadaId: string, dadiId: string

beforeAll(async () => {
  k = await fx.adult('k', { dob: '1975-04-01' })
  wife = await fx.adult('w', { gender: 'FEMALE', dob: '1978-01-01' })
  son = await fx.profile('s', { dob: '2005-03-01' })
  famId = await fx.family('Tree', k, [{ p: wife, role: 'wife' }, { p: son, role: 'son' }])
  await linkPeople(prisma, k.memberId, wife.memberId, 'husband', k.userId, famId)
  await linkPeople(prisma, k.memberId, son.memberId, 'father', k.userId, famId)
})
afterAll(() => fx.cleanup())

describe('F19 Build ancestor tree (3 generations up)', () => {
  it('F19 the Karta adds his father and mother as a husband-and-wife pair; expired one shown Late; year-only birth', async () => {
    const res = await parents(k, famId, {
      childMemberId: k.memberId,
      father: { firstName: 'Dada', birthYear: 1940, alive: false, deceasedAt: '2010-05-01' },
      mother: { firstName: 'Dadi', birthYear: 1945 },
    })
    expect(res.status).toBe(201)
    ;({ fatherId: dadaId, motherId: dadiId } = await res.json())

    const dada = await prisma.member.findUniqueOrThrow({ where: { id: dadaId } })
    expect(dada).toMatchObject({ status: 'DECEASED', dateOfBirthApprox: true, userId: null })
    expect((await prisma.member.findUniqueOrThrow({ where: { id: dadiId } })).maritalStatus).toBe('WIDOWED')
    expect(await prisma.familyMember.findFirst({ where: { familyId: famId, memberId: dadaId } })).toMatchObject({ relationshipRole: 'father', relativeToMemberId: k.memberId })
    expect(await code(dadaId, k.memberId)).toContain('father')
    expect(await code(k.memberId, dadiId)).toContain('son')
    expect(await code(dadaId, dadiId)).toContain('husband')

    const t = await tree(famId, k)
    const node = t.body.nodes.find((n: any) => n.id === dadaId)
    expect(node.data).toMatchObject({ generation: 1, late: true, role: 'Father', birthYear: 1940 })
    expect(t.body.nodes.find((n: any) => n.id === son.memberId).data.generation).toBe(-1)
    expect(t.body.edges.some((e: any) => e.kind === 'parent' && e.source === dadaId && e.target === k.memberId)).toBe(true)
    expect(t.body.edges.some((e: any) => e.kind === 'spouse' && [e.source, e.target].sort().join() === [dadaId, dadiId].sort().join())).toBe(true)
  })

  it('F19 builds up to three generations above the Karta on both sides; a fourth is refused (OP-02)', async () => {
    const gp = await parents(k, famId, { childMemberId: dadaId, father: { firstName: 'Ajoba', birthYear: 1910 }, mother: { firstName: 'Aaji', birthYear: 1915 } })
    expect(gp.status).toBe(201)
    const { fatherId: ajoba } = await gp.json()
    const ggp = await parents(k, famId, { childMemberId: ajoba, father: { firstName: 'Panjoba', birthYear: 1880, alive: false }, mother: { firstName: 'Panji', birthYear: 1885, alive: false } })
    expect(ggp.status).toBe(201)
    const { fatherId: panjoba } = await ggp.json()
    const fourth = await parents(k, famId, { childMemberId: panjoba, father: { firstName: 'Too' }, mother: { firstName: 'Far' } })
    expect(fourth.status).toBe(400)
    // Maternal side
    expect((await parents(k, famId, { childMemberId: dadiId, father: { firstName: 'Nana' }, mother: { firstName: 'Nani' } })).status).toBe(201)
    const t = await tree(famId, k)
    expect(t.body.nodes.find((n: any) => n.id === panjoba).data.generation).toBe(3)
  })

  it('F19 only the family builds its tree; parents already recorded → 409; parents must be older than the child', async () => {
    const outsider = await fx.adult('out')
    expect((await parents(outsider, famId, { childMemberId: son.memberId, father: { firstName: 'X' }, mother: { firstName: 'Y' } })).status).toBe(403)
    expect((await parents(k, famId, { childMemberId: k.memberId, father: { firstName: 'X' }, mother: { firstName: 'Y' } })).status).toBe(409)
    const late = await parents(k, famId, { childMemberId: wife.memberId, father: { firstName: 'Young', dateOfBirth: '1990-01-01' }, mother: { firstName: 'Mom' } })
    expect(late.status).toBe(400)
  })
})

describe('F20 Add spouse-side tree', () => {
  it('F20 a member adds their own spouse\'s parents; both sides join at the marriage', async () => {
    const bro = await fx.adult('bro', { dob: '1980-01-01' })
    const broWife = await fx.profile('bw', { gender: 'FEMALE', dob: '1982-01-01' })
    await prisma.familyMember.createMany({ data: [
      { familyId: famId, memberId: bro.memberId, relationshipRole: 'brother', relativeToMemberId: k.memberId },
      { familyId: famId, memberId: broWife.memberId, relationshipRole: 'wife', relativeToMemberId: bro.memberId },
    ] })
    await linkPeople(prisma, bro.memberId, broWife.memberId, 'husband', k.userId, famId)

    const res = await parents(bro, famId, { childMemberId: broWife.memberId, father: { firstName: 'Sasur', birthYear: 1950 }, mother: { firstName: 'Saas', birthYear: 1955 } })
    expect(res.status).toBe(201)
    const { fatherId } = await res.json()
    const t = await tree(famId, k)
    expect(t.body.nodes.find((n: any) => n.id === fatherId).data.generation).toBe(1)
    expect(t.body.edges.some((e: any) => e.kind === 'parent' && e.source === fatherId && e.target === broWife.memberId)).toBe(true)
  })
})

describe("Members build the tree (owner's decision), not only the Karta", () => {
  it('F19/F20 a plain member adds ancestors for anyone in the family; the depth limit and the checks still apply', async () => {
    const cousin = await fx.adult('cz', { dob: '1985-01-01' })
    await prisma.familyMember.create({ data: { familyId: famId, memberId: cousin.memberId, relationshipRole: 'cousin', relativeToMemberId: k.memberId } })
    // The Karta's wife is not the member's own spouse: allowed now.
    const res = await parents(cousin, famId, { childMemberId: wife.memberId, father: { firstName: 'Mama', birthYear: 1950 }, mother: { firstName: 'Mami', birthYear: 1952 } })
    expect(res.status).toBe(201)
    const { fatherId } = await res.json()
    expect(await code(fatherId, wife.memberId)).toContain('father')
    // Same checks as for the Karta: parents already recorded → 409.
    expect((await parents(cousin, famId, { childMemberId: wife.memberId, father: { firstName: 'X' }, mother: { firstName: 'Y' } })).status).toBe(409)
    // Someone outside the family still cannot.
    const outsider = await fx.adult('out2')
    expect((await parents(outsider, famId, { childMemberId: son.memberId, father: { firstName: 'X' }, mother: { firstName: 'Y' } })).status).toBe(403)
  })
})

describe('F21 Add brothers and sisters of any person', () => {
  it('F21 a sister shares the person\'s parents automatically; links fit her gender', async () => {
    const res = await sibling(k, famId, { ofMemberId: k.memberId, firstName: 'Tai', gender: 'FEMALE', birthYear: 1972, maritalStatus: 'MARRIED' })
    expect(res.status).toBe(201)
    const { memberId } = await res.json()
    expect(await prisma.familyMember.findFirst({ where: { familyId: famId, memberId } })).toMatchObject({ relationshipRole: 'sister', relativeToMemberId: k.memberId })
    expect(await code(dadaId, memberId)).toContain('father')
    expect(await code(dadiId, memberId)).toContain('mother')
    expect(await code(memberId, dadaId)).toContain('daughter') // not "son"
    expect(await code(memberId, k.memberId)).toContain('sister')
    const t = await tree(famId, k)
    expect(t.body.nodes.find((n: any) => n.id === memberId).data.generation).toBe(0)
  })

  it('F21 a sibling at any level; a duplicate is refused; "has own family on site" leaves a link placeholder', async () => {
    const other = await fx.family('OwnFam', await fx.adult('ok'))
    const res = await sibling(k, famId, { ofMemberId: dadaId, firstName: 'Kaka', gender: 'MALE', birthYear: 1943, linkFamilyId: other })
    expect(res.status).toBe(201)
    const { memberId, linkPlaceholder } = await res.json()
    expect(linkPlaceholder).toBe(true)
    expect(await prisma.treeLinkRequest.findFirst({ where: { fromMemberId: memberId, toFamilyId: other } })).toMatchObject({ status: 'PLACEHOLDER', toMemberId: null })
    expect(await code(memberId, dadaId)).toContain('brother')
    expect((await sibling(k, famId, { ofMemberId: dadaId, firstName: 'Kaka', gender: 'MALE' })).status).toBe(409)
  })
})

describe('F10 / F21 relationship links use the inverse that fits the person', () => {
  it('a daughter added relative to her mother gives the mother a "mother" link, not "father"', async () => {
    actAs(k)
    const res = await addMember(json('http://x', 'POST', {
      firstName: 'Riya', gender: 'FEMALE', dateOfBirth: '2008-06-01', relationshipTypeCode: 'daughter', relatedToMemberId: wife.memberId,
    }), { params: { id: famId } })
    expect(res.status).toBe(201)
    const { memberId } = await res.json()
    expect(await code(wife.memberId, memberId)).toEqual(['mother'])
  })
})

describe('F25 tree layout', () => {
  it('parents sit a row above their children, spouses side by side; collapsing hides descendants and their spouses', () => {
    const n = (id: string, generation: number) => ({ id, data: { generation } })
    const edges = [
      { source: 'f', target: 'c', kind: 'parent' as const }, { source: 'm', target: 'c', kind: 'parent' as const },
      { source: 'f', target: 'm', kind: 'spouse' as const }, { source: 'c', target: 'cw', kind: 'spouse' as const },
      { source: 'c', target: 'gc', kind: 'parent' as const },
    ]
    const out = layoutTree([n('f', 1), n('m', 1), n('c', 0), n('cw', 0), n('gc', -1)], edges)
    const pos = Object.fromEntries(out.map((o) => [o.id, o.position]))
    expect(pos.f.y).toBeLessThan(pos.c.y)
    expect(pos.c.y).toBeLessThan(pos.gc.y)
    expect(Math.abs(pos.f.x - pos.m.x)).toBeLessThanOrEqual(190)
    expect(Math.abs(pos.c.x - pos.cw.x)).toBeLessThanOrEqual(190)
    expect(Array.from(descendantsOf('f', edges)).sort()).toEqual(['c', 'cw', 'gc'])
  })
})
