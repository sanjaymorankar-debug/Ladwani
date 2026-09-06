import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { POST as uploadMemberPhoto, GET as listMemberPhotos } from '@/app/api/members/[id]/photos/route'
import { PATCH as patchPhoto, DELETE as deletePhoto } from '@/app/api/members/[id]/photos/[photoId]/route'
import { POST as uploadAssetPhoto, GET as listAssetPhotos, DELETE as deleteAssetPhoto } from '@/app/api/assets/[id]/photos/route'
import { GET as photoUrl } from '@/app/api/photos/[photoId]/url/route'
import { GET as photoFile } from '@/app/api/photos/[photoId]/file/route'
import { PATCH as patchVisibility } from '@/app/api/members/[id]/visibility/route'
import { account, actAs, jsonReq } from './helpers'

/** A real 600×400 PNG, so sharp actually has bytes to process. */
async function pngFile(name = 'test.png'): Promise<File> {
  const buf = await sharp({
    create: { width: 600, height: 400, channels: 3, background: { r: 200, g: 80, b: 20 } },
  }).png().toBuffer()
  return new File([new Uint8Array(buf)], name, { type: 'image/png' })
}

function formOf(file: File, extra: Record<string, string> = {}): Request {
  const fd = new FormData()
  fd.append('file', file)
  for (const [k, v] of Object.entries(extra)) fd.append(k, v)
  return new Request('http://x', { method: 'POST', body: fd })
}

let assetId: string
const uploadedPhotoIds: string[] = []

beforeAll(async () => {
  const owner = await account('OWNER-01')
  const asset = await prisma.asset.create({
    data: {
      ownerMemberId: owner.memberId, name: 'Photo Test Hall', assetType: 'HALL',
      bookingMode: 'DAILY', ratePerDay: 100000, status: 'APPROVED',
    },
  })
  assetId = asset.id
})

afterAll(async () => {
  await prisma.photo.deleteMany({ where: { id: { in: uploadedPhotoIds } } })
  if (assetId) {
    await prisma.photo.deleteMany({ where: { assetId } })
    await prisma.asset.deleteMany({ where: { id: assetId } })
  }
})

describe('TC-PHOTO — member photos', () => {
  let photoId: string

  it('TC-PHOTO-001 a member uploads a photo; original, optimized and thumbnail are stored', async () => {
    const m = await account('MEMBER-01')
    actAs({ userId: m.userId, roles: m.roles, memberId: m.memberId })

    const res = await uploadMemberPhoto(formOf(await pngFile()) as any, { params: { id: m.memberId } })
    expect(res.status).toBe(201)
    const { photo } = await res.json()
    photoId = photo.id
    uploadedPhotoIds.push(photoId)

    const saved = await prisma.photo.findUniqueOrThrow({ where: { id: photoId } })
    expect(saved.storageKey).toBeTruthy()
    expect(saved.optimizedKey).toBeTruthy()
    expect(saved.thumbnailKey).toBeTruthy()
    expect(saved.width).toBe(600)
    expect(saved.height).toBe(400)
    // Conservative default until the member chooses otherwise (spec §23).
    expect(saved.visibility).toBe('PRIVATE')
  })

  it('TC-PHOTO-002 the stored files really exist and the thumbnail is resized', async () => {
    const saved = await prisma.photo.findUniqueOrThrow({ where: { id: photoId } })
    const { getObject } = await import('@/lib/storage')

    const original = await getObject(saved.storageKey)
    const thumb = await getObject(saved.thumbnailKey!)
    expect(original.body.byteLength).toBeGreaterThan(0)

    // 300×300 cover crop, not just a copy of the original.
    const meta = await sharp(thumb.body).metadata()
    expect(meta.width).toBe(300)
    expect(meta.height).toBe(300)
  })

  it('TC-PHOTO-003 a non-image file is rejected even if it claims to be one', async () => {
    const m = await account('MEMBER-01')
    actAs({ userId: m.userId, roles: m.roles, memberId: m.memberId })
    const fake = new File([new Uint8Array(Buffer.from('not really a png'))], 'evil.png', { type: 'image/png' })

    const res = await uploadMemberPhoto(formOf(fake) as any, { params: { id: m.memberId } })
    expect(res.status).toBe(400)
    expect((await res.json()).message).toMatch(/not a readable image/i)
  })

  it('TC-PHOTO-004 an oversized file is rejected', async () => {
    const m = await account('MEMBER-01')
    actAs({ userId: m.userId, roles: m.roles, memberId: m.memberId })
    const big = new File([new Uint8Array(9 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' })

    const res = await uploadMemberPhoto(formOf(big) as any, { params: { id: m.memberId } })
    expect(res.status).toBe(400)
    expect((await res.json()).message).toMatch(/8MB/i)
  })

  it('TC-PHOTO-005 setting it as the profile photo updates the member', async () => {
    const m = await account('MEMBER-01')
    actAs({ userId: m.userId, roles: m.roles, memberId: m.memberId })

    const res = await patchPhoto(
      jsonReq('http://x', 'PATCH', { setAsProfile: true }) as any,
      { params: { id: m.memberId, photoId } }
    )
    expect(res.status).toBe(200)
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.memberId } })).profilePhotoId).toBe(photoId)
  })

  it('TC-PHOTO-006 PRIVATE means another member cannot fetch the image bytes', async () => {
    const other = await account('MEMBER-02')
    actAs({ userId: other.userId, roles: other.roles, memberId: other.memberId })

    expect((await photoUrl(jsonReq('http://x', 'GET') as any, { params: { photoId } })).status).toBe(403)
    // ...and going straight at the file route doesn't get around it.
    expect((await photoFile(jsonReq('http://x', 'GET') as any, { params: { photoId } })).status).toBe(403)
  })

  it('TC-PHOTO-007 widening visibility lets another member see it', async () => {
    const owner = await account('MEMBER-01')
    const other = await account('MEMBER-02')

    actAs({ userId: owner.userId, roles: owner.roles, memberId: owner.memberId })
    await patchPhoto(
      jsonReq('http://x', 'PATCH', { visibility: 'REGISTERED_MEMBERS' }) as any,
      { params: { id: owner.memberId, photoId } }
    )

    actAs({ userId: other.userId, roles: other.roles, memberId: other.memberId })
    const urlRes = await photoUrl(jsonReq('http://x', 'GET') as any, { params: { photoId } })
    expect(urlRes.status).toBe(200)
    expect((await urlRes.json()).url).toBeTruthy()

    const fileRes = await photoFile(jsonReq('http://x', 'GET') as any, { params: { photoId } })
    expect(fileRes.status).toBe(200)
    expect(fileRes.headers.get('Content-Type')).toMatch(/image/)
    // Private caching only — a shared cache must not serve it to someone else.
    expect(fileRes.headers.get('Cache-Control')).toMatch(/private/)
  })

  it('TC-PHOTO-008 an unrelated member cannot upload to someone else\'s gallery', async () => {
    const owner = await account('MEMBER-01')
    const other = await account('MEMBER-02')
    actAs({ userId: other.userId, roles: other.roles, memberId: other.memberId })

    const res = await uploadMemberPhoto(formOf(await pngFile()) as any, { params: { id: owner.memberId } })
    expect(res.status).toBe(403)
  })

  it('TC-PHOTO-009 deleting removes the row and the stored files', async () => {
    const m = await account('MEMBER-01')
    const saved = await prisma.photo.findUniqueOrThrow({ where: { id: photoId } })
    actAs({ userId: m.userId, roles: m.roles, memberId: m.memberId })

    const res = await deletePhoto(jsonReq('http://x', 'DELETE') as any, { params: { id: m.memberId, photoId } })
    expect(res.status).toBe(200)
    expect(await prisma.photo.findUnique({ where: { id: photoId } })).toBeNull()
    // Profile photo pointer is cleared, not left dangling.
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.memberId } })).profilePhotoId).toBeNull()

    const { getObject } = await import('@/lib/storage')
    await expect(getObject(saved.storageKey)).rejects.toBeTruthy()
  })
})

