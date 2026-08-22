import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const fromMemberId = session?.user?.memberId
  if (!fromMemberId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { toMemberId, message } = await req.json()
  if (!toMemberId) return NextResponse.json({ message: 'toMemberId required' }, { status: 400 })
  if (toMemberId === fromMemberId) {
    return NextResponse.json({ message: 'You cannot send interest to yourself' }, { status: 400 })
  }

  const existing = await prisma.matrimonialInterest.findFirst({
    where: { fromMemberId, toMemberId, status: 'PENDING' },
  })
  if (existing) return NextResponse.json({ message: 'Interest already sent' }, { status: 409 })

  const interest = await prisma.matrimonialInterest.create({
    data: { fromMemberId, toMemberId, message: message || null },
  })

  return NextResponse.json({ interest }, { status: 201 })
}
