import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canViewByVisibility } from '@/lib/visibility'
import { activeStorageDriver } from '@/lib/storage'

/**
 * Hands back a URL the browser can put in an <img src>.
 *
 * With S3 that's a short-lived signed URL; with local storage it's our own
 * streaming route. Either way visibility is checked here first, and again on
 * the streaming route, so the link can't be passed around to bypass privacy.
 */
export async function GET(req: Request, { params }: { params: { photoId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const photo = await prisma.photo.findUnique({ where: { id: params.photoId } })
  if (!photo || photo.status !== 'ACTIVE') {
    return NextResponse.json({ message: 'Not found' }, { status: 404 })
  }

  if (photo.memberId && !(await canViewByVisibility(session, photo.memberId, photo.visibility))) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const variant = searchParams.get('variant') === 'thumbnail' ? 'thumbnail' : 'optimized'

  if (activeStorageDriver() === 'LOCAL') {
    return NextResponse.json({ url: `/api/photos/${photo.id}/file?variant=${variant}` })
  }

  const key = (variant === 'thumbnail' ? photo.thumbnailKey : photo.optimizedKey) || photo.storageKey
  const client = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: !!process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  })

  const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: process.env.S3_BUCKET_NAME!, Key: key }), { expiresIn: 300 })
  return NextResponse.json({ url })
}
