import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'
import { canonicalSocialStatus } from '@/lib/occupation'
import { createRound, currentRound, liveTasks, KIND } from '@/lib/verification'
import { DECLARATION_VERSION } from '@/lib/declaration'
import { encryptText } from '@/lib/secure-files'

/**
 * F02 profile completeness and F03 submission for approval.
 * Mandatory items block submission; optional ones only count toward the %.
 */
export interface CompletenessItem { key: string; label: string; done: boolean; mandatory: boolean }

export async function profileCompleteness(memberId: string) {
  const m = await prisma.member.findUniqueOrThrow({
    where: { id: memberId },
    select: {
      firstName: true, lastName: true, gender: true, dateOfBirth: true, mobilePrimary: true, maritalStatus: true,
      employmentStatus: true,
      user: { select: { mobile: true } },
      addresses: { select: { addressType: true, areaId: true } },
      memberAreas: { where: { isPrimary: true }, select: { areaId: true } },
      profileDetails: true,
      _count: { select: { education: true, photos: true } },
      idProofs: { where: { status: 'ACTIVE' }, select: { id: true } },
    },
  })
  const pd = m.profileDetails
  const social = canonicalSocialStatus(m.employmentStatus)
  const occupationDone = social !== 'WORKING' || (!!pd?.incomeSource && !!pd.annualIncomeRange && (
    (pd.incomeSource === 'SERVICE' && !!pd.serviceType && !!pd.employerName) ||
    (pd.incomeSource === 'BUSINESS' && !!pd.occBusinessType && !!pd.occBusinessName) ||
    (pd.incomeSource === 'PROFESSIONAL' && !!pd.profession)))
  const current = m.addresses.find((a) => a.addressType === 'CURRENT')

  const items: CompletenessItem[] = [
    { key: 'name', label: 'First and last name', done: !!m.firstName && !!m.lastName, mandatory: true },
    { key: 'gender', label: 'Gender', done: ['MALE', 'FEMALE', 'OTHER'].includes(m.gender), mandatory: true },
    { key: 'dob', label: 'Date of birth', done: !!m.dateOfBirth, mandatory: true },
    { key: 'mobile', label: 'Mobile number', done: !!(m.user?.mobile ?? m.mobilePrimary), mandatory: true },
    { key: 'currentAddress', label: 'Current address with its village / city', done: !!current?.areaId, mandatory: true },
    { key: 'permanentAddress', label: 'Permanent address', done: m.addresses.some((a) => a.addressType === 'PERMANENT'), mandatory: true },
    { key: 'mulGaon', label: 'Mul Gaon (native village)', done: m.memberAreas.length > 0, mandatory: true },
    { key: 'socialStatus', label: 'Social status', done: !!social, mandatory: true },
    { key: 'occupation', label: 'Occupation and income band', done: !!social && occupationDone, mandatory: true },
    { key: 'maritalStatus', label: 'Marital status', done: m.maritalStatus !== 'NOT_STATED', mandatory: true },
    { key: 'education', label: 'Education', done: m._count.education > 0 || !!pd?.educationLevel, mandatory: false },
    { key: 'photo', label: 'Photo', done: m._count.photos > 0, mandatory: false },
    { key: 'idProof', label: 'ID proof and self-signed copy', done: m.idProofs.length > 0, mandatory: true },
  ]
  const done = items.filter((i) => i.done).length
  return {
    percent: Math.round((done / items.length) * 100),
    items,
    missingMandatory: items.filter((i) => i.mandatory && !i.done).map((i) => i.label),
  }
}

// ── F03 ID proof ─────────────────────────────────────────────────

export const ID_TYPES = [
  { value: 'AADHAAR', label: 'Aadhaar (masked — only the last 4 digits are kept)' },
  { value: 'PAN', label: 'PAN card' },
  { value: 'VOTER_ID', label: 'Voter ID' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'DRIVING_LICENCE', label: 'Driving licence' },
] as const

