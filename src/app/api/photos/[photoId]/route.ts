import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageFamily } from '@/lib/family-auth'
import { deletePhotoObjects } from '@/lib/storage'
import { recordAudit } from '@/lib/audit'

/**
 * F34: delete a family-album or post photo — its uploader, the family's Karta
 * (album) or an Admin. Member gallery photos keep their own route.
 */
export async function DELETE(req: Request, { params }: { params: { photoId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const photo = await prisma.photo.findUnique({ where: { id: params.photoId } })
  if (!photo || !['family_album', 'post'].includes(photo.ownerType)) return NextResponse.json({ message: 'Not found' }, { status: 404 })
  const roles = ((session.user as any).roles ?? []) as string[]
  const allowed = photo.uploadedBy === session.user.id || roles.includes('ADMIN')
    || (photo.ownerType === 'family_album' && !!photo.familyId && (await canManageFamily(session, photo.familyId)))
  if (!allowed) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  await prisma.photo.delete({ where: { id: photo.id } })
  await deletePhotoObjects([photo.storageKey, photo.optimizedKey, photo.thumbnailKey])
  await recordAudit({ actorId: session.user.id, action: 'photo.delete', entityType: 'photo', entityId: photo.id, oldValue: { ownerType: photo.ownerType, familyId: photo.familyId, postId: photo.postId } }, req)
  return NextResponse.json({ message: 'Photo deleted' })
}
