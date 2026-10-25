import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireActiveAccount } from '@/lib/account-state'
import { getFamilyAccess } from '@/lib/family-auth'
import { isStorageConfigured, validatePhotoUpload, uploadPhoto } from '@/lib/storage'
import { canViewPhoto } from '@/lib/photo-access'
import { recordAudit } from '@/lib/audit'

/** F34 family album: members add photos; each chooses Only me / Family / Friends / a friend list / Community. */
const ALBUM_VISIBILITY = ['PRIVATE', 'SAME_FAMILY', 'FRIENDS', 'FRIEND_LIST', 'REGISTERED_MEMBERS']

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const rows = await prisma.photo.findMany({
    where: { ownerType: 'family_album', familyId: params.id, status: { not: 'REMOVED' } },
    orderBy: { createdAt: 'desc' }, take: 200,
  })
  const visible = []
  for (const p of rows) if (await canViewPhoto(session, p)) visible.push(p)
  const names = new Map((await prisma.member.findMany({ where: { userId: { in: visible.map((p) => p.uploadedBy) } }, select: { userId: true, firstName: true, lastName: true } }))
    .map((m) => [m.userId, [m.firstName, m.lastName].filter(Boolean).join(' ')]))
  return NextResponse.json({
    photos: visible.map((p) => ({
      id: p.id, caption: p.caption, visibility: p.visibility, status: p.status, createdAt: p.createdAt,
      uploadedBy: names.get(p.uploadedBy) ?? '', mine: p.uploadedBy === session.user!.id,
    })),
  })
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const notActive = await requireActiveAccount(session.user.id)
  if (notActive) return notActive
  const access = await getFamilyAccess(session, params.id)
  if (!access.isMember) return NextResponse.json({ message: 'Only members of this family add to its album' }, { status: 403 })
  if (!isStorageConfigured()) return NextResponse.json({ message: 'Photo storage is not configured on this deployment yet.' }, { status: 503 })

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ message: 'No file provided' }, { status: 400 })
  const visibility = String(form.get('visibility') || 'SAME_FAMILY')
  if (!ALBUM_VISIBILITY.includes(visibility)) return NextResponse.json({ message: 'Choose who can see the photo' }, { status: 400 })
  const audienceListId = visibility === 'FRIEND_LIST' ? String(form.get('audienceListId') ?? '') : null
  if (visibility === 'FRIEND_LIST') {
    const list = audienceListId ? await prisma.friendList.findUnique({ where: { id: audienceListId } }) : null
    if (!list || list.ownerMemberId !== access.memberId) return NextResponse.json({ message: 'Choose one of your friend lists' }, { status: 400 })
  }
  let validated
  try { validated = await validatePhotoUpload(file) } catch (e: any) { return NextResponse.json({ message: e.message }, { status: 400 }) }
  const keys = await uploadPhoto(`families/${params.id}/album`, validated)
  const caption = String(form.get('caption') ?? '').trim().slice(0, 300) || null
  const photo = await prisma.photo.create({
    data: {
      ownerType: 'family_album', familyId: params.id, uploadedBy: session.user.id, ...keys,
      originalFilename: file.name, mimeType: validated.mimeType, fileSizeBytes: BigInt(file.size),
      width: validated.width, height: validated.height, caption, visibility, audienceListId,
    },
  })
  await recordAudit({ actorId: session.user.id, action: 'family.album.add', entityType: 'photo', entityId: photo.id, newValue: { familyId: params.id, visibility } }, req)
  return NextResponse.json({ message: 'Photo added', photoId: photo.id }, { status: 201 })
}