const ID_PATTERNS: Record<string, RegExp> = {
  PAN: /^[A-Z]{5}\d{4}[A-Z]$/,
  VOTER_ID: /^[A-Z]{3}\d{7}$/,
  PASSPORT: /^[A-Z]\d{7}$/,
  DRIVING_LICENCE: /^[A-Z0-9-]{10,20}$/,
}

/**
 * Open Point OP-01: a full Aadhaar number is never stored — an Aadhaar entry
 * (12 digits, or just the last 4) keeps only its last 4 digits. Other ID
 * numbers are stored encrypted, and only their last 4 digits are ever shown.
 */
export function parseIdNumber(idType: unknown, idNumber: unknown):
  { idType: string; idLast4: string; idNumberEnc: string | null } | { error: string } {
  const type = String(idType ?? '')
  if (!ID_TYPES.some((t) => t.value === type)) return { error: 'Choose the type of ID' }
  const raw = String(idNumber ?? '').toUpperCase().replace(/\s+/g, '')
  if (type === 'AADHAAR') {
    const digits = raw.replace(/\D/g, '')
    if (!/^(\d{4}|\d{12})$/.test(digits)) return { error: 'Enter the 12-digit Aadhaar number or just its last 4 digits' }
    return { idType: type, idLast4: digits.slice(-4), idNumberEnc: null }
  }
  if (!ID_PATTERNS[type].test(raw)) return { error: 'That ID number is not in the expected format' }
  return { idType: type, idLast4: raw.slice(-4), idNumberEnc: encryptText(raw) }
}

// ── F03 submit / F06 resubmit ────────────────────────────────────

export type SubmitResult = { ok: true; status: string } | { ok: false; status: number; message: string; missing?: string[] }

export async function submitRegistration(userId: string, req?: Request): Promise<SubmitResult> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { member: { select: { id: true } } } })
  if (!user.member) return { ok: false, status: 400, message: 'No member profile found for this account' }
  if (!['DRAFT', 'CORRECTION_REQUIRED'].includes(user.status)) {
    return { ok: false, status: 409, message: user.status === 'PENDING_APPROVAL' ? 'Your registration is already with the operators.' : 'There is nothing to submit for this account.' }
  }

  const completeness = await profileCompleteness(user.member.id)
  if (completeness.missingMandatory.length) {
    return { ok: false, status: 400, message: 'Complete the required profile items first.', missing: completeness.missingMandatory }
  }
  // A fresh declaration for this submission (after any earlier decision).
  const consent = await prisma.consentRecord.findFirst({
    where: {
      userId, consentType: 'REGISTRATION_DECLARATION', version: DECLARATION_VERSION, granted: true,
      otpReference: { not: null },
      ...(user.registrationDecidedAt ? { grantedAt: { gt: user.registrationDecidedAt } } : {}),
    },
  })
  if (!consent) return { ok: false, status: 400, message: 'Agree to the declaration and confirm it with the one-time code first.' }

  const previousRound = await currentRound(KIND.REGISTRATION, userId)
  const preferred = previousRound
    ? (await liveTasks({ kind: KIND.REGISTRATION, subjectUserId: userId, round: previousRound })).map((t) => t.operatorUserId)
    : []

  const moved = await prisma.user.updateMany({
    where: { id: userId, status: { in: ['DRAFT', 'CORRECTION_REQUIRED'] } },
    data: { status: 'PENDING_APPROVAL', registrationSubmittedAt: new Date(), registrationNote: null },
  })
  if (moved.count !== 1) return { ok: false, status: 409, message: 'Your registration was already submitted.' }

  await createRound({ kind: KIND.REGISTRATION, subjectUserId: userId, subjectMemberId: user.member.id, round: previousRound + 1 }, preferred)
  await recordAudit({
    actorId: userId, action: previousRound ? 'registration.resubmit' : 'registration.submit',
    entityType: 'user', entityId: userId,
    oldValue: { status: user.status }, newValue: { status: 'PENDING_APPROVAL' }, metadata: { round: previousRound + 1 },
  }, req)
  return { ok: true, status: 'PENDING_APPROVAL' }
}
