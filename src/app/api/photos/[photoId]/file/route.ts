import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canViewPhoto, canGetOriginal } from '@/lib/photo-access'
import { getObject } from '@/lib/storage'
import { getPostAccess } from '@/lib/interest-groups'

/**
 * Streams a stored image, re-checking visibility on every request.
 *
 * Photos are never exposed as public URLs: with the LOCAL driver the upload
 * directory sits outside the web root, and with S3 the bucket stays private.
 * That means a leaked link can't outlive the viewer's permission.
 */
export async function GET(req: Request, props: { params: Promise<{ photoId: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const photo = await prisma.photo.findUnique({ where: { id: params.photoId } })
  if (!photo || photo.status === 'REMOVED') {
    return NextResponse.json({ message: 'Not found' }, { status: 404 })
  }

  // F34: member, family-album and post photos each follow their own audience
  // (photo-access.ts); a reported-and-hidden photo only its uploader and staff.
  if (!(await canViewPhoto(session, photo))) {
    return NextResponse.json({ message: photo.status === 'ACTIVE' ? 'Forbidden' : 'Not found' }, { status: photo.status === 'ACTIVE' ? 403 : 404 })
  }

  // Photos on interest-group posts are visible only inside that group.
  if (photo.postId && !(await getPostAccess(session, photo.postId)).allowed) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  // The original keeps camera metadata (location); others get the re-encoded copy.
  const variant = searchParams.get('variant') === 'original' && !(await canGetOriginal(session, photo)) ? null : searchParams.get('variant')
  const key =
    (variant === 'thumbnail' ? photo.thumbnailKey : variant === 'original' ? photo.storageKey : photo.optimizedKey)
    || photo.storageKey

  try {
    const { body, contentType } = await getObject(key)
    return new NextResponse(new Uint8Array(body), {
      headers: {
        'Content-Type': contentType,
        // Private: caches must not hand this to a different viewer.
        'Cache-Control': 'private, max-age=300',
        'Content-Length': String(body.byteLength),
      },
    })
  } catch {
    return NextResponse.json({ message: 'Image file is missing from storage' }, { status: 404 })
  }
}
