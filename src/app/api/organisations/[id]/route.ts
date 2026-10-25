import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'
import { canManageOrganisation, canAppointBodyOffice, targetBodyFor, PROMOTED_PER_UNIT } from '@/lib/organisations'

async function involvement(session: any, id: string) {
  const roles = (session?.user?.roles ?? []) as string[]
  const memberId = session?.user?.memberId as string | null
  const org = await prisma.organisation.findUnique({ where: { id } })
  if (!org) return { org: null, full: false }
  const mine = memberId ? await prisma.organisationMember.findUnique({ where: { organisationId_memberId: { organisationId: id, memberId } } }) : null
  const operatorTask = roles.includes('OPERATOR')
    ? await prisma.approvalTask.findFirst({ where: { organisationId: id, operatorUserId: session.user.id, supersededAt: null } })
    : null
  const full = roles.includes('ADMIN') || org.applicantUserId === session?.user?.id || (!!mine && mine.status !== 'ENDED') || !!operatorTask
  return { org, full, mine }
}

/**
 * Organisation page. Members, the applicant, Admins and the Operators
 * verifying it see the member list (with each person's town); anyone else
 * sees an ACTIVE organisation's summary (name, taluka, town, start date,
 * office bearers).
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const { org, full, mine } = await involvement(session, params.id)
  if (!org || (!full && org.status !== 'ACTIVE')) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  const rows = await prisma.organisationMember.findMany({
    where: { organisationId: org.id, status: full ? { not: 'DECLINED' } : 'ACTIVE', ...(full ? {} : { designation: { not: 'MEMBER' } }) },
    orderBy: [{ designation: 'asc' }, { createdAt: 'asc' }],
    select: { memberId: true, designation: true, pendingDesignation: true, status: true, termStart: true, termEnd: true, seatId: true, endedAt: true, endReason: true,
      createdAt: true },
  })
  const people = new Map((await prisma.member.findMany({ where: { id: { in: rows.map((r) => r.memberId) } }, select: { id: true, firstName: true, lastName: true, currentCity: true } }))
    .map((m) => [m.id, { name: [m.firstName, m.lastName].filter(Boolean).join(' '), town: m.currentCity }]))
  const area = org.areaId ? await prisma.area.findUnique({ where: { id: org.areaId }, select: { name: true } }) : null
  const base = { id: org.id, name: org.name, kind: org.kind, status: org.status, area: area?.name ?? null, purpose: org.purpose, town: org.town, startedOn: org.startedOn }
  const members = rows.map((r) => ({ ...r, name: people.get(r.memberId)?.name ?? '', town: people.get(r.memberId)?.town ?? null }))
  if (!full) return NextResponse.json({ organisation: base, members, full: false })

  // F28–F30: who this unit's office bearers represent it on, automatically.
  const [seatsOut, target] = await Promise.all([
    prisma.bodySeat.findMany({ where: { fromOrganisationId: org.id, status: { in: ['ACCEPTED', 'CONFIRMED'] } }, orderBy: { createdAt: 'asc' } }),
    org.status === 'ACTIVE' && org.kind !== 'NATIONAL_BODY' ? targetBodyFor(org.id).catch(() => null) : null,
  ])
  const seatPeople = new Map((await prisma.member.findMany({ where: { id: { in: seatsOut.map((s) => s.memberId) } }, select: { id: true, firstName: true, lastName: true } }))
    .map((m) => [m.id, [m.firstName, m.lastName].filter(Boolean).join(' ')]))
  return NextResponse.json({
    organisation: { ...base, registrationNumber: org.registrationNumber, addressLine: org.addressLine, areaId: org.areaId, decisionNote: org.decisionNote, approvedAt: org.approvedAt, hasCertificate: !!org.certificateKey },
    members, full: true, me: mine ?? null,
    canManage: await canManageOrganisation(session, org.id),
    canAppoint: await canAppointBodyOffice(session, org),
    promotion: {
      target: target ? { id: target.id, name: target.name } : null, perUnit: PROMOTED_PER_UNIT,
      seats: seatsOut.map((s) => ({ id: s.id, memberId: s.memberId, name: seatPeople.get(s.memberId) ?? '', toOrganisationId: s.toOrganisationId })),
    },
  })
}

/** F26: the applicant corrects details after a send-back (then resubmits). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const org = await prisma.organisation.findUnique({ where: { id: params.id } })
  if (!org || org.applicantUserId !== session.user.id) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (org.status !== 'CORRECTION_REQUIRED') return NextResponse.json({ message: 'Details can be changed only when a correction is asked for' }, { status: 409 })
  const body = await req.json().catch(() => ({}))
  const data: Record<string, string | Date | null> = {}
  for (const k of ['name', 'registrationNumber', 'addressLine', 'purpose', 'town'] as const) {
    if (body[k] !== undefined) data[k] = String(body[k] ?? '').trim() || null
  }
  if (data.name !== undefined && (!data.name || String(data.name).length < 3)) return NextResponse.json({ message: 'Enter the organisation name' }, { status: 400 })
  if (data.town !== undefined && !data.town) return NextResponse.json({ message: 'Enter the city / town' }, { status: 400 })
  if (body.startedOn !== undefined) {
    const d = new Date(String(body.startedOn))
    if (Number.isNaN(d.getTime()) || d > new Date()) return NextResponse.json({ message: 'Enter a valid start date (not in the future)' }, { status: 400 })
    data.startedOn = d
  }
  const updated = await prisma.organisation.update({ where: { id: org.id }, data: data as any })
  await recordAudit({ actorId: session.user.id, action: 'organisation.update', entityType: 'organisation', entityId: org.id,
    oldValue: Object.fromEntries(Object.keys(data).map((k) => [k, (org as any)[k]])), newValue: data }, req)
  return NextResponse.json({ message: 'Saved', organisation: { id: updated.id } })
}
