import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMemberAccess } from '@/lib/member-auth'
import { validatePincode } from '@/lib/validators'
import { requiresApproval, createApprovalRecord, applyAddressChange } from '@/lib/approvals'

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

  const data = {
    line1: body.line1 || null,
    line2: body.line2 || null,
    city: body.city || null,
    district: body.district || null,
    state: body.state || null,
    country: body.country || 'India',
    pincode: body.pincode || null,
  }
  const payload = { addressType: addressType as 'CURRENT' | 'NATIVE', ...data }
  const existing = await prisma.address.findFirst({ where: { memberId: params.id, addressType } })

  // First-time entry is always direct. Changing an address that is already on
  // record is gated (§28) unless staff make the change themselves; a pending
  // request blocks a second one so reviewers never see a stale queue.
  if (existing && !access.isStaff && (await requiresApproval('member.address.change'))) {
    const pending = await prisma.approval.findFirst({
      where: { actionCode: 'member.address.change', entityId: params.id, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
    })
    if (pending) {
      return NextResponse.json({ message: 'An address change for this member is already awaiting review' }, { status: 409 })
    }
    await prisma.$transaction((tx) =>
      createApprovalRecord(tx, {
        actionCode: 'member.address.change', entityType: 'member', entityId: params.id,
        fieldName: addressType, oldValue: { line1: existing.line1, city: existing.city, state: existing.state, pincode: existing.pincode },
        newValue: payload, submittedBy: session!.user!.id as string,
      })
    )
    return NextResponse.json({ message: 'Address change submitted for review.', pendingApproval: true }, { status: 202 })
  }

  const address = await prisma.$transaction((tx) => applyAddressChange(tx, params.id, payload))
  return NextResponse.json({ message: 'Address saved', address })
}
