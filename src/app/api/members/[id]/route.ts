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

  let currentAddress: ReturnType<typeof parseAddress>['data']
  if (body.currentAddress !== undefined) {
    const parsed = parseAddress(body.currentAddress)
    if (parsed.error) return NextResponse.json({ message: parsed.error }, { status: 400 })
    currentAddress = parsed.data
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
          isStaff: access.isStaff,
          submittedBy: userId,
        })
      }
    }

    return { updated, addressResult }
  })

  await prisma.auditLog.create({
    data: {
      actorId: userId,
      actorRole: roles[0] ?? 'MEMBER',
      action: 'member.profile.update',
      entityType: 'member',
      entityId: params.id,
    },
  })

  return NextResponse.json({
    message: 'Updated',
    member: updated,
    // Lets the form tell the user their address edit is waiting on a reviewer.
    addressStatus: addressResult?.status ?? 'unchanged',
  })
}
