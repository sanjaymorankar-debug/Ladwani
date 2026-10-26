import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'crypto'
import { putObject, getObject } from '@/lib/storage'

/**
 * F03 / rule 7: ID proofs are encrypted (AES-256-GCM) before they reach
 * storage, and the storage root (UPLOAD_DIR) is outside the public web root.
 * Layout of every encrypted blob: 12-byte IV | 16-byte auth tag | ciphertext.
 *
 * ID_PROOF_KEY is a base64-encoded 32-byte key. Production refuses to run
 * without it; development and tests derive one from NEXTAUTH_SECRET so the
 * flow works locally.
 */
export class MissingKeyError extends Error {}

function key(): Buffer {
  const raw = process.env.ID_PROOF_KEY
  if (raw) {
    const k = Buffer.from(raw, 'base64')
    if (k.length !== 32) throw new MissingKeyError('ID_PROOF_KEY must be 32 bytes, base64-encoded')
    return k
  }
  if (process.env.NODE_ENV === 'production') throw new MissingKeyError('ID_PROOF_KEY is not set')
  return createHash('sha256').update(`${process.env.NEXTAUTH_SECRET ?? 'dev'}:id-proof`).digest()
}

export function encryptBuffer(plain: Buffer): Buffer {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const body = Buffer.concat([cipher.update(plain), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), body])
}

export function decryptBuffer(blob: Buffer): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', key(), blob.subarray(0, 12))
  decipher.setAuthTag(blob.subarray(12, 28))
  return Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()])
}

export const encryptText = (s: string) => encryptBuffer(Buffer.from(s, 'utf8')).toString('base64')
export const decryptText = (s: string) => decryptBuffer(Buffer.from(s, 'base64')).toString('utf8')

export const ID_PROOF_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
export const MAX_ID_PROOF_BYTES = 5 * 1024 * 1024

/** Sniffs the real file type from its first bytes — the browser's claim is not trusted. */
export function sniffMime(buf: Buffer): string | null {
  if (buf.subarray(0, 4).toString('latin1') === '%PDF') return 'application/pdf'
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  return null
}

export async function storeEncrypted(prefix: string, plain: Buffer): Promise<string> {
  const storageKey = `${prefix}/${randomUUID()}.bin`
  await putObject(storageKey, encryptBuffer(plain), 'application/octet-stream')
  return storageKey
}

export async function readDecrypted(storageKey: string): Promise<Buffer> {
  return decryptBuffer((await getObject(storageKey)).body)
}

/** "XXXX-XXXX-1234" style display; only ever the last 4 digits. */
export function maskIdNumber(last4: string) {
  return `XXXX XXXX ${last4}`
}
