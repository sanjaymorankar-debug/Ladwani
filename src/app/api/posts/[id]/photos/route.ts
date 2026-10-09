import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isStorageConfigured, uploadPhoto, validatePhotoUpload } from '@/lib/storage'
import { json } from '@/lib/additional-details/http'
import { getPostAccess } from '@/lib/interest-groups'

/** Photos on a group post — the author adds them; served by the existing photo route. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const { post, allowed } = await getPostAccess(session, params.id)
  if (!post || !allowed || !post.groupId) return json({ message: 'Not found' }, 404)
  if (post.authorId !== session.user.id) return json({ message: 'Only the author can add photos' }, 403)
  if (!isStorageConfigured()) return json({ message: 'Photo storage is not configured' }, 503)
  if ((await prisma.photo.count({ where: { postId: post.id } })) >= 6) return json({ message: 'Up to 6 photos per post' }, 400)

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return json({ message: 'No file provided' }, 400)
  let validated
  try {
    validated = await validatePhotoUpload(file)
  } catch (e: any) {
    return json({ message: e.message }, 400)
  }
  const keys = await uploadPhoto(`groups/${post.groupId}/posts/${post.id}`, validated)
  const photo = await prisma.photo.create({
    data: {
      ownerType: 'post', postId: post.id, uploadedBy: session.user.id as string,
      storageKey: keys.storageKey, thumbnailKey: keys.thumbnailKey, optimizedKey: keys.optimizedKey,
      originalFilename: file.name, mimeType: validated.mimeType, fileSizeBytes: BigInt(file.size),
      width: validated.width, height: validated.height, visibility: 'REGISTERED_MEMBERS',
    },
    select: { id: true },
  })
  return json({ photoId: photo.id }, 201)
}
