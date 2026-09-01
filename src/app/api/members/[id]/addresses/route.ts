import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMemberAccess } from '@/lib/member-auth'

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

  const existing = await prisma.address.findFirst({ where: { memberId: params.id, addressType } })

  const data = {
    line1: body.line1 || null,
    line2: body.line2 || null,
    city: body.city || null,
    district: body.district || null,
    state: body.state || null,
    country: body.country || 'India',
    pincode: body.pincode || null,
    isPrimary: addressType === 'CURRENT',
  }

  const [address] = await prisma.$transaction([
    existing
      ? prisma.address.update({ where: { id: existing.id }, data })
      : prisma.address.create({ data: { ...data, addressableType: 'member', memberId: params.id, addressType } }),
    // Keep the flat Member fields in sync — several existing pages (family
    // cards, member directory) render those directly rather than joining
    // Address, and shouldn't go blank just because editing moved here.
    addressType === 'CURRENT'
      ? prisma.member.update({
          where: { id: params.id },
          data: { currentCity: data.city, currentState: data.state, currentCountry: data.country },
        })
      : prisma.member.update({
          where: { id: params.id },
          data: { nativeVillage: data.city, nativeDistrict: data.district, nativeState: data.state },
        }),
  ])

  return NextResponse.json({ message: 'Address saved', address })
}
