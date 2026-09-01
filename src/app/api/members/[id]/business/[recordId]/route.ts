import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMemberAccess } from '@/lib/member-auth'

export async function DELETE(req: Request, { params }: { params: { id: string; recordId: string } }) {
  const session = await getServerSession(authOptions)
  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const record = await prisma.business.findUnique({ where: { id: params.recordId } })
  if (!record || record.memberId !== params.id) {
    return NextResponse.json({ message: 'Record not found' }, { status: 404 })
  }

  await prisma.business.delete({ where: { id: params.recordId } })
  return NextResponse.json({ message: 'Deleted' })
}
