import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageFamily } from '@/lib/family-auth'
import { validatePhotoUpload, uploadPhoto, deletePhotoObjects, isStorageConfigured } from '@/lib/storage'

/**
 * Family photo (§13). Only the family's Karta (or staff) may set it. There is
 * one current family photo; uploading a new one replaces the previous file.
 * Family photos are shown on the family card, which any signed-in member can
 * see, so they are stored as REGISTERED_MEMBERS.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const family = await prisma.family.findUnique({
    where: { id: params.id, deletedAt: null },
    select: { familyPhotoId: true },
  })
  if (!family) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  return NextResponse.json({ photoId: family.familyPhotoId })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  if (!(await canManageFamily(session, params.id))) {
    return NextResponse.json({ message: "Only this family's Karta can change the family photo" }, { status: 403 })
  }

  const family = await prisma.family.findUnique({ where: { id: params.id, deletedAt: null } })
  if (!family) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  if (!isStorageConfigured()) {
    return NextResponse.json({ message: 'Photo storage is not configured on this deployment yet.' }, { status: 503 })
  }

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ message: 'No file provided' }, { status: 400 })

  let validated
  try {
    validated = await validatePhotoUpload(file)
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 400 })
  }

  const keys = await uploadPhoto(`families/${params.id}/photos`, validated)

  const { photo, previous } = await prisma.$transaction(async (tx) => {
    const old = family.familyPhotoId
      ? await tx.photo.findUnique({ where: { id: family.familyPhotoId } })
      : null
    const created = await tx.photo.create({
      data: {
        ownerType: 'family',
        familyId: params.id,
        uploadedBy: session.user!.id as string,
        storageKey: keys.storageKey,
        thumbnailKey: keys.thumbnailKey,
        optimizedKey: keys.optimizedKey,
        originalFilename: file.name,
        mimeType: validated.mimeType,
        fileSizeBytes: BigInt(file.size),
        width: validated.width,
        height: validated.height,
        visibility: 'REGISTERED_MEMBERS',
      },
    })
    await tx.family.update({ where: { id: params.id }, data: { familyPhotoId: created.id } })
    if (old) await tx.photo.delete({ where: { id: old.id } })
    await tx.auditLog.create({
      data: { actorId: session.user!.id as string, action: 'family.photo.update', entityType: 'family', entityId: params.id },
    })
    return { photo: created, previous: old }
  })

  // Remove the replaced files only after the database change has committed.
  if (previous) await deletePhotoObjects([previous.storageKey, previous.thumbnailKey, previous.optimizedKey])

  return NextResponse.json({ message: 'Family photo updated', photoId: photo.id }, { status: 201 })
}
