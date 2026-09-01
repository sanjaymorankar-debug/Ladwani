import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMemberAccess } from '@/lib/member-auth'

async function checkAccess(memberId: string) {
  const session = await getServerSession(authOptions)
  const access = await getMemberAccess(session, memberId)
  return access
}

export async function PATCH(req: Request, { params }: { params: { id: string; recordId: string } }) {
  const access = await checkAccess(params.id)
  if (!access.exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const record = await prisma.educationRecord.findUnique({ where: { id: params.recordId } })
  if (!record || record.memberId !== params.id) {
    return NextResponse.json({ message: 'Record not found' }, { status: 404 })
  }

  const body = await req.json()

  const updated = await prisma.$transaction(async (tx) => {
    if (body.isHighest) {
      await tx.educationRecord.updateMany({ where: { memberId: params.id }, data: { isHighest: false } })
    }
    return tx.educationRecord.update({
      where: { id: params.recordId },
      data: {
        level: body.level ?? record.level,
        qualification: body.qualification ?? record.qualification,
        specialization: body.specialization ?? record.specialization,
        institution: body.institution ?? record.institution,
        yearCompleted: body.yearCompleted ? parseInt(body.yearCompleted) : record.yearCompleted,
        isHighest: body.isHighest ?? record.isHighest,
        isOngoing: body.isOngoing ?? record.isOngoing,
      },
    })
  })

  return NextResponse.json({ message: 'Updated', record: updated })
}

export async function DELETE(req: Request, { params }: { params: { id: string; recordId: string } }) {
  const access = await checkAccess(params.id)
  if (!access.exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const record = await prisma.educationRecord.findUnique({ where: { id: params.recordId } })
  if (!record || record.memberId !== params.id) {
    return NextResponse.json({ message: 'Record not found' }, { status: 404 })
  }

  await prisma.educationRecord.delete({ where: { id: params.recordId } })
  return NextResponse.json({ message: 'Deleted' })
}
