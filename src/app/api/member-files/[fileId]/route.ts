import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getObject } from '@/lib/storage'
import { canViewSection, getDetailsContext } from '@/lib/additional-details/access'
import { auditView, json } from '@/lib/additional-details/http'

/** Streams a marksheet or certificate after re-checking the owning section's visibility. */
export async function GET(req: Request, props: { params: Promise<{ fileId: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const file = await prisma.memberFile.findUnique({ where: { id: params.fileId } })
  if (!file) return json({ message: 'Not found' }, 404)

  const ctx = await getDetailsContext(session, file.memberId)
  const sectionKey = file.purpose === 'MARKSHEET' ? 'education' : 'sports'
  if (!ctx.canEdit) {
    const setting = await prisma.memberSectionSetting.findUnique({
      where: { memberId_sectionKey: { memberId: file.memberId, sectionKey } },
    })
    if (setting?.answer !== 'YES' || !canViewSection(ctx, setting.visibility)) return json({ message: 'Not found' }, 404)
    await auditView(ctx, session, req, [sectionKey], `file:${file.id}`)
  }

  try {
    const { body } = await getObject(file.storageKey)
    return new NextResponse(new Uint8Array(body), {
      headers: {
        'Content-Type': file.mimeType ?? 'application/octet-stream',
        'Content-Disposition': `inline; filename="${(file.originalFilename ?? 'document').replace(/[^\w.\- ]/g, '_')}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return json({ message: 'File is missing from storage' }, 404)
  }
}
