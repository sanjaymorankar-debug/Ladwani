import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMemberAccess } from '@/lib/member-auth'
import { requiresApproval, createApprovalRecord, applyMarkDeceased, deathCertificateRequired } from '@/lib/approvals'
import { afterMemberExpired } from '@/lib/family-rules'
import { recordAudit } from '@/lib/audit'
import { storeEncrypted, sniffMime, ID_PROOF_MIME, MAX_ID_PROOF_BYTES, MissingKeyError } from '@/lib/secure-files'

/** GET — whether the certificate is required now (the form shows it as required). */
export async function GET() {
  return NextResponse.json({ certificateRequired: await deathCertificateRequired() })
}

/**
 * Marks a member as deceased (§28). Gated by ApprovalRule('member.mark_deceased')
 * — the change is irreversible in effect (login deactivated, matrimony
 * withdrawn, spouse widowed), so it is reviewed unless staff do it directly
 * (kept by the owner's decision). Nobody may mark themselves.
 *
 * Body: JSON, or a form upload with an optional `certificate` file (the death
 * certificate: JPG / PNG / WebP / PDF, up to 5 MB, stored encrypted). It is
 * required while the setting `deceased.certificate_required` is on.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  // F12: the Karta of any family the person belongs to may mark them Expired —
  // including a member with their own login, who cannot do it themselves.
  const viewerMemberId = (session?.user as any)?.memberId as string | null
  const kartaOfTheirFamily = !access.authorized && viewerMemberId
    ? await prisma.familyMember.findFirst({
        where: {
          memberId: viewerMemberId, isKarta: true, leftAt: null,
          family: { members: { some: { memberId: params.id, leftAt: null } } },
        },
        select: { familyId: true },
      })
    : null
  if (!access.authorized && !kartaOfTheirFamily) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  if (access.isOwn) return NextResponse.json({ message: 'You cannot mark your own profile as deceased' }, { status: 400 })

  const member = await prisma.member.findUnique({ where: { id: params.id }, select: { status: true, dateOfBirth: true } })
  if (member?.status === 'DECEASED') return NextResponse.json({ message: 'Already marked as deceased' }, { status: 409 })

  let body: Record<string, any>
  let certificate: File | null = null
  if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    const form = await req.formData()
    body = Object.fromEntries(Array.from(form.entries()).filter(([, v]) => typeof v === 'string'))
    const f = form.get('certificate')
    if (f && typeof f !== 'string' && (f as File).size > 0) certificate = f as File
  } else {
    body = await req.json().catch(() => ({}))
  }
  const when = new Date(body.deceasedAt)
  if (!body.deceasedAt || isNaN(when.getTime())) {
    return NextResponse.json({ message: 'Date of death is required' }, { status: 400 })
  }
  if (when.getTime() > Date.now()) return NextResponse.json({ message: 'Date of death cannot be in the future' }, { status: 400 })
  if (member?.dateOfBirth && when < member.dateOfBirth) {
    return NextResponse.json({ message: 'Date of death cannot be before date of birth' }, { status: 400 })
  }

  if (!certificate && (await deathCertificateRequired())) {
    return NextResponse.json({ message: 'Attach the death certificate' }, { status: 400 })
  }
  let certKey: string | null = null
  let certMime: string | null = null
  if (certificate) {
    const buf = Buffer.from(await certificate.arrayBuffer())
    if (buf.length > MAX_ID_PROOF_BYTES) return NextResponse.json({ message: 'The death certificate must be 5 MB or smaller' }, { status: 400 })
    certMime = sniffMime(buf)
    if (!certMime || !ID_PROOF_MIME.includes(certMime)) return NextResponse.json({ message: 'Upload the death certificate as a JPG, PNG, WebP image or a PDF' }, { status: 400 })
    try {
      certKey = await storeEncrypted('death-certificates', buf)
    } catch (e) {
      if (e instanceof MissingKeyError) return NextResponse.json({ message: 'File storage is not configured. Contact the administrator.' }, { status: 503 })
      throw e
    }
  }

  const actorId = session!.user!.id as string
  const payload = {
    deceasedAt: when.toISOString(),
    deceasedPlace: body.deceasedPlace || null,
    deceasedNotes: body.deceasedNotes || null,
    ...(certKey ? { certificateKey: certKey, certificateMime: certMime } : {}),
  }

  if (!access.isStaff && (await requiresApproval('member.mark_deceased'))) {
    const pending = await prisma.approval.findFirst({
      where: { actionCode: 'member.mark_deceased', entityId: params.id, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
    })
    if (pending) return NextResponse.json({ message: 'A request for this member is already awaiting review' }, { status: 409 })
    await prisma.$transaction((tx) =>
      createApprovalRecord(tx, {
        actionCode: 'member.mark_deceased', entityType: 'member', entityId: params.id,
        newValue: payload, submittedBy: actorId, reason: body.reason,
      })
    )
    return NextResponse.json({ message: 'Submitted for review. The profile will be updated once approved.' }, { status: 202 })
  }

  await prisma.$transaction(async (tx) => {
    await applyMarkDeceased(tx, params.id, payload, actorId)
    await recordAudit({
      actorId, action: 'member.mark_deceased', entityType: 'member', entityId: params.id,
      oldValue: { status: member?.status }, newValue: { status: 'DECEASED', ...payload },
    }, req, tx)
  })
  // F12 → F16: tell the person's other Kartas; a Karta's family becomes vacant.
  await afterMemberExpired(params.id, actorId)
  return NextResponse.json({ message: 'Marked as deceased.' })
}