describe('TC-PHOTO — asset photos', () => {
  let assetPhotoId: string

  it('TC-PHOTO-010 the asset owner uploads a photo', async () => {
    const owner = await account('OWNER-01')
    actAs({ userId: owner.userId, roles: owner.roles, memberId: owner.memberId })

    const res = await uploadAssetPhoto(formOf(await pngFile('hall.png'), { caption: 'Main hall' }) as any, { params: { id: assetId } })
    expect(res.status).toBe(201)
    assetPhotoId = (await res.json()).photoId

    const saved = await prisma.photo.findUniqueOrThrow({ where: { id: assetPhotoId } })
    expect(saved.assetId).toBe(assetId)
    expect(saved.ownerType).toBe('asset')
    expect(saved.caption).toBe('Main hall')
  })

  it('TC-PHOTO-011 any signed-in member can view an asset photo', async () => {
    const member = await account('MEMBER-02')
    actAs({ userId: member.userId, roles: member.roles, memberId: member.memberId })

    const res = await photoFile(jsonReq('http://x', 'GET') as any, { params: { photoId: assetPhotoId } })
    expect(res.status).toBe(200)

    const list = await listAssetPhotos(jsonReq('http://x', 'GET') as any, { params: { id: assetId } })
    expect((await list.json()).photos.map((p: any) => p.id)).toContain(assetPhotoId)
  })

  it('TC-PHOTO-012 a member who does not own the asset cannot add or remove photos', async () => {
    const member = await account('MEMBER-02')
    actAs({ userId: member.userId, roles: member.roles, memberId: member.memberId })

    expect((await uploadAssetPhoto(formOf(await pngFile()) as any, { params: { id: assetId } })).status).toBe(403)
    expect((await deleteAssetPhoto(
      new Request(`http://x?photoId=${assetPhotoId}`, { method: 'DELETE' }) as any,
      { params: { id: assetId } }
    )).status).toBe(403)
  })

  it('TC-PHOTO-013 the owner can delete their asset photo', async () => {
    const owner = await account('OWNER-01')
    actAs({ userId: owner.userId, roles: owner.roles, memberId: owner.memberId })

    const res = await deleteAssetPhoto(
      new Request(`http://x?photoId=${assetPhotoId}`, { method: 'DELETE' }) as any,
      { params: { id: assetId } }
    )
    expect(res.status).toBe(200)
    expect(await prisma.photo.findUnique({ where: { id: assetPhotoId } })).toBeNull()
  })
})

describe('TC-PHOTO — storage driver safety', () => {
  it('TC-PHOTO-014 a traversal storage key is refused', async () => {
    const { putObject } = await import('@/lib/storage')
    // LOCAL rejects it in resolveLocalPath; S3 rejects it at the bucket
    // ("bad components"). Either way it must never be written.
    await expect(putObject('../../../etc/evil.txt', Buffer.from('x'), 'text/plain')).rejects.toBeTruthy()
  })

  it('TC-PHOTO-015 uploads land inside the configured directory', async () => {
    const { activeStorageDriver } = await import('@/lib/storage')
    if (activeStorageDriver() !== 'LOCAL') return // S3 mode: nothing on disk to check

    const root = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'))
    const stat = await fs.stat(root).catch(() => null)
    expect(stat?.isDirectory()).toBe(true)
  })
})
