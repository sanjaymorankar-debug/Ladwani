import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validatePhotoUpload, uploadPhoto, deletePhotoObjects } from '@/lib/storage'

/** Only the asset's owner (or staff) may manage its photos. */
async function canManageAsset(session: any, assetId: string) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { ownerMemberId: true } })
  if (!asset) return { exists: false, allowed: false }
  const roles = (session?.user?.roles ?? []) as string[]
  const isStaff = roles.includes('ADMIN') || roles.includes('OPERATOR')
  const memberId = session?.user?.memberId as string | null
  return { exists: true, allowed: isStaff || (!!memberId && memberId === asset.ownerMemberId) }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const photos = await prisma.photo.findMany({
    where: { assetId: params.id, ownerType: 'asset', status: 'ACTIVE' },
    select: { id: true, caption: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ photos })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const access = await canManageAsset(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Asset not found' }, { status: 404 })
  if (!access.allowed) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ message: 'No file provided' }, { status: 400 })

  let validated
  try {
    validated = await validatePhotoUpload(file)
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 400 })
  }

  const keys = await uploadPhoto(`assets/${params.id}/photos`, validated)

  const photo = await prisma.photo.create({
    data: {
      ownerType: 'asset',
      assetId: params.id,
      uploadedBy: session.user.id as string,
      storageKey: keys.storageKey,
      thumbnailKey: keys.thumbnailKey,
      optimizedKey: keys.optimizedKey,
      originalFilename: file.name,
      mimeType: validated.mimeType,
      fileSizeBytes: BigInt(file.size),
      width: validated.width,
      height: validated.height,
      caption: (form.get('caption') as string) || null,
      // An asset listing is community-facing, so its photos are too.
      visibility: 'REGISTERED_MEMBERS',
    },
  })

  return NextResponse.json({ message: 'Photo uploaded', photoId: photo.id }, { status: 201 })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const access = await canManageAsset(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Asset not found' }, { status: 404 })
  if (!access.allowed) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const photoId = searchParams.get('photoId')
  if (!photoId) return NextResponse.json({ message: 'photoId is required' }, { status: 400 })

  const photo = await prisma.photo.findUnique({ where: { id: photoId } })
  if (!photo || photo.assetId !== params.id) {
    return NextResponse.json({ message: 'Photo not found' }, { status: 404 })
  }

  await prisma.photo.delete({ where: { id: photoId } })
  await deletePhotoObjects([photo.storageKey, photo.thumbnailKey, photo.optimizedKey])
  return NextResponse.json({ message: 'Deleted' })
}
