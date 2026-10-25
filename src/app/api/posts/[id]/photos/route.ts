import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isStorageConfigured, validatePhotoUpload, uploadPhoto } from '@/lib/storage'
import { getPostAccess } from '@/lib/interest-groups'

const MAX_PER_POST = 4
const MAX_PER_GROUP_POST = 6

/**
 * The author adds photos to their post. F36: a feed post's photos are seen by
 * the post's audience only (POST_AUDIENCE). An interest-group post's photos
 * are seen by registered members of the group (up to 6), as before.
 */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const post = await prisma.post.findUnique({ where: { id: params.id }, include: { _count: { select: { photos: true } } } })
  if (!post || post.deletedAt) return NextResponse.json({ message: 'Post not found' }, { status: 404 })
  if (post.groupId && !(await getPostAccess(session, post.id)).allowed) return NextResponse.json({ message: 'Post not found' }, { status: 404 })
  if (post.authorId !== session.user.id) {
    return post.groupId
      ? NextResponse.json({ message: 'Only the author can add photos' }, { status: 403 })
      : NextResponse.json({ message: 'Post not found' }, { status: 404 })
  }
  const max = post.groupId ? MAX_PER_GROUP_POST : MAX_PER_POST
  if (post._count.photos >= max) return NextResponse.json({ message: `Up to ${max} photos per post` }, { status: 400 })
  if (!isStorageConfigured()) return NextResponse.json({ message: 'Photo storage is not configured on this deployment yet.' }, { status: 503 })
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ message: 'No file provided' }, { status: 400 })
  let validated
  try { validated = await validatePhotoUpload(file) } catch (e: any) { return NextResponse.json({ message: e.message }, { status: 400 }) }
  const keys = await uploadPhoto(post.groupId ? `groups/${post.groupId}/posts/${post.id}` : `posts/${post.id}`, validated)
  const photo = await prisma.photo.create({
    data: {
      ownerType: 'post', postId: post.id, uploadedBy: session.user.id, ...keys, originalFilename: file.name,
      mimeType: validated.mimeType, fileSizeBytes: BigInt(file.size), width: validated.width, height: validated.height,
      visibility: post.groupId ? 'REGISTERED_MEMBERS' : 'POST_AUDIENCE',
    },
  })
  return NextResponse.json({ message: 'Photo added', photoId: photo.id }, { status: 201 })
}
