import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PHYSICAL_FIELDS, PHYSICAL_FIELDS_SETTING_KEY, getPhysicalFieldConfig } from '@/lib/physical-fields'

/** Any signed-in user may read which fields are enabled (the profile form needs it). */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ config: await getPhysicalFieldConfig() })
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  const roles: string[] = (session?.user as any)?.roles ?? []
  if (!session?.user?.id || !roles.includes('ADMIN')) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const next = { ...(await getPhysicalFieldConfig()) }
  for (const f of PHYSICAL_FIELDS) if (typeof body[f.key] === 'boolean') next[f.key] = body[f.key]

  await prisma.setting.upsert({
    where: { key: PHYSICAL_FIELDS_SETTING_KEY },
    update: { value: next, updatedBy: session.user.id as string },
    create: {
      key: PHYSICAL_FIELDS_SETTING_KEY, value: next,
      description: 'Which optional physical fields members can fill in', updatedBy: session.user.id as string,
    },
  })
  await prisma.auditLog.create({
    data: {
      actorId: session.user.id as string, actorRole: 'ADMIN', action: 'settings.physical_fields.update',
      entityType: 'setting', entityId: PHYSICAL_FIELDS_SETTING_KEY, newValue: next,
    },
  })
  return NextResponse.json({ config: next })
}
