import { vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { p0Fixtures } from '../p0/fixtures'
import { issueOtp } from '@/lib/otp'

/** 1×1 PNG and a minimal PDF: real magic bytes, so the type sniffing accepts them. */
export const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex')
export const PDF = Buffer.from('%PDF-1.4\n%test\n', 'latin1')

export type Person = { userId: string; memberId: string; roles: string[] }

export function actAs(p: Person, roles = p.roles) {
  ;(getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: p.userId, roles, memberId: p.memberId, status: 'ACTIVE', email: null },
    expires: new Date(Date.now() + 86400000).toISOString(),
  })
}

export function json(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method, headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.7', 'user-agent': 'vitest' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function idProofForm(idType: string, idNumber: string, proof: Buffer = PNG, selfSigned: Buffer = PDF) {
  const form = new FormData()
  form.set('idType', idType)
  form.set('idNumber', idNumber)
  form.set('proof', new Blob([new Uint8Array(proof)]), 'proof.png')
  form.set('selfSigned', new Blob([new Uint8Array(selfSigned)]), 'signed.pdf')
  return new Request('http://x/api/verification/id-proof', { method: 'POST', body: form })
}

/**
 * Builds on the P0 fixtures with a location tree, operators mapped to its
 * districts, and helpers that walk an applicant through F01–F03.
 */
export function p1Fixtures(prefix: string) {
  const base = p0Fixtures(prefix)
  const familyIds: string[] = []

  async function geography() {
    const c = await base.area('in', `${prefix} Country`, 'COUNTRY', null)
    const state = await base.area('st', `${prefix} State`, 'STATE', c)
    const district = await base.area('di', `${prefix} District`, 'DISTRICT', state)
    const taluka = await base.area('ta', `${prefix} Taluka`, 'TALUKA', district)
    const village = await base.area('vi', `${prefix} Village`, 'VILLAGE', taluka)
    const state2 = await base.area('st2', `${prefix} State Two`, 'STATE', c)
    const district2 = await base.area('di2', `${prefix} District Two`, 'DISTRICT', state2)
    const taluka2 = await base.area('ta2', `${prefix} Taluka Two`, 'TALUKA', district2)
    const village2 = await base.area('vi2', `${prefix} Village Two`, 'VILLAGE', taluka2)
    return { c, state, district, taluka, village, state2, district2, taluka2, village2 }
  }

  async function operator(tag: string, districtId: string) {
    return base.person(tag, { roles: [{ code: 'MEMBER' }, { code: 'OPERATOR', areaId: districtId }] })
  }

  /** A DRAFT applicant with every mandatory F02 item filled in (except the ID proof). */
  async function applicant(tag: string, villageId: string, opts: { status?: string } = {}) {
    const p = await base.person(tag, { mobile: `98${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}` })
    await prisma.user.update({ where: { id: p.userId }, data: { status: (opts.status ?? 'DRAFT') as any } })
    await prisma.member.update({
      where: { id: p.memberId },
      data: { gender: 'MALE', maritalStatus: 'UNMARRIED', employmentStatus: 'STUDENT' },
    })
    await prisma.memberArea.create({ data: { memberId: p.memberId, areaId: villageId, isPrimary: true } })
    for (const addressType of ['CURRENT', 'PERMANENT']) {
      await prisma.address.create({
        data: { addressableType: 'member', memberId: p.memberId, addressType, areaId: villageId, line1: '1 Main Road', city: 'Village' },
      })
    }
    return p
  }

  /** F03 declaration with a real OTP, as the route would record it. */
  async function declare(p: Person) {
    const { tokenId } = await issueOtp(p.userId, 'DECLARATION')
    const { DECLARATION_TEXT, DECLARATION_VERSION } = await import('@/lib/declaration')
    await prisma.verificationToken.update({ where: { id: tokenId }, data: { usedAt: new Date() } })
    return prisma.consentRecord.create({
      data: {
        userId: p.userId, consentType: 'REGISTRATION_DECLARATION', granted: true, version: DECLARATION_VERSION,
        declarationText: DECLARATION_TEXT, otpReference: tokenId, ipAddress: '203.0.113.7',
      },
    })
  }

  async function family(name: string, memberIds: string[]) {
    const fam = await prisma.family.create({ data: { registrationNumber: `${prefix}-${name}`.toUpperCase(), name } })
    familyIds.push(fam.id)
    await prisma.familyMember.createMany({ data: memberIds.map((memberId) => ({ familyId: fam.id, memberId })) })
    return fam.id
  }

  async function cleanup() {
    const users = base.userIds
    const members = base.memberIds
    await prisma.approvalTask.deleteMany({ where: { OR: [{ subjectUserId: { in: users } }, { operatorUserId: { in: users } }] } })
    await prisma.profileChangeRequest.deleteMany({ where: { userId: { in: users } } })
    await prisma.idProof.deleteMany({ where: { userId: { in: users } } })
    await prisma.consentRecord.deleteMany({ where: { userId: { in: users } } })
    await prisma.verificationToken.deleteMany({ where: { userId: { in: users } } })
    await prisma.address.deleteMany({ where: { memberId: { in: members } } })
    await prisma.memberProfileDetail.deleteMany({ where: { memberId: { in: members } } })
    await prisma.educationRecord.deleteMany({ where: { memberId: { in: members } } })
    await prisma.approval.deleteMany({ where: { submittedBy: { in: users } } })
    await prisma.familyMember.deleteMany({ where: { familyId: { in: familyIds } } })
    await prisma.family.deleteMany({ where: { id: { in: familyIds } } })
    await base.cleanup()
    // Encrypted test proofs written under UPLOAD_DIR.
    const root = path.resolve(process.env.UPLOAD_DIR || 'uploads')
    for (const id of members) await fs.rm(path.join(root, 'id-proofs', id), { recursive: true, force: true })
  }

  return { ...base, geography, operator, applicant, declare, family, cleanup }
}
