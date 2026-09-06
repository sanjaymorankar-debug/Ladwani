import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redactMemberForViewer } from '@/lib/visibility'
import { getMemberAccess } from '@/lib/member-auth'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const member = await prisma.member.findUnique({
    where: { id: params.id, deletedAt: null },
    include: {
      education: true,
      employment: { include: { incomeRange: true } },
      businesses: true,
      skills: { include: { skill: true } },
    },
  })
  if (!member) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  return NextResponse.json(await redactMemberForViewer(session, member))
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const userId = session.user?.id as string
  const body = await req.json()

  const member = await prisma.member.findUnique({ where: { id: params.id }, include: { user: true } })
  if (!member) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  const roles: string[] = (session.user as any)?.roles ?? []
  // Single source of truth for "who may edit this member" — self, staff, or
  // the Karta of an account-less family member. See member-auth.ts.
  const access = await getMemberAccess(session, params.id)
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  // Marrying someone links two people's records and the family tree, so it
  // always goes through the dedicated /spouse endpoint (which applies the
  // approval gate). Every other marital-status value is a simple field edit.
  if (body.maritalStatus === 'MARRIED' && member.maritalStatus !== 'MARRIED') {
    return NextResponse.json(
      { message: "To set status to Married, use the spouse-linking flow so the relationship can be recorded." },
      { status: 400 }
    )
  }

  // PATCH semantics: only touch what the caller actually sent. Treating an
  // omitted field as "set to null" silently destroys data whenever a client
  // submits a partial update — it wiped lastName and dateOfBirth during UAT.
  // An explicitly-sent empty string still clears the field, as intended.
  const set = <T>(key: string, transform: (v: any) => T) =>
    body[key] !== undefined ? { [key]: transform(body[key]) } : {}
  const text = (v: any) => (v === '' || v === null ? null : v)
  const int = (v: any) => (v === '' || v === null || v === undefined ? null : parseInt(v, 10))

  const updated = await prisma.member.update({
    where: { id: params.id },
    data: {
      ...set('firstName', (v) => v),
      ...set('gender', (v) => v),
      ...set('maritalStatus', (v) => v),
      ...set('middleName', text),
      ...set('lastName', text),
      ...set('dateOfBirth', (v) => (v ? new Date(v) : null)),
      ...set('bloodGroup', text),
      ...set('heightCm', int),
      ...set('weightKg', int),
      ...set('bodyType', text),
      ...set('physicalDisability', text),
      ...set('mobilePrimary', text),
      ...set('email', text),
      // Addresses are owned by /api/members/[id]/addresses, which keeps these
      // flat copies in sync; they're only touched here if explicitly sent.
      ...set('currentCity', text),
      ...set('currentState', text),
      ...set('currentCountry', text),
      ...set('nativeVillage', text),
      ...set('nativeDistrict', text),
      ...set('nativeState', text),
      ...set('employmentStatus', text),
      ...set('occupationCategory', text),
      ...set('biography', text),
      updatedBy: userId,
    },
  })

  await prisma.auditLog.create({
    data: {
      actorId: userId,
      actorRole: roles[0] ?? 'MEMBER',
      action: 'member.profile.update',
      entityType: 'member',
      entityId: params.id,
    },
  })

  return NextResponse.json({ message: 'Updated', member: updated })
}
