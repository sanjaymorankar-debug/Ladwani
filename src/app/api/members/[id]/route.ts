import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redactMemberForViewer } from '@/lib/visibility'
import { getMemberAccess } from '@/lib/member-auth'
import { validatePhysical } from '@/lib/validators'
import { PHYSICAL_FIELDS, getPhysicalFieldConfig } from '@/lib/physical-fields'
import { submitAddressChange, type AddressChangeResult } from '@/lib/approvals'
import {
  parseProfileDetails, parseAddress, isAddressEmpty, validateMobile, normalizeMobile, UNMARRIED_FLOW_RESET,
} from '@/lib/profile-details'
import { SOCIAL_STATUSES, LEGACY_SOCIAL_STATUS, canonicalSocialStatus, parseOccupation, OCCUPATION_FIELDS } from '@/lib/occupation'
import { SENSITIVE_FIELDS, openChangeRequest } from '@/lib/verification'
import { REGISTRATION_STATUSES } from '@/lib/account-state'
import { validateSettlement, chainText } from '@/lib/locations'
import { recordAudit } from '@/lib/audit'

const MARITAL_STATUSES = ['UNMARRIED', 'MARRIED', 'WIDOWED', 'DIVORCED', 'SEPARATED', 'NOT_STATED']
const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'NOT_STATED']
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const member = await prisma.member.findUnique({
    where: { id: params.id, deletedAt: null },
    include: {
      education: true,
      employment: { include: { incomeRange: true } },
      businesses: true,
      skills: { include: { skill: true } },
    },
  })
  if (!member) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  return NextResponse.json(await redactMemberForViewer(session, member))
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const userId = session.user?.id as string
  const body = await req.json()

  const member = await prisma.member.findUnique({ where: { id: params.id }, include: { user: true } })
  if (!member) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  const roles: string[] = (session.user as any)?.roles ?? []
  // Single source of truth for "who may edit this member" — self, staff, or
  // the Karta of an account-less family member. See member-auth.ts.
  const access = await getMemberAccess(session, params.id)
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  // Marrying someone links two people's records and the family tree, so it
  // always goes through the dedicated /spouse endpoint (which applies the
  // approval gate). Every other marital-status value is a simple field edit.
  if (body.maritalStatus === 'MARRIED' && member.maritalStatus !== 'MARRIED') {
    return NextResponse.json(
      { message: "To set status to Married, use the spouse-linking flow so the relationship can be recorded." },
      { status: 400 }
    )
  }

  // F08: once an account is verified (ACTIVE), the member's own edits to
  // name / DOB / gender become a change request for two operators; the old
  // values stay live until it is approved. Locked while under review.
  const subjectStatus = member.user?.status ?? null
  const selfEdit = access.isOwn && !roles.includes('ADMIN')
  const norm = (f: string, v: unknown) =>
    f === 'dateOfBirth' ? (v ? new Date(v as any).toISOString().slice(0, 10) : null)
    : v === '' || v === undefined ? null : typeof v === 'string' ? v.trim() : v
  const sensitiveChanges: Record<string, { old: unknown; new: unknown }> = {}
  for (const f of SENSITIVE_FIELDS) {
    if (body[f] === undefined) continue
    const before = norm(f, (member as any)[f])
    const after = norm(f, body[f])
    if (before !== after) sensitiveChanges[f] = { old: before, new: after }
  }
  const sensitiveKeys = Object.keys(sensitiveChanges)
  const routeToApproval = selfEdit && subjectStatus === 'ACTIVE' && sensitiveKeys.length > 0
  if (selfEdit && subjectStatus === 'PENDING_APPROVAL' && sensitiveKeys.length) {
    return NextResponse.json({ message: 'Your name, date of birth and gender are locked while the operators verify your registration.' }, { status: 409 })
  }
  if (routeToApproval && (await prisma.profileChangeRequest.findFirst({ where: { memberId: member.id, status: 'PENDING' } }))) {
    return NextResponse.json({ message: 'A change to your verified details is already awaiting approval.' }, { status: 409 })
  }
  // A member not yet verified is still filling in their profile (F02):
  // their address edits save directly, like everything else they enter.
  const preApproval = !!subjectStatus && (REGISTRATION_STATUSES as readonly string[]).includes(subjectStatus)

  // F02: social status and occupation.
  if (body.employmentStatus !== undefined && body.employmentStatus !== '' && body.employmentStatus !== null
    && !SOCIAL_STATUSES.some((o) => o.value === body.employmentStatus) && !LEGACY_SOCIAL_STATUS[body.employmentStatus]) {
    return NextResponse.json({ message: 'Choose a social status: Student, Working, Retired, Homemaker or Not working' }, { status: 400 })
  }
  let occupation: Record<string, string | null> | undefined
  if (body.occupation !== undefined) {
    const nextSocial = canonicalSocialStatus(body.employmentStatus !== undefined ? body.employmentStatus : member.employmentStatus)
    const existingDetails = await prisma.memberProfileDetail.findUnique({ where: { memberId: member.id }, select: { annualIncomeRange: true } })
    const nextIncome = body.profileDetails?.annualIncomeRange !== undefined ? body.profileDetails.annualIncomeRange : existingDetails?.annualIncomeRange
    const parsed = parseOccupation(nextSocial, body.occupation, nextIncome)
    if (parsed.error) return NextResponse.json({ message: parsed.error }, { status: 400 })
    occupation = parsed.data
  }

  // Required and format checks. Mobile and email are only checked when they
  // change, so a record holding an older-format value still saves untouched.
  if (body.firstName !== undefined && (typeof body.firstName !== 'string' || body.firstName.trim().length < 2)) {
    return NextResponse.json({ message: 'Full name is required (first name of at least 2 characters)' }, { status: 400 })
  }
  if (body.maritalStatus !== undefined && !MARITAL_STATUSES.includes(body.maritalStatus)) {
    return NextResponse.json({ message: 'Marital status is required' }, { status: 400 })
  }
  if (body.gender !== undefined && !GENDERS.includes(body.gender)) {
    return NextResponse.json({ message: 'Invalid gender' }, { status: 400 })
  }
  if (body.dateOfBirth) {
    const dob = new Date(body.dateOfBirth)
    if (Number.isNaN(dob.getTime()) || dob > new Date()) {
      return NextResponse.json({ message: 'Date of birth must be a valid date in the past' }, { status: 400 })
    }
  }
  const mobileChanged = body.mobilePrimary !== undefined && (body.mobilePrimary || null) !== member.mobilePrimary
  if (mobileChanged) {
    const mobileError = validateMobile(body.mobilePrimary)
    if (mobileError) return NextResponse.json({ message: mobileError }, { status: 400 })
  }
  if (body.email && body.email !== member.email && !EMAIL_REGEX.test(String(body.email))) {
    return NextResponse.json({ message: 'Enter a valid email address' }, { status: 400 })
  }

  // Extra personal details. Validated against the marital status this save
  // leaves the member with; anything under an off toggle is dropped here.
  const nextMaritalStatus: string = body.maritalStatus ?? member.maritalStatus
  let profileDetails: ReturnType<typeof parseProfileDetails>['data']
  if (body.profileDetails !== undefined) {
    const parsed = parseProfileDetails(body.profileDetails, nextMaritalStatus)
    if (parsed.error) return NextResponse.json({ message: parsed.error }, { status: 400 })
    profileDetails = parsed.data
  }

  let currentAddress: (ReturnType<typeof parseAddress>['data'] & { areaId?: string | null }) | undefined
  if (body.currentAddress !== undefined) {
    const parsed = parseAddress(body.currentAddress)
    if (parsed.error) return NextResponse.json({ message: parsed.error }, { status: 400 })
    currentAddress = parsed.data
    // F02: the address's village / city from the location master fills the text levels.
    if (body.currentAddress?.areaId) {
      const place = await validateSettlement(body.currentAddress.areaId)
      if ('error' in place) return NextResponse.json({ message: place.error }, { status: 400 })
      const text = chainText(place.chain)
      currentAddress = { ...currentAddress!, areaId: place.chain[0].id, city: text.village, taluka: text.taluka, district: text.district, state: text.state }
    }
  }

  const physicalError = validatePhysical(body)
  if (physicalError) return NextResponse.json({ message: physicalError }, { status: 400 })

  // Fields the community has switched off (section 16) are refused outright,
  // so a stale client or a hand-built request cannot store them anyway.
  const physicalConfig = await getPhysicalFieldConfig()
  for (const f of PHYSICAL_FIELDS) {
    const v = body[f.key]
    if (!physicalConfig[f.key] && v !== undefined && v !== null && v !== '') {
      return NextResponse.json({ message: `${f.label} is not collected by this community` }, { status: 400 })
    }
  }

  let languages: string[] | undefined
  if (body.languages !== undefined) {
    if (!Array.isArray(body.languages) || body.languages.some((l: unknown) => typeof l !== 'string')) {
      return NextResponse.json({ message: 'Languages must be a list of names' }, { status: 400 })
    }
    languages = Array.from(new Set(body.languages.map((l: string) => l.trim()).filter(Boolean))).slice(0, 15) as string[]
  }

  // PATCH semantics: only touch what the caller actually sent. Treating an
  // omitted field as "set to null" silently destroys data whenever a client
  // submits a partial update — it wiped lastName and dateOfBirth during UAT.
  // An explicitly-sent empty string still clears the field, as intended.
  const set = <T>(key: string, transform: (v: any) => T) =>
    body[key] !== undefined ? { [key]: transform(body[key]) } : {}
  const text = (v: any) => (v === '' || v === null ? null : v)
  const int = (v: any) => (v === '' || v === null || v === undefined ? null : parseInt(v, 10))

  // Sensitive fields headed for approval are not written now.
  if (routeToApproval) for (const f of sensitiveKeys) delete body[f]
  const DIFF_FIELDS = ['firstName', 'middleName', 'lastName', 'gender', 'dateOfBirth', 'maritalStatus', 'mobilePrimary', 'email',
    'employmentStatus', 'occupationCategory', 'bloodGroup', 'heightCm', 'weightKg', 'bodyType', 'physicalDisability', 'biography',
    'currentCity', 'currentState', 'nativeVillage', 'nativeDistrict', 'nativeState']

  const { updated, addressResult } = await prisma.$transaction(async (tx) => {
    const updated = await tx.member.update({
      where: { id: params.id },
      data: {
        ...set('firstName', (v) => v),
        ...set('gender', (v) => v),
        ...set('maritalStatus', (v) => v),
        ...set('middleName', text),
        ...set('lastName', text),
        ...set('dateOfBirth', (v) => (v ? new Date(v) : null)),
        ...set('bloodGroup', text),
        ...set('heightCm', int),
        ...set('weightKg', int),
        ...set('bodyType', text),
        ...set('physicalDisability', text),
        ...set('mobilePrimary', (v) => (mobileChanged && v ? normalizeMobile(String(v)) : text(v))),
        ...set('email', text),
        // Addresses are owned by /api/members/[id]/addresses, which keeps these
        // flat copies in sync; they're only touched here if explicitly sent.
        ...set('currentCity', text),
        ...set('currentState', text),
        ...set('currentCountry', text),
        ...set('nativeVillage', text),
        ...set('nativeDistrict', text),
        ...set('nativeState', text),
        ...set('employmentStatus', text),
        ...set('occupationCategory', text),
        ...set('biography', text),
        ...(body.nationality !== undefined && String(body.nationality).trim()
          ? { nationality: String(body.nationality).trim() }
          : {}),
        ...(languages !== undefined ? { languages } : {}),
        updatedBy: userId,
      },
    })

    // F23: divorced / widowed marks the marriage link but keeps its history.
    if (member.maritalStatus === 'MARRIED' && ['DIVORCED', 'WIDOWED'].includes(updated.maritalStatus)) {
      const open = await tx.marriageRecord.findMany({ where: { status: 'MARRIED', OR: [{ memberId1: params.id }, { memberId2: params.id }] } })
      for (const m of open) {
        await tx.marriageRecord.update({ where: { id: m.id }, data: { status: updated.maritalStatus, dissolutionDate: new Date() } })
        const spouseId = m.memberId1 === params.id ? m.memberId2 : m.memberId1
        if (spouseId && updated.maritalStatus === 'DIVORCED') {
          await tx.member.update({ where: { id: spouseId }, data: { maritalStatus: 'DIVORCED' } })
          await tx.maritalStatusHistory.create({ data: { memberId: spouseId, status: 'DIVORCED', changedBy: userId } })
        }
      }
      await tx.maritalStatusHistory.create({ data: { memberId: params.id, status: updated.maritalStatus, changedBy: userId } })
    }

    if (occupation || (body.employmentStatus !== undefined && canonicalSocialStatus(body.employmentStatus) !== 'WORKING')) {
      const occ = occupation ?? Object.fromEntries(OCCUPATION_FIELDS.map((f) => [f, null]))
      await tx.memberProfileDetail.upsert({ where: { memberId: params.id }, update: occ, create: { memberId: params.id, ...occ } })
    }

    if (profileDetails) {
      await tx.memberProfileDetail.upsert({
        where: { memberId: params.id },
        update: profileDetails,
        create: { memberId: params.id, ...profileDetails },
      })
    } else if (nextMaritalStatus !== 'UNMARRIED') {
      // A client that only changes marital status still must not leave stale
      // Unmarried-only answers behind.
      await tx.memberProfileDetail.updateMany({ where: { memberId: params.id }, data: UNMARRIED_FLOW_RESET })
    }

    // The current address is the same record the address editor manages, so
    // it goes through the same review gate (§28). Unchanged → nothing to do.
    let addressResult: AddressChangeResult | null = null
    if (currentAddress) {
      const existing = await tx.address.findFirst({ where: { memberId: params.id, addressType: 'CURRENT' } })
      const unchanged = existing
        ? (Object.keys(currentAddress) as (keyof typeof currentAddress)[]).every((k) => (existing[k] ?? null) === currentAddress![k])
        : isAddressEmpty(currentAddress)
      if (!unchanged) {
        addressResult = await submitAddressChange(tx, {
          memberId: params.id,
          payload: { addressType: 'CURRENT', ...currentAddress },
          isStaff: access.isStaff || preApproval,
          submittedBy: userId,
        })
      }
    }

    return { updated, addressResult }
  })

  // Rule 9 / F08: every change kept with its old and new value, who and when.
  const oldValue: Record<string, unknown> = {}
  const newValue: Record<string, unknown> = {}
  for (const f of DIFF_FIELDS) {
    const before = norm(f, (member as any)[f])
    const after = norm(f, (updated as any)[f])
    if (JSON.stringify(before) !== JSON.stringify(after)) { oldValue[f] = before; newValue[f] = after }
  }
  await recordAudit({
    actorId: userId, actorRole: roles[0] ?? 'MEMBER', action: 'member.profile.update',
    entityType: 'member', entityId: params.id, oldValue, newValue,
    metadata: occupation ? { occupation } : undefined,
  }, req)

  let pendingChange = false
  if (routeToApproval) {
    const opened = await openChangeRequest({ userId, memberId: member.id, changes: sensitiveChanges })
    if (!opened.ok) return NextResponse.json({ message: opened.message }, { status: opened.status })
    pendingChange = true
  }

  return NextResponse.json({
    message: pendingChange ? 'Saved. Your change to name / date of birth / gender is waiting for operator approval.' : 'Updated',
    pendingChange,
    member: updated,
    // Lets the form tell the user their address edit is waiting on a reviewer.
    addressStatus: addressResult?.status ?? 'unchanged',
  })
}
