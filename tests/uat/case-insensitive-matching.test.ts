import { describe, it, expect, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { validateLogin } from '@/lib/auth'
import { POST as postRegister } from '@/app/api/auth/register/route'
import { GET as searchMembers } from '@/app/api/search/route'
import { GET as listFamilies } from '@/app/api/families/route'
import { account, bareMember, actAs, jsonReq, UAT_PASSWORD } from './helpers'

// PostgreSQL compares text case-sensitively, where the MySQL collation this app
// used before did not. These pin the behaviour members already rely on: an
// email or a search term matches whatever case it is typed in.

const swapCase = (s: string) =>
  s.split('').map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join('')

const CLASH_MOBILE = '9811119901'

// Only reached if TC-CASE-002 regresses and the duplicate account gets created.
afterAll(async () => {
  const u = await prisma.user.findFirst({ where: { mobile: CLASH_MOBILE }, include: { member: true } })
  if (!u) return
  await prisma.verificationToken.deleteMany({ where: { userId: u.id } })
  await prisma.consentRecord.deleteMany({ where: { userId: u.id } })
  await prisma.userRole.deleteMany({ where: { userId: u.id } })
  if (u.member) await prisma.member.delete({ where: { id: u.member.id } })
  await prisma.user.delete({ where: { id: u.id } })
})

describe('TC-CASE — matching ignores letter case', () => {
  it('TC-CASE-001 login accepts the email in a different case', async () => {
    const karta = await account('KARTA-01')
    const res = await validateLogin(karta.email.toUpperCase(), UAT_PASSWORD)
    expect(res.ok).toBe(true)
  })

  it('TC-CASE-002 registration refuses an existing email typed in a different case', async () => {
    const karta = await account('KARTA-01')
    const res = await postRegister(jsonReq('http://x/api/auth/register', 'POST', {
      firstName: 'Case', lastName: 'Clash', password: 'ValidPass123', joinIntent: 'JOIN_EXISTING',
      email: karta.email.toUpperCase(), mobile: CLASH_MOBILE,
    }))
    expect(res.status).toBe(409)
    expect(await prisma.user.count({ where: { mobile: CLASH_MOBILE } })).toBe(0)
  })

  it('TC-CASE-003 member search matches a name typed in a different case', async () => {
    const karta = await account('KARTA-01')
    const target = await bareMember('KARTA-01')
    actAs(karta)
    const q = encodeURIComponent(swapCase(target.firstName))
    const body = await (await searchMembers(new Request(`http://x/api/search?q=${q}`) as any)).json()
    expect(JSON.stringify(body)).toContain(target.id)
  })

  it('TC-CASE-004 family search matches a name typed in a different case', async () => {
    const karta = await account('KARTA-01')
    const family = await prisma.family.findUniqueOrThrow({ where: { id: karta.familyId! } })
    actAs(karta)
    const q = encodeURIComponent(swapCase(family.name))
    const body = await (await listFamilies(new Request(`http://x/api/families?q=${q}`) as any)).json()
    expect(JSON.stringify(body)).toContain(family.id)
  })
})
