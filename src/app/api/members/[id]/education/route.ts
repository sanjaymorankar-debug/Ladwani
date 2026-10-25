import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMemberAccess } from '@/lib/member-auth'

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  if (!body.qualification && !body.level) {
    return NextResponse.json({ message: 'Qualification or level is required' }, { status: 400 })
  }

  const record = await prisma.$transaction(async (tx) => {
    if (body.isHighest) {
      await tx.educationRecord.updateMany({ where: { memberId: params.id }, data: { isHighest: false } })
    }
    return tx.educationRecord.create({
      data: {
        memberId: params.id,
        level: body.level || null,
        qualification: body.qualification || null,
        specialization: body.specialization || null,
        institution: body.institution || null,
        // F02 education rows: university and grade.
        university: body.university || null,
        grade: body.grade || null,
        yearCompleted: body.yearCompleted ? parseInt(body.yearCompleted) : null,
        isHighest: !!body.isHighest,
        isOngoing: !!body.isOngoing,
      },
    })
  })

  return NextResponse.json({ message: 'Education record added', record }, { status: 201 })
}
