import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import sharp from 'sharp'

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024 // 8MB

export function isStorageConfigured(): boolean {
  return !!(process.env.S3_BUCKET_NAME && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY)
}

function getClient(): S3Client {
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

export interface ValidatedUpload {
  buffer: Buffer
  mimeType: string
  width: number
  height: number
}

/** Throws a plain Error with a user-safe message on any validation failure. */
export async function validatePhotoUpload(file: File): Promise<ValidatedUpload> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error('Only JPEG, PNG, or WEBP images are allowed.')
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error('Image must be smaller than 8MB.')
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const meta = await sharp(buffer).metadata()
  if (!meta.width || !meta.height) {
    throw new Error('Could not read image dimensions — file may be corrupt.')
  }

  return { buffer, mimeType: file.type, width: meta.width, height: meta.height }
}

export interface UploadedPhotoKeys {
  storageKey: string
  thumbnailKey: string
  optimizedKey: string
}

/**
 * Uploads the original plus a compressed "optimized" version and a small
 * thumbnail. Returns the S3 keys to store on the Photo row — never store or
 * return a public URL directly, access is mediated through a signed-URL
 * route so photo visibility rules stay enforceable server-side.
 */
export async function uploadMemberPhoto(memberId: string, upload: ValidatedUpload): Promise<UploadedPhotoKeys> {
  if (!isStorageConfigured()) {
    throw new Error('Photo storage is not configured on this deployment yet.')
  }

  const client = getClient()
  const bucket = process.env.S3_BUCKET_NAME!
  const id = randomUUID()
  const prefix = `members/${memberId}/photos/${id}`

  const optimized = await sharp(upload.buffer).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()
  const thumbnail = await sharp(upload.buffer).rotate().resize(300, 300, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer()

  const storageKey = `${prefix}/original`
  const optimizedKey = `${prefix}/optimized.jpg`
  const thumbnailKey = `${prefix}/thumbnail.jpg`

  await Promise.all([
    client.send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: upload.buffer, ContentType: upload.mimeType })),
    client.send(new PutObjectCommand({ Bucket: bucket, Key: optimizedKey, Body: optimized, ContentType: 'image/jpeg' })),
    client.send(new PutObjectCommand({ Bucket: bucket, Key: thumbnailKey, Body: thumbnail, ContentType: 'image/jpeg' })),
  ])

  return { storageKey, thumbnailKey, optimizedKey }
}

export async function deletePhotoObjects(keys: (string | null | undefined)[]) {
  if (!isStorageConfigured()) return
  const client = getClient()
  const bucket = process.env.S3_BUCKET_NAME!
  await Promise.all(
    keys.filter((k): k is string => !!k).map((Key) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key })))
  )
}
