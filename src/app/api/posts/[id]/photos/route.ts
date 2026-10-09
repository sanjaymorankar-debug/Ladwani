import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isStorageConfigured, validatePhotoUpload, uploadPhoto } from '@/lib/storage'

const MAX_PER_POST = 4

/** F36: the author adds photos to their post; they are seen by the post's audience only. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const post = await prisma.post.findUnique({ where: { id: params.id }, include: { _count: { select: { photos: true } } } })
  if (!post || post.deletedAt || post.authorId !== session.user.id) return NextResponse.json({ message: 'Post not found' }, { status: 404 })
  if (post._count.photos >= MAX_PER_POST) return NextResponse.json({ message: `Up to ${MAX_PER_POST} photos per post` }, { status: 400 })
  if (!isStorageConfigured()) return NextResponse.json({ message: 'Photo storage is not configured on this deployment yet.' }, { status: 503 })
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ message: 'No file provided' }, { status: 400 })
  let validated
  try { validated = await validatePhotoUpload(file) } catch (e: any) { return NextResponse.json({ message: e.message }, { status: 400 }) }
  const keys = await uploadPhoto(`posts/${post.id}`, validated)
  const photo = await prisma.photo.create({
    data: {
      ownerType: 'post', postId: post.id, uploadedBy: session.user.id, ...keys, originalFilename: file.name,
      mimeType: validated.mimeType, fileSizeBytes: BigInt(file.size), width: validated.width, height: validated.height, visibility: 'POST_AUDIENCE',
    },
  })
  return NextResponse.json({ message: 'Photo added', photoId: photo.id }, { status: 201 })
}
