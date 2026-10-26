import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireActiveAccount } from '@/lib/account-state'
import { recordAudit } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'
import { areaChain, chainLevel } from '@/lib/locations'
import { storeEncrypted, sniffMime, ID_PROOF_MIME, MAX_ID_PROOF_BYTES, MissingKeyError } from '@/lib/secure-files'
import { createRound, KIND } from '@/lib/verification'
import { OFFICES } from '@/lib/organisations'

/**
 * GET — organisations: the viewer's own (any status), and the ACTIVE ones
 * (name, kind, taluka / district / state, town) to browse and ask to join.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const memberId = (session.user as any).memberId as string | null
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim()
  const mine = memberId
    ? await prisma.organisationMember.findMany({ where: { memberId, status: { in: ['ACTIVE', 'INVITED', 'REQUESTED'] } }, select: { organisationId: true, designation: true, status: true, pendingDesignation: true } })
    : []
  const applied = await prisma.organisation.findMany({ where: { applicantUserId: session.user.id }, select: { id: true } })
  const ids = Array.from(new Set([...mine.map((m) => m.organisationId), ...applied.map((a) => a.id)]))
  const [own, active] = await Promise.all([
    prisma.organisation.findMany({ where: { id: { in: ids } }, orderBy: { createdAt: 'desc' } }),
    prisma.organisation.findMany({
      where: { status: 'ACTIVE', ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) }, orderBy: [{ kind: 'asc' }, { name: 'asc' }], take: 100,
      select: { id: true, name: true, kind: true, areaId: true, purpose: true, town: true },
    }),
  ])
  const areaIds = Array.from(new Set([...own, ...active].map((o) => o.areaId).filter(Boolean) as string[]))
  const areas = new Map((await prisma.area.findMany({ where: { id: { in: areaIds } }, select: { id: true, name: true } })).map((a) => [a.id, a.name]))
  const shape = (o: any) => ({ id: o.id, name: o.name, kind: o.kind, area: o.areaId ? areas.get(o.areaId) ?? null : null, town: o.town ?? null, purpose: o.purpose, status: o.status })
  return NextResponse.json({
    mine: own.map((o) => ({ ...shape(o), membership: mine.find((m) => m.organisationId === o.id) ?? null, decisionNote: o.decisionNote })),
    organisations: active.map(shape),
  })
}

/**
 * F26 — register a local (taluka) organisation (owner's decision): name,
 * start date, taluka (from the location master), city / town, and its
 * management body — the President, Secretary and Chairman (three different
 * ACTIVE registered members) plus, optionally, other body members
 * (registered members). Everyone named is asked to accept. Registration
 * no., address, purpose and certificate are optional. Two Operators of the
 * district verify it blind (the P1 round); it is ACTIVE once both approved
 * and the three office bearers accepted, and they are then promoted to the
 * District body automatically.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const notActive = await requireActiveAccount(session.user.id)
  if (notActive) return notActive
  const applicantMemberId = (session.user as any).memberId as string | null
  if (!applicantMemberId) return NextResponse.json({ message: 'Complete your profile first' }, { status: 400 })

  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ message: 'Send the details as a form upload' }, { status: 400 }) }
  const text = (k: string) => String(form.get(k) ?? '').trim()
  const name = text('name')
  if (name.length < 3) return NextResponse.json({ message: 'Enter the organisation name' }, { status: 400 })
  const startedOn = new Date(text('startedOn'))
  if (!text('startedOn') || Number.isNaN(startedOn.getTime()) || startedOn > new Date()) {
    return NextResponse.json({ message: 'Enter the date the organisation started (not in the future)' }, { status: 400 })
  }
  // A taluka (a city may stand in for it) that sits under a district and a state.
  const taluka = text('talukaAreaId')
  const chain = taluka ? await areaChain(taluka) : []
  if (!chain.length || !['TALUKA', 'CITY'].includes(chain[0].type) || !chainLevel(chain, 'DISTRICT') || !chainLevel(chain, 'STATE')) {
    return NextResponse.json({ message: 'Choose the taluka from the list' }, { status: 400 })
  }
  const town = text('town')
  if (!town) return NextResponse.json({ message: 'Enter the city / town' }, { status: 400 })

  const officers: Record<string, string> = {}
  for (const office of OFFICES) officers[office] = text(office.toLowerCase() + 'MemberId')
  const officerIds = Object.values(officers)
  if (officerIds.some((v) => !v) || new Set(officerIds).size !== OFFICES.length) {
    return NextResponse.json({ message: 'Name three different people as President, Secretary and Chairman' }, { status: 400 })
  }
  // Other members of the management body (optional).
  const extraIds = Array.from(new Set(form.getAll('bodyMemberIds').map((v) => String(v).trim()).filter((v) => v && !officerIds.includes(v))))
  const people = await prisma.member.findMany({
    where: { id: { in: [...officerIds, ...extraIds] }, deletedAt: null, status: 'ACTIVE', user: { status: 'ACTIVE' } }, select: { id: true, userId: true },
  })
  if (people.length !== officerIds.length + extraIds.length) return NextResponse.json({ message: 'The management body must be active registered members' }, { status: 400 })

  let certificateKey: string | null = null
  let mime: string | null = null
  const cert = form.get('certificate')
  if (cert && typeof cert !== 'string' && (cert as File).size > 0) {
    const buf = Buffer.from(await (cert as File).arrayBuffer())
    if (buf.length > MAX_ID_PROOF_BYTES) return NextResponse.json({ message: 'The certificate must be 5 MB or smaller' }, { status: 400 })
    mime = sniffMime(buf)
    if (!mime || !ID_PROOF_MIME.includes(mime)) return NextResponse.json({ message: 'Upload the certificate as a JPG, PNG, WebP image or a PDF' }, { status: 400 })
    try {
      certificateKey = await storeEncrypted('organisations', buf)
    } catch (e) {
      if (e instanceof MissingKeyError) return NextResponse.json({ message: 'File storage is not configured. Contact the administrator.' }, { status: 503 })
      throw e
    }
  }

  const actorId = session.user.id
  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organisation.create({
      data: {
        kind: 'LOCAL', name, registrationNumber: text('registrationNumber') || null, addressLine: text('addressLine') || null,
        areaId: taluka, startedOn, town, purpose: text('purpose') || null, certificateKey, certificateMime: mime, status: 'PENDING_APPROVAL', applicantUserId: actorId,
      },
    })
    for (const office of OFFICES) {
      const memberId = officers[office]
      // The applicant naming themselves accepts at once.
      const self = memberId === applicantMemberId
      await tx.organisationMember.create({
        data: { organisationId: created.id, memberId, designation: office, status: self ? 'ACTIVE' : 'INVITED', invitedBy: actorId, joinedAt: self ? new Date() : null },
      })
    }
    for (const memberId of extraIds) {
      const self = memberId === applicantMemberId
      await tx.organisationMember.create({ data: { organisationId: created.id, memberId, status: self ? 'ACTIVE' : 'INVITED', invitedBy: actorId, joinedAt: self ? new Date() : null } })
    }
    if (!officerIds.includes(applicantMemberId) && !extraIds.includes(applicantMemberId)) {
      await tx.organisationMember.create({ data: { organisationId: created.id, memberId: applicantMemberId, status: 'ACTIVE', invitedBy: actorId, joinedAt: new Date() } })
    }
    await recordAudit({
      actorId, action: 'organisation.register', entityType: 'organisation', entityId: created.id,
      newValue: { name, taluka, town, startedOn, officers, bodyMemberIds: extraIds, registrationNumber: created.registrationNumber },
    }, req, tx)
    return created
  })

  for (const p of people) {
    if (p.id === applicantMemberId || !p.userId) continue
    const office = Object.entries(officers).find(([, id]) => id === p.id)?.[0] ?? 'MEMBER'
    await notifyUser({
      userId: p.userId, type: 'ORGANISATION_INVITE', title: office === 'MEMBER' ? `You are named a member of ${name}` : `You are nominated ${office.toLowerCase()} of ${name}`,
      body: 'Accept or decline on the Organisations page.', data: { organisationId: org.id },
    })
  }
  await createRound({ kind: KIND.ORGANISATION, subjectUserId: actorId, subjectMemberId: applicantMemberId, organisationId: org.id, round: 1 })
  return NextResponse.json({ message: 'Submitted. Two Operators will verify it; the office bearers must accept.', organisationId: org.id }, { status: 201 })
}
