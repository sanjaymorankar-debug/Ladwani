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

  const record = await prisma.$transaction(async (tx) => {
    if (body.isCurrent) {
      await tx.employmentRecord.updateMany({ where: { memberId: params.id, isCurrent: true }, data: { isCurrent: false, endDate: new Date() } })
    }
    return tx.employmentRecord.create({
      data: {
        memberId: params.id,
        employmentType: body.employmentType || null,
        employerName: body.employerName || null,
        designation: body.designation || null,
        industry: body.industry || null,
        city: body.city || null,
        country: body.country || null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.isCurrent ? null : (body.endDate ? new Date(body.endDate) : null),
        isCurrent: body.isCurrent ?? true,
      },
    })
  })

  return NextResponse.json({ message: 'Employment record added', record }, { status: 201 })
}
