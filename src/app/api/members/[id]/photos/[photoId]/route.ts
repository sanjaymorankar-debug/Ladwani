import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMemberAccess } from '@/lib/member-auth'
import { deletePhotoObjects } from '@/lib/storage'

const VALID_VISIBILITY = new Set([
  'PRIVATE', 'SAME_FAMILY', 'REGISTERED_MEMBERS', 'SAME_AREA', 'MATRIMONY_ONLY', 'PUBLIC_COMMUNITY', 'ADMIN_OPERATOR',
])

export async function PATCH(req: Request, { params }: { params: { id: string; photoId: string } }) {
  const session = await getServerSession(authOptions)
  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const photo = await prisma.photo.findUnique({ where: { id: params.photoId } })
  if (!photo || photo.memberId !== params.id) {
    return NextResponse.json({ message: 'Photo not found' }, { status: 404 })
  }

  const body = await req.json()

  if (body.visibility && !VALID_VISIBILITY.has(body.visibility)) {
    return NextResponse.json({ message: 'Invalid visibility value' }, { status: 400 })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.photo.update({
      where: { id: params.photoId },
      data: {
        visibility: body.visibility ?? undefined,
        caption: body.caption !== undefined ? body.caption : undefined,
      },
    })

    if (body.setAsProfile === true) {
      await tx.photo.updateMany({
        where: { memberId: params.id, id: { not: params.photoId } },
        data: { isProfilePhoto: false },
      })
      await tx.photo.update({ where: { id: params.photoId }, data: { isProfilePhoto: true } })
      await tx.member.update({ where: { id: params.id }, data: { profilePhotoId: params.photoId } })
    } else if (body.setAsProfile === false && photo.isProfilePhoto) {
      await tx.photo.update({ where: { id: params.photoId }, data: { isProfilePhoto: false } })
      await tx.member.update({ where: { id: params.id }, data: { profilePhotoId: null } })
    }

    return result
  })

  return NextResponse.json({ message: 'Updated', photo: updated })
}

export async function DELETE(req: Request, { params }: { params: { id: string; photoId: string } }) {
  const session = await getServerSession(authOptions)
  const access = await getMemberAccess(session, params.id)
  if (!access.exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  if (!access.authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const photo = await prisma.photo.findUnique({ where: { id: params.photoId } })
  if (!photo || photo.memberId !== params.id) {
    return NextResponse.json({ message: 'Photo not found' }, { status: 404 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.photo.delete({ where: { id: params.photoId } })
    if (photo.isProfilePhoto) {
      await tx.member.update({ where: { id: params.id }, data: { profilePhotoId: null } })
    }
  })

  await deletePhotoObjects([photo.storageKey, photo.thumbnailKey, photo.optimizedKey])

  return NextResponse.json({ message: 'Deleted' })
}
