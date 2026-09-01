import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMemberAccess } from '@/lib/member-auth'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const [overrides, defaults] = await Promise.all([
    prisma.memberFieldVisibility.findMany({ where: { memberId: params.id } }),
    prisma.fieldVisibilityDefault.findMany({ where: { entityType: 'member' } }),
  ])

  const settings: Record<string, string> = {}
  for (const d of defaults) settings[d.fieldName] = d.defaultVisibility
  for (const o of overrides) settings[o.fieldName] = o.visibility

  return NextResponse.json({ settings })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const settings = body.settings as Record<string, string> | undefined
  if (!settings || typeof settings !== 'object') {
    return NextResponse.json({ message: 'settings object is required' }, { status: 400 })
  }

  await prisma.$transaction(
    Object.entries(settings).map(([fieldName, visibility]) =>
      prisma.memberFieldVisibility.upsert({
        where: { memberId_fieldName: { memberId: params.id, fieldName } },
        update: { visibility },
        create: { memberId: params.id, fieldName, visibility },
      })
    )
  )

  return NextResponse.json({ message: 'Privacy settings saved' })
}
