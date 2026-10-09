import { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { canViewByVisibility, hasStaffView } from '@/lib/visibility'
import { canViewPost } from '@/lib/posts'

type PhotoRow = {
  ownerType: string; memberId: string | null; familyId: string | null; postId: string | null
  uploadedBy: string; visibility: string; audienceListId: string | null; status: string
}

/**
 * Who may see a photo (F34):
 *   member photo      — the member's chosen visibility
 *   family album      — the uploader's chosen visibility, where "Family" means that family
 *   post photo        — the post's audience
 *   family / asset    — any signed-in member (as before)
 * A hidden (reported) or removed photo is only for its uploader and staff.
 */
export async function canViewPhoto(session: Session | null, photo: PhotoRow) {
  if (!session?.user?.id) return false
  const roles = ((session.user as any).roles ?? []) as string[]
  const isUploader = photo.uploadedBy === session.user.id
  if (photo.status !== 'ACTIVE') return isUploader || roles.includes('ADMIN') || roles.includes('OPERATOR')
  if (photo.memberId) return canViewByVisibility(session, photo.memberId, photo.visibility, photo.audienceListId)
  if (photo.ownerType === 'family_album' && photo.familyId) {
    if (isUploader || roles.includes('ADMIN')) return true
    const me = (session.user as any).memberId as string | null
    const inFamily = !!me && !!(await prisma.familyMember.findFirst({ where: { familyId: photo.familyId, memberId: me, leftAt: null } }))
    if (photo.visibility === 'SAME_FAMILY') return inFamily
    const uploader = await prisma.member.findUnique({ where: { userId: photo.uploadedBy }, select: { id: true } })
    if (!uploader) return false
    return canViewByVisibility(session, uploader.id, photo.visibility, photo.audienceListId)
  }
  if (photo.postId) {
    const post = await prisma.post.findUnique({ where: { id: photo.postId } })
    return !!post && canViewPost(session, post)
  }
  return true
}

/** The unmodified original keeps camera metadata (EXIF, GPS): only the uploader, the member and staff get it. */
export async function canGetOriginal(session: Session | null, photo: PhotoRow) {
  if (!session?.user?.id) return false
  if (photo.uploadedBy === session.user.id) return true
  const me = (session.user as any).memberId as string | null
  if (photo.memberId && (photo.memberId === me || (await hasStaffView(session, photo.memberId)))) return true
  return ((session.user as any).roles ?? []).includes('ADMIN')
}
