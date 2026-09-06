import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMemberAccess } from '@/lib/member-auth'
import { canViewByVisibility } from '@/lib/visibility'
import { validatePhotoUpload, uploadMemberPhoto, isStorageConfigured } from '@/lib/storage'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const photos = await prisma.photo.findMany({
    where: { memberId: params.id, ownerType: 'member', status: 'ACTIVE' },
    // Explicit selection: storage keys stay server-side, and fileSizeBytes
    // (a BigInt) is excluded because JSON cannot serialize it.
    select: {
      id: true, isProfilePhoto: true, visibility: true, caption: true,
      width: true, height: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const visible = []
  for (const photo of photos) {
    if (await canViewByVisibility(session, params.id, photo.visibility)) {
      visible.push(photo)
    }
  }

  return NextResponse.json({ photos: visible })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { message: 'Photo storage is not configured on this deployment yet. Contact the administrator.' },
      { status: 503 }
    )
  }

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ message: 'No file provided' }, { status: 400 })
  }

  let validated
  try {
    validated = await validatePhotoUpload(file)
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 400 })
  }

  const keys = await uploadMemberPhoto(params.id, validated)
  const setAsProfile = form.get('setAsProfile') === 'true'
  const visibility = (form.get('visibility') as string) || 'PRIVATE'

  const photo = await prisma.$transaction(async (tx) => {
    const created = await tx.photo.create({
      data: {
        ownerType: 'member',
        memberId: params.id,
        uploadedBy: session!.user!.id as string,
        storageKey: keys.storageKey,
        thumbnailKey: keys.thumbnailKey,
        optimizedKey: keys.optimizedKey,
        originalFilename: file.name,
        mimeType: validated.mimeType,
        fileSizeBytes: BigInt(file.size),
        width: validated.width,
        height: validated.height,
        isProfilePhoto: setAsProfile,
        visibility,
      },
    })

    if (setAsProfile) {
      await tx.photo.updateMany({
        where: { memberId: params.id, id: { not: created.id } },
        data: { isProfilePhoto: false },
      })
      await tx.member.update({ where: { id: params.id }, data: { profilePhotoId: created.id } })
    }

    return created
  })

  // Return an explicit shape rather than the raw row: fileSizeBytes is a
  // BigInt, which JSON.stringify cannot serialize, and the storage keys are
  // internal and must never reach the client.
  return NextResponse.json({
    message: 'Photo uploaded',
    photo: {
      id: photo.id,
      isProfilePhoto: photo.isProfilePhoto,
      visibility: photo.visibility,
      caption: photo.caption,
      width: photo.width,
      height: photo.height,
      fileSizeBytes: Number(photo.fileSizeBytes ?? 0),
      createdAt: photo.createdAt,
    },
  }, { status: 201 })
}
