import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
const sendEmail = vi.fn().mockResolvedValue({ messageId: 'test' })
vi.mock('@/lib/email', () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }))

import fs from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { p1Fixtures, actAs, json, idProofForm, PNG, type Person } from './fixtures'
import { POST as uploadProof } from '@/app/api/verification/id-proof/route'
import { POST as declaration } from '@/app/api/verification/declaration/route'
import { GET as proofFile } from '@/app/api/id-proofs/[id]/file/route'
import { DECLARATION_VERSION, DECLARATION_TEXT } from '@/lib/declaration'
import { decryptText } from '@/lib/secure-files'

const fx = p1Fixtures('p1id')
let geo: Awaited<ReturnType<typeof fx.geography>>
let applicant: Person, op1: Person, op2: Person, opOther: Person, stranger: Person, admin: Person

const lastCode = () => /(\d{6})/.exec(sendEmail.mock.calls.at(-1)![0].text)![1]
async function upload(p: Person, idType: string, idNumber: string, proof?: Buffer) {
  actAs(p)
  return uploadProof(idProofForm(idType, idNumber, proof))
}
const file = (p: Person, id: string, kind = 'proof') => {
  actAs(p)
  return proofFile(new Request(`http://x/api/id-proofs/${id}/file?kind=${kind}`), { params: { id } })
}

beforeAll(async () => {
  geo = await fx.geography()
  op1 = await fx.operator('op1', geo.district)
  op2 = await fx.operator('op2', geo.district)
  opOther = await fx.operator('opx', geo.district2)
  applicant = await fx.applicant('appl', geo.village)
  stranger = await fx.person('stranger')
  admin = await fx.person('admin', { roles: [{ code: 'ADMIN' }] })
})
afterAll(() => fx.cleanup())

describe('F03 ID proof upload (rule 7, OP-01)', () => {
  it('F03 a full Aadhaar number is never stored — only its last 4 digits', async () => {
    const res = await upload(applicant, 'AADHAAR', '1234 5678 9012')
    expect(res.status).toBe(201)
    const row = await prisma.idProof.findFirstOrThrow({ where: { userId: applicant.userId, status: 'ACTIVE' } })
    expect(row).toMatchObject({ idType: 'AADHAAR', idLast4: '9012', idNumberEnc: null })
    expect(JSON.stringify(row)).not.toContain('123456789012')
  })

  it('F03 other ID numbers are stored encrypted and shown masked', async () => {
    expect((await upload(applicant, 'PAN', 'ABCDE1234F')).status).toBe(201)
    const row = await prisma.idProof.findFirstOrThrow({ where: { userId: applicant.userId, status: 'ACTIVE' } })
    expect(row.idLast4).toBe('234F')
    expect(row.idNumberEnc).not.toContain('ABCDE1234F')
    expect(decryptText(row.idNumberEnc!)).toBe('ABCDE1234F')
    // The earlier proof is superseded, not deleted.
    expect(await prisma.idProof.count({ where: { userId: applicant.userId, status: 'SUPERSEDED' } })).toBe(1)
  })

  it('F03 proof files are encrypted at rest, under the storage root (outside the web root)', async () => {
    const row = await prisma.idProof.findFirstOrThrow({ where: { userId: applicant.userId, status: 'ACTIVE' } })
    const root = path.resolve(process.env.UPLOAD_DIR!)
    expect(root.startsWith(path.resolve('public'))).toBe(false)
    const onDisk = await fs.readFile(path.join(root, row.proofKey))
    expect(onDisk.includes(PNG)).toBe(false)          // not the plaintext
    expect(onDisk.subarray(28).equals(PNG)).toBe(false)
  })

  it('F03 rejects bad numbers and files that are not images or PDFs', async () => {
    expect((await upload(applicant, 'PAN', 'NOTAPAN')).status).toBe(400)
    expect((await upload(applicant, 'AADHAAR', '12345')).status).toBe(400)
    expect((await upload(applicant, 'PASSPORT', 'K1234567', Buffer.from('MZ fake exe'))).status).toBe(400)
    expect((await upload(applicant, 'RATION', '1234')).status).toBe(400)
  })
})

describe('F03 Self-declaration with OTP (rule 8)', () => {
  it('F03 agreeing needs the tick and a valid code', async () => {
    actAs(applicant)
    await declaration(json('http://x', 'POST', { action: 'send-otp' }))
    const code = lastCode()
    expect((await declaration(json('http://x', 'POST', { action: 'agree', agree: false, otp: code }))).status).toBe(400)
    expect((await declaration(json('http://x', 'POST', { action: 'agree', agree: true, otp: '000000' }))).status).toBe(400)
  })

  it('F03 stores text version, exact text, time, IP and OTP reference; sends a copy; submits → PENDING_APPROVAL with 2 tasks', async () => {
    actAs(applicant)
    await declaration(json('http://x', 'POST', { action: 'send-otp' }))
    const res = await declaration(json('http://x', 'POST', { action: 'agree', agree: true, otp: lastCode() }))
    expect(res.status).toBe(200)

    const consent = await prisma.consentRecord.findFirstOrThrow({ where: { userId: applicant.userId, consentType: 'REGISTRATION_DECLARATION' } })
    expect(consent).toMatchObject({ version: DECLARATION_VERSION, declarationText: DECLARATION_TEXT, ipAddress: '203.0.113.7', granted: true })
    const token = await prisma.verificationToken.findUniqueOrThrow({ where: { id: consent.otpReference! } })
    expect(token).toMatchObject({ userId: applicant.userId, type: 'DECLARATION' })
    expect(token.usedAt).not.toBeNull()

    const copy = await prisma.notification.findFirstOrThrow({ where: { recipientId: applicant.userId, type: 'DECLARATION_COPY' } })
    expect(copy.body).toContain(DECLARATION_TEXT)
    expect(copy.emailSent).toBe(true)

    expect((await prisma.user.findUniqueOrThrow({ where: { id: applicant.userId } })).status).toBe('PENDING_APPROVAL')
    const tasks = await prisma.approvalTask.findMany({ where: { subjectUserId: applicant.userId, supersededAt: null } })
    expect(tasks).toHaveLength(2)
    expect(new Set(tasks.map((t) => t.operatorUserId))).toEqual(new Set([op1.userId, op2.userId]))
  })

  it('F03 the ID proof is locked while the operators review it', async () => {
    expect((await upload(applicant, 'PAN', 'ABCDE9999F')).status).toBe(409)
  })
})

describe('F03/F33 Who can open an ID proof file — and every view is logged', () => {
  let proofId: string
  beforeAll(async () => {
    proofId = (await prisma.idProof.findFirstOrThrow({ where: { userId: applicant.userId, status: 'ACTIVE' } })).id
  })

  it('the owner, an assigned Operator and an Admin can open it', async () => {
    for (const viewer of [applicant, op1, admin]) {
      const res = await file(viewer, proofId)
      expect(res.status).toBe(200)
      expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true)
    }
    expect((await file(op2, proofId, 'selfSigned')).headers.get('content-type')).toBe('application/pdf')
  })

  it('an Operator without a task for this person, or any other member, cannot', async () => {
    expect((await file(opOther, proofId)).status).toBe(404)
    expect((await file(stranger, proofId)).status).toBe(404)
  })

  it('every view is in the audit log', async () => {
    const views = await prisma.auditLog.findMany({ where: { action: 'id_proof.view', entityId: proofId } })
    expect(new Set(views.map((v) => v.actorId))).toEqual(new Set([applicant.userId, op1.userId, op2.userId, admin.userId]))
  })
})
