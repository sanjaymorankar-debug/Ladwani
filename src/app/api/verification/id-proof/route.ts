import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'
import { parseIdNumber } from '@/lib/registration'
import { openChangeRequest } from '@/lib/verification'
import { storeEncrypted, sniffMime, ID_PROOF_MIME, MAX_ID_PROOF_BYTES, MissingKeyError } from '@/lib/secure-files'

/**
 * F03 step 1–2: ID number + proof + self-signed copy (multipart form:
 * idType, idNumber, proof, selfSigned). Both files are encrypted before they
 * reach storage. Before approval the new proof simply replaces the old one;
 * once ACTIVE it becomes an F08 change request for the two operators.
 */
async function readFile(form: FormData, name: string): Promise<{ buf: Buffer; mime: string } | { error: string }> {
  const f = form.get(name)
  if (!f || typeof f === 'string') return { error: name === 'proof' ? 'Upload the ID proof' : 'Upload the self-signed copy' }
  const buf = Buffer.from(await (f as File).arrayBuffer())
  if (!buf.length) return { error: 'The uploaded file is empty' }
  if (buf.length > MAX_ID_PROOF_BYTES) return { error: 'Each file must be 5 MB or smaller' }
  const mime = sniffMime(buf)
  if (!mime || !ID_PROOF_MIME.includes(mime)) return { error: 'Upload a JPG, PNG, WebP image or a PDF' }
  return { buf, mime }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, include: { member: { select: { id: true } } } })
  if (!user.member) return NextResponse.json({ message: 'No member profile' }, { status: 404 })
  if (user.status === 'PENDING_APPROVAL') {
    return NextResponse.json({ message: 'Your ID proof cannot change while the operators are verifying it.' }, { status: 409 })
  }
  if (!['DRAFT', 'CORRECTION_REQUIRED', 'ACTIVE'].includes(user.status)) {
    return NextResponse.json({ message: 'Your account cannot upload an ID proof right now.' }, { status: 409 })
  }

  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ message: 'Send the files as a form upload' }, { status: 400 }) }
  const id = parseIdNumber(form.get('idType'), form.get('idNumber'))
  if ('error' in id) return NextResponse.json({ message: id.error }, { status: 400 })
  const proof = await readFile(form, 'proof')
  if ('error' in proof) return NextResponse.json({ message: proof.error }, { status: 400 })
  const signed = await readFile(form, 'selfSigned')
  if ('error' in signed) return NextResponse.json({ message: signed.error }, { status: 400 })

  const memberId = user.member.id
  let proofKey: string, selfSignedKey: string
  try {
    proofKey = await storeEncrypted(`id-proofs/${memberId}`, proof.buf)
    selfSignedKey = await storeEncrypted(`id-proofs/${memberId}`, signed.buf)
  } catch (e) {
    if (e instanceof MissingKeyError) return NextResponse.json({ message: 'ID proof storage is not configured. Contact the administrator.' }, { status: 503 })
    throw e
  }

  const isChange = user.status === 'ACTIVE'
  const current = await prisma.idProof.findFirst({ where: { memberId, status: 'ACTIVE' } })
  if (isChange && (await prisma.profileChangeRequest.findFirst({ where: { memberId, status: 'PENDING' } }))) {
    return NextResponse.json({ message: 'A change to your verified details is already awaiting approval.' }, { status: 409 })
  }

  const row = await prisma.$transaction(async (tx) => {
    if (!isChange) {
      await tx.idProof.updateMany({ where: { memberId, status: { in: ['ACTIVE', 'PENDING_CHANGE'] } }, data: { status: 'SUPERSEDED', supersededAt: new Date() } })
    }
    return tx.idProof.create({
      data: {
        userId: user.id, memberId, idType: id.idType, idLast4: id.idLast4, idNumberEnc: id.idNumberEnc,
        proofKey, proofMime: proof.mime, selfSignedKey, selfSignedMime: signed.mime,
        status: isChange ? 'PENDING_CHANGE' : 'ACTIVE',
      },
    })
  })
  await recordAudit({
    actorId: user.id, action: 'id_proof.upload', entityType: 'id_proof', entityId: row.id,
    oldValue: current ? { idProofId: current.id, idType: current.idType, idLast4: current.idLast4 } : null,
    newValue: { idProofId: row.id, idType: row.idType, idLast4: row.idLast4, status: row.status },
  }, req)

  if (isChange) {
    const opened = await openChangeRequest({
      userId: user.id, memberId,
      changes: { idProofId: { old: current?.id ?? null, new: row.id } },
    })
    if (!opened.ok) return NextResponse.json({ message: opened.message }, { status: opened.status })
    return NextResponse.json({ message: 'New ID proof sent to two operators for verification. Your current proof stays in use until then.', pendingChange: true }, { status: 202 })
  }
  return NextResponse.json({ message: 'ID proof saved', idProof: { id: row.id, idType: row.idType, idLast4: row.idLast4 } }, { status: 201 })
}
