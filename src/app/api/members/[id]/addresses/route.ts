import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMemberAccess } from '@/lib/member-auth'
import { validatePincode } from '@/lib/validators'
import { submitAddressChange, type AddressChangePayload } from '@/lib/approvals'
import { validateCoordinates } from '@/lib/profile-details'
import { validateSettlement, chainText } from '@/lib/locations'
import { REGISTRATION_STATUSES } from '@/lib/account-state'

// F02 adds PERMANENT (with a 'same as current' tick).
const ALLOWED_TYPES = ['CURRENT', 'NATIVE', 'PERMANENT']

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const addresses = await prisma.address.findMany({
    where: { memberId: params.id, addressType: { in: ALLOWED_TYPES } },
  })
  return NextResponse.json({ addresses })
}

// Upsert-by-type: a member has at most one CURRENT, one NATIVE and one PERMANENT address row.
export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const addressType = body.addressType as string
  if (!ALLOWED_TYPES.includes(addressType)) {
    return NextResponse.json({ message: 'addressType must be CURRENT, NATIVE or PERMANENT' }, { status: 400 })
  }

  // F02 "Same as current address": copy the CURRENT row into PERMANENT.
  if (addressType === 'PERMANENT' && body.sameAsCurrent === true) {
    const current = await prisma.address.findFirst({ where: { memberId: params.id, addressType: 'CURRENT' } })
    if (!current) return NextResponse.json({ message: 'Save your current address first' }, { status: 400 })
    Object.assign(body, {
      line1: current.line1, line2: current.line2, city: current.city, taluka: current.taluka, district: current.district,
      state: current.state, country: current.country, pincode: current.pincode, areaId: current.areaId,
      latitude: current.latitude, longitude: current.longitude,
    })
  }

  // F02: a village / city from the location master fills the text levels.
  let areaId: string | null | undefined
  if (body.areaId) {
    const place = await validateSettlement(body.areaId)
    if ('error' in place) return NextResponse.json({ message: place.error }, { status: 400 })
    const text = chainText(place.chain)
    areaId = place.chain[0].id
    Object.assign(body, { city: text.village, taluka: text.taluka, district: text.district, state: text.state })
  } else if (body.areaId === null) {
    areaId = null
  }

  const pinError = validatePincode(body.pincode, body.country || 'India')
  if (pinError) return NextResponse.json({ message: pinError }, { status: 400 })

  const geoError = validateCoordinates(body.latitude, body.longitude)
  if ((body.latitude !== undefined || body.longitude !== undefined) && geoError) return NextResponse.json({ message: geoError.message }, { status: 400 })

  const payload: AddressChangePayload = {
    addressType: addressType as 'CURRENT' | 'NATIVE' | 'PERMANENT',
    ...(areaId !== undefined ? { areaId } : {}),
    ...(addressType === 'PERMANENT' ? { sameAsCurrent: body.sameAsCurrent === true } : {}),
    line1: body.line1 || null,
    line2: body.line2 || null,
    city: body.city || null,
    district: body.district || null,
    state: body.state || null,
    country: body.country || 'India',
    pincode: body.pincode || null,
    // Optional extras; left untouched when the caller doesn't send them.
    ...(body.taluka !== undefined ? { taluka: body.taluka || null } : {}),
    ...(body.latitude !== undefined ? { latitude: body.latitude === null || body.latitude === '' ? null : Number(body.latitude) } : {}),
    ...(body.longitude !== undefined ? { longitude: body.longitude === null || body.longitude === '' ? null : Number(body.longitude) } : {}),
  }

  // A member not yet verified is still filling in their profile: direct save.
  const owner = await prisma.member.findUnique({ where: { id: params.id }, select: { user: { select: { status: true } } } })
  const preApproval = !!owner?.user && (REGISTRATION_STATUSES as readonly string[]).includes(owner.user.status)
  const result = await prisma.$transaction((tx) =>
    submitAddressChange(tx, { memberId: params.id, payload, isStaff: access.isStaff || preApproval, submittedBy: session!.user!.id as string })
  )
  if (result.status === 'already_pending') {
    return NextResponse.json({ message: 'An address change for this member is already awaiting review' }, { status: 409 })
  }
  if (result.status === 'pending') {
    return NextResponse.json({ message: 'Address change submitted for review.', pendingApproval: true }, { status: 202 })
  }
  return NextResponse.json({ message: 'Address saved', address: result.address })
}
