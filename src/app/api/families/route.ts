import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { raiseFamilyRegistrationInvoice } from '@/lib/fees'
import { requireActiveAccount } from '@/lib/account-state'
import { kartaFamilyOf } from '@/lib/family-rules'
import { validateSettlement, chainText } from '@/lib/locations'
import { recordAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20')))
  const q = url.searchParams.get('q')

  // F14: search by family name, Karta name, Mul Gaon, Gotra or district.
  const where: any = { status: { in: ['ACTIVE', 'KARTA_VACANT'] }, deletedAt: null }
  const and: any[] = []
  if (q) {
    and.push({ OR: [
      { name: { contains: q } },
      { surname: { contains: q } },
      { nativeVillage: { contains: q } },
      { karta: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }] } },
    ] })
  }
  const gotra = url.searchParams.get('gotra')
  if (gotra) and.push({ gotra: { contains: gotra } })
  const district = url.searchParams.get('district')
  if (district) and.push({ nativeDistrict: { contains: district } })
  const kartaName = url.searchParams.get('karta')
  if (kartaName) and.push({ karta: { OR: [{ firstName: { contains: kartaName } }, { lastName: { contains: kartaName } }] } })
  const mulGaon = url.searchParams.get('mulGaon')
  if (mulGaon) and.push({ nativeVillage: { contains: mulGaon } })
  if (and.length) where.AND = and

  const [families, total] = await Promise.all([
    prisma.family.findMany({
      where,
      // F14: only a limited summary before joining — no addresses, no description.
      select: {
        id: true, registrationNumber: true, name: true, surname: true, gotra: true, kuladevata: true,
        nativeVillage: true, nativeDistrict: true, nativeState: true, status: true,
        karta: { select: { firstName: true, lastName: true } },
        _count: { select: { members: { where: { leftAt: null } } } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: 'asc' },
    }),
    prisma.family.count({ where }),
  ])

  return NextResponse.json({ families, total, page, limit })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // F01: a DRAFT / unapproved account may only fill in its own profile.
  const notActive = await requireActiveAccount(session.user?.id as string)
  if (notActive) return notActive

  const memberId = (session.user as any).memberId as string | null
  if (!memberId) {
    return NextResponse.json({ error: 'Your member profile could not be found. Please contact support.' }, { status: 400 })
  }

  const body = await req.json()
  if (!body.name) return NextResponse.json({ error: 'Family name is required' }, { status: 400 })

  // F09: a person can be Karta of only one family — but a member of many
  // (rule 1), so belonging to other families is no longer a bar.
  if (await kartaFamilyOf(memberId)) {
    return NextResponse.json({ error: 'You are already the Karta of a family. Hand that over first (F16) to head another.' }, { status: 409 })
  }

  // F09 step 2: Mul Gaon from the location master (optional for older clients).
  let native: { village: string | null; district: string | null; state: string | null } | null = null
  let mulGaonAreaId: string | null = null
  if (body.mulGaonAreaId) {
    const place = await validateSettlement(body.mulGaonAreaId)
    if ('error' in place) return NextResponse.json({ error: place.error }, { status: 400 })
    native = chainText(place.chain)
    mulGaonAreaId = place.chain[0].id
  }
  const nativeVillage = native?.village ?? body.nativeVillage ?? null

  // F09 step 3: same surname + Mul Gaon + Gotra looks like a family already
  // on the site. Show the matches; the user confirms to go ahead.
  const surname = (body.surname ?? body.name ?? '').trim()
  if (!body.confirmNotDuplicate && surname && nativeVillage && body.gotra) {
    const matches = await prisma.family.findMany({
      where: {
        deletedAt: null,
        OR: [{ surname: { equals: surname } }, { name: { equals: surname } }],
        nativeVillage: { equals: nativeVillage },
        gotra: { equals: body.gotra },
      },
      select: { id: true, registrationNumber: true, name: true, gotra: true, nativeVillage: true, karta: { select: { firstName: true, lastName: true } } },
      take: 5,
    })
    if (matches.length) {
      return NextResponse.json({
        error: 'A family with the same surname, Mul Gaon and Gotra is already registered. Ask to join it, or confirm this is a different family.',
        possibleDuplicates: matches,
      }, { status: 409 })
    }
  }

  const family = await prisma.$transaction(async (tx) => {
    const created = await tx.family.create({
      data: {
        registrationNumber: `FAM-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000 + 10000)}`,
        name: body.name,
        surname: body.surname ?? null,
        description: body.description ?? null,
        kuladevata: body.kuladevata ?? null,
        kuladevi: body.kuladevi ?? null,
        gotra: body.gotra ?? null,
        traditionalOccupation: body.traditionalOccupation ?? null,
        nativeVillage,
        nativeDistrict: native?.district ?? body.nativeDistrict ?? null,
        nativeState: native?.state ?? body.nativeState ?? null,
        nativeCountry: body.nativeCountry ?? 'India',
        status: 'PENDING',
        kartaMemberId: memberId,
        createdBy: session.user.id,
      },
    })

    await tx.familyMember.create({
      data: { familyId: created.id, memberId, isKarta: true, joinedBy: session.user.id, relationshipRole: 'karta' },
    })
    if (mulGaonAreaId) {
      await tx.familyArea.create({ data: { familyId: created.id, areaId: mulGaonAreaId, isPrimary: true } })
    }

    let kartaRole = await tx.role.findUnique({ where: { code: 'KARTA' } })
    if (!kartaRole) {
      kartaRole = await tx.role.create({ data: { code: 'KARTA', label: 'Karta', isSystem: true } })
    }
    await tx.userRole.create({
      data: {
        userId: session.user.id,
        roleId: kartaRole.id,
        familyId: created.id,
        grantedBy: session.user.id,
      },
    })

    await tx.approval.create({
      data: {
        actionCode: 'family.create',
        entityType: 'family',
        entityId: created.id,
        newValue: { name: created.name, registrationNumber: created.registrationNumber },
        status: 'SUBMITTED',
        submittedBy: session.user.id,
      },
    })

    await recordAudit({
      actorId: session.user.id, actorRole: 'KARTA', action: 'family.create', entityType: 'family', entityId: created.id,
      newValue: {
        name: created.name, registrationNumber: created.registrationNumber, gotra: created.gotra,
        kuladevata: created.kuladevata, nativeVillage: created.nativeVillage, kartaMemberId: memberId,
      },
    }, req, tx)

    // One-time registration fee, billed to the Karta who registered the
    // family. Members who join later are never billed.
    const invoice = await raiseFamilyRegistrationInvoice(tx, {
      familyId: created.id,
      kartaMemberId: memberId,
    })

    return { created, invoice }
  })

  return NextResponse.json(
    {
      message: family.invoice
        ? 'Family created — you are now its Karta. A registration fee is due.'
        : 'Family created — you are now its Karta. Submitted for verification.',
      familyId: family.created.id,
      registrationFee: family.invoice
        ? { invoiceId: family.invoice.id, reference: family.invoice.reference, amountPaise: family.invoice.amountPaise }
        : null,
    },
    { status: 201 }
  )
}
