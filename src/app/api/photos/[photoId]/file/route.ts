import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canViewByVisibility } from '@/lib/visibility'
import { getObject } from '@/lib/storage'

/**
 * Streams a stored image, re-checking visibility on every request.
 *
 * Photos are never exposed as public URLs: with the LOCAL driver the upload
 * directory sits outside the web root, and with S3 the bucket stays private.
 * That means a leaked link can't outlive the viewer's permission.
 */
export async function GET(req: Request, { params }: { params: { photoId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const photo = await prisma.photo.findUnique({ where: { id: params.photoId } })
  if (!photo || photo.status !== 'ACTIVE') {
    return NextResponse.json({ message: 'Not found' }, { status: 404 })
  }

  // Member photos are governed by the member's visibility setting. Asset
  // photos belong to a listing every signed-in member can already see.
  if (photo.memberId) {
    if (!(await canViewByVisibility(session, photo.memberId, photo.visibility))) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }
  }

  const { searchParams } = new URL(req.url)
  const variant = searchParams.get('variant')
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
