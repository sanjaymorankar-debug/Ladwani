import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

/**
 * Photo storage.
 *
 * Two drivers:
 *   LOCAL — writes under UPLOAD_DIR (default ./uploads). Needs no external
 *           service, which is what a shared-hosting deployment actually has.
 *   S3    — any S3-compatible bucket (AWS, Cloudflare R2, MinIO).
 *
 * Chosen with STORAGE_DRIVER, or inferred: S3 when fully configured,
 * otherwise local disk. Files are never served straight from the store —
 * access goes through a route that re-checks photo visibility first.
 */
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024 // 8MB

export type StorageDriver = 'LOCAL' | 'S3'

export function isS3Configured(): boolean {
  return !!(process.env.S3_BUCKET_NAME && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY)
}

export function activeStorageDriver(): StorageDriver {
  const explicit = process.env.STORAGE_DRIVER?.toUpperCase()
  if (explicit === 'S3') return 'S3'
  if (explicit === 'LOCAL') return 'LOCAL'
  return isS3Configured() ? 'S3' : 'LOCAL'
}

/** Storage is always available now — local disk needs no configuration. */
export function isStorageConfigured(): boolean {
  return activeStorageDriver() === 'LOCAL' || isS3Configured()
}

function uploadRoot(): string {
  return path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'))
}

/**
 * Resolves a storage key to an absolute path, refusing anything that would
 * escape the upload directory. Keys are generated server-side, but this is
 * the boundary where a traversal attempt would land, so it's checked here.
 */
function resolveLocalPath(key: string): string {
  const full = path.resolve(uploadRoot(), key)
  const root = uploadRoot()
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error('Invalid storage key')
  }
  return full
}

function s3(): S3Client {
  return new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: !!process.env.S3_ENDPOINT, // required for MinIO
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  })
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  if (activeStorageDriver() === 'LOCAL') {
    const full = resolveLocalPath(key)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, body)
    return
  }
  await s3().send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME!, Key: key, Body: body, ContentType: contentType,
  }))
}

export async function getObject(key: string): Promise<{ body: Buffer; contentType: string }> {
  if (activeStorageDriver() === 'LOCAL') {
    const full = resolveLocalPath(key)
    const body = await fs.readFile(full)
    return { body, contentType: key.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream' }
  }
  const res = await s3().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET_NAME!, Key: key }))
  const chunks: Buffer[] = []
  for await (const chunk of res.Body as any) chunks.push(Buffer.from(chunk))
  return { body: Buffer.concat(chunks), contentType: res.ContentType ?? 'application/octet-stream' }
}

export async function deletePhotoObjects(keys: (string | null | undefined)[]) {
  const present = keys.filter((k): k is string => !!k)
  if (present.length === 0) return

  if (activeStorageDriver() === 'LOCAL') {
    await Promise.all(present.map(async (key) => {
      try {
        await fs.unlink(resolveLocalPath(key))
      } catch {
        // Already gone — deleting the database row is what matters.
      }
    }))
    return
  }

  const client = s3()
  await Promise.all(present.map((Key) =>
    client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME!, Key }))
      .catch(() => undefined)
  ))
}

export interface ValidatedUpload {
  buffer: Buffer
  mimeType: string
  width: number
  height: number
}

/** Throws a plain Error with a user-safe message on any validation failure. */
export async function validatePhotoUpload(file: File): Promise<ValidatedUpload> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error('Only JPEG, PNG or WEBP images are allowed.')
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error('Image must be smaller than 8MB.')
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  // sharp parses the actual bytes, so a file merely *claiming* to be an image
  // via its mime type is rejected here.
  let meta
  try {
    meta = await sharp(buffer).metadata()
  } catch {
    throw new Error('That file is not a readable image.')
  }
  if (!meta.width || !meta.height) {
    throw new Error('Could not read image dimensions — the file may be corrupt.')
  }

  return { buffer, mimeType: file.type, width: meta.width, height: meta.height }
}

export interface UploadedPhotoKeys {
  storageKey: string
  thumbnailKey: string
  optimizedKey: string
}

/** Stores the original plus a compressed version and a square thumbnail. */
export async function uploadPhoto(prefixPath: string, upload: ValidatedUpload): Promise<UploadedPhotoKeys> {
  const id = randomUUID()
  const prefix = `${prefixPath}/${id}`

  const [optimized, thumbnail] = await Promise.all([
    sharp(upload.buffer).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer(),
    sharp(upload.buffer).rotate().resize(300, 300, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer(),
  ])

  const storageKey = `${prefix}/original`
  const optimizedKey = `${prefix}/optimized.jpg`
  const thumbnailKey = `${prefix}/thumbnail.jpg`

  await Promise.all([
    putObject(storageKey, upload.buffer, upload.mimeType),
    putObject(optimizedKey, optimized, 'image/jpeg'),
    putObject(thumbnailKey, thumbnail, 'image/jpeg'),
  ])

  return { storageKey, thumbnailKey, optimizedKey }
}

/** Kept for the existing member-photo route. */
export async function uploadMemberPhoto(memberId: string, upload: ValidatedUpload): Promise<UploadedPhotoKeys> {
  return uploadPhoto(`members/${memberId}/photos`, upload)
}
