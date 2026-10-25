import { randomUUID } from 'crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { putObject } from '@/lib/storage'
import { getDetailsContext } from '@/lib/additional-details/access'
import { hasConsent } from '@/lib/additional-details/server'
import { actorFor, json } from '@/lib/additional-details/http'

/**
 * Marksheet / certificate upload (rule 6). Same private storage as photos —
 * outside the public web root (LOCAL) or a private bucket (S3) — and only
 * ever served through /api/member-files/[id] after a visibility check.
 */
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024
const MAX_FILES_PER_MEMBER = 60
const TYPES: Record<string, { ext: string; magic: number[] }> = {
  'application/pdf': { ext: 'pdf', magic: [0x25, 0x50, 0x44, 0x46] },
  'image/jpeg': { ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
  'image/png': { ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47] },
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const ctx = await getDetailsContext(session, params.id)
  if (!ctx.exists) return json({ message: 'Not found' }, 404)
  if (!ctx.canEdit) return json({ message: 'Forbidden' }, 403)
  if (!(await hasConsent(params.id))) return json({ code: 'CONSENT_REQUIRED', message: 'Please agree to the consent notice first.' }, 412)

  const form = await req.formData()
  const file = form.get('file')
  const purpose = String(form.get('purpose') ?? '')
  if (!['MARKSHEET', 'CERTIFICATE'].includes(purpose)) return json({ message: 'Unknown upload type' }, 400)
  if (!(file instanceof File)) return json({ message: 'No file provided' }, 400)
  const type = TYPES[file.type]
  if (!type) return json({ message: 'Upload a PDF, JPG or PNG file' }, 400)
  if (file.size > MAX_DOCUMENT_BYTES) return json({ message: 'File is too large (maximum 5 MB)' }, 400)
  if ((await prisma.memberFile.count({ where: { memberId: params.id } })) >= MAX_FILES_PER_MEMBER) {
    return json({ message: 'Upload limit reached — remove an old file first' }, 400)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  // The declared type must match the bytes, so a renamed executable is refused.
  if (!type.magic.every((b, i) => buffer[i] === b)) return json({ message: 'The file content does not match its type' }, 400)

  const storageKey = `members/${params.id}/documents/${randomUUID()}.${type.ext}`
  await putObject(storageKey, buffer, file.type)
  const actor = actorFor(session, req)
  const record = await prisma.memberFile.create({
    data: {
      memberId: params.id, purpose, storageKey, mimeType: file.type, sizeBytes: file.size,
      originalFilename: file.name.slice(0, 191), uploadedBy: actor.userId,
    },
  })
  await prisma.auditLog.create({
    data: {
      actorId: actor.userId, actorRole: actor.role, action: 'additional_details.file.upload',
      entityType: 'member', entityId: params.id, ipAddress: actor.ipAddress, userAgent: actor.userAgent,
      metadata: { fileId: record.id, purpose },
    },
  })
  return json({ fileId: record.id, name: record.originalFilename }, 201)
}
