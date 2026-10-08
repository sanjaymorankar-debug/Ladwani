import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMemberAccess } from '@/lib/member-auth'
import { validatePincode } from '@/lib/validators'
import { submitAddressChange, type AddressChangePayload } from '@/lib/approvals'
import { validateCoordinates } from '@/lib/profile-details'

const ALLOWED_TYPES = ['CURRENT', 'NATIVE']

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const addresses = await prisma.address.findMany({
    where: { memberId: params.id, addressType: { in: ALLOWED_TYPES } },
  })
  return NextResponse.json({ addresses })
}

// Upsert-by-type: a member has at most one CURRENT and one NATIVE address row.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const addressType = body.addressType as string
  if (!ALLOWED_TYPES.includes(addressType)) {
    return NextResponse.json({ message: 'addressType must be CURRENT or NATIVE' }, { status: 400 })
  }

  const pinError = validatePincode(body.pincode, body.country || 'India')
  if (pinError) return NextResponse.json({ message: pinError }, { status: 400 })

  const geoError = validateCoordinates(body.latitude, body.longitude)
  if ((body.latitude !== undefined || body.longitude !== undefined) && geoError) return NextResponse.json({ message: geoError.message }, { status: 400 })

  const payload: AddressChangePayload = {
    addressType: addressType as 'CURRENT' | 'NATIVE',
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

  const result = await prisma.$transaction((tx) =>
    submitAddressChange(tx, { memberId: params.id, payload, isStaff: access.isStaff, submittedBy: session!.user!.id as string })
  )
  if (result.status === 'already_pending') {
    return NextResponse.json({ message: 'An address change for this member is already awaiting review' }, { status: 409 })
  }
  if (result.status === 'pending') {
    return NextResponse.json({ message: 'Address change submitted for review.', pendingApproval: true }, { status: 202 })
  }
  return NextResponse.json({ message: 'Address saved', address: result.address })
}
