import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function isAdmin(session: any) {
  const roles: string[] = session?.user?.roles ?? []
  return roles.includes('ADMIN') || roles.includes('OPERATOR')
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!isAdmin(session)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const { status } = await req.json()
  if (status !== 'DECLINED') {
    return NextResponse.json({ message: 'Admin can only reject (decline) a pending request' }, { status: 400 })
  }

  const joinRequest = await prisma.familyJoinRequest.findUnique({ where: { id: params.id } })
  if (!joinRequest) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (joinRequest.status !== 'PENDING') {
    return NextResponse.json({ message: 'Only pending requests can be rejected' }, { status: 409 })
  }

  const updated = await prisma.familyJoinRequest.update({
    where: { id: params.id },
    data: { status: 'DECLINED', respondedAt: new Date() },
  })

  return NextResponse.json({ joinRequest: updated })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!isAdmin(session)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const joinRequest = await prisma.familyJoinRequest.findUnique({ where: { id: params.id } })
  if (!joinRequest) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  await prisma.familyJoinRequest.delete({ where: { id: params.id } })
  return NextResponse.json({ message: 'Deleted' })
}
