import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMemberAccess } from '@/lib/member-auth'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  if (!body.businessName) return NextResponse.json({ message: 'Business name is required' }, { status: 400 })

  const record = await prisma.business.create({
    data: {
      memberId: params.id,
      businessName: body.businessName,
      businessType: body.businessType || null,
      industry: body.industry || null,
      city: body.city || null,
      country: body.country || null,
      description: body.description || null,
      website: body.website || null,
      establishedYear: body.establishedYear ? parseInt(body.establishedYear) : null,
      isActive: body.isActive ?? true,
    },
  })

  return NextResponse.json({ message: 'Business added', record }, { status: 201 })
}
