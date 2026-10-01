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

export async function PATCH(req: Request, { params }: { params: { id: string; recordId: string } }) {
  const session = await getServerSession(authOptions)
  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const record = await prisma.business.findUnique({ where: { id: params.recordId } })
  if (!record || record.memberId !== params.id) {
    return NextResponse.json({ message: 'Record not found' }, { status: 404 })
  }

  const body = await req.json()
  if (body.businessName !== undefined && !String(body.businessName).trim()) {
    return NextResponse.json({ message: 'Business name is required' }, { status: 400 })
  }
  const year = body.establishedYear
  if (year !== undefined && year !== '' && year !== null) {
    const y = parseInt(year, 10)
    if (!Number.isInteger(y) || y < 1800 || y > new Date().getFullYear()) {
      return NextResponse.json({ message: 'Enter a valid established year' }, { status: 400 })
    }
  }

  const text = (v: any) => (v === '' || v === null ? null : v)
  const set = (key: string, f: (v: any) => any) => (body[key] !== undefined ? { [key]: f(body[key]) } : {})
  const updated = await prisma.business.update({
    where: { id: params.recordId },
    data: {
      ...set('businessName', (v) => String(v).trim()),
      ...set('businessType', text),
      ...set('industry', text),
      ...set('city', text),
      ...set('country', text),
      ...set('description', text),
      ...set('website', text),
      ...set('establishedYear', (v) => (v === '' || v === null ? null : parseInt(v, 10))),
      ...set('isActive', (v) => !!v),
    },
  })
  return NextResponse.json({ message: 'Business updated', record: updated })
}
