import type { Session } from 'next-auth'
import { canViewPost } from '@/lib/posts'
import { getPostAccess } from '@/lib/interest-groups'

/**
 * Who may see a post: an interest-group post follows its group (members,
 * moderators, staff); any other post follows its F36 audience.
 */
export async function canSeePost(
  session: Session | null,
  post: { id: string; groupId: string | null; authorId: string; status: string; deletedAt: Date | null; audienceType: string; audienceId: string | null }
) {
  if (post.groupId) return !post.deletedAt && (await getPostAccess(session, post.id)).allowed
  return canViewPost(session, post)
}
