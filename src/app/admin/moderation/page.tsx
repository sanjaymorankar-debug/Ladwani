import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ShieldCheck } from 'lucide-react'
import PostModerationQueue from '@/components/admin/PostModerationQueue'
import ReportedContentQueue from '@/components/admin/ReportedContentQueue'
import { canModeratePost } from '@/lib/posts'
import { getPostAccess } from '@/lib/interest-groups'

/**
 * Moderation: posts waiting for approval (F36; FLAGGED = interest-group posts
 * hidden after reports), limited to the ones this viewer may decide, and the
 * F34 / F36 reported-content queue.
 */
export default async function ModerationPage() {
  const session = await getServerSession(authOptions)
  const roles = ((session?.user as any)?.roles ?? []) as string[]
  if (!roles.includes('ADMIN') && !roles.includes('OPERATOR')) redirect('/dashboard')

  const waiting = await prisma.post.findMany({
    where: { status: { in: ['PENDING_APPROVAL', 'FLAGGED'] }, deletedAt: null },
    include: {
      postType: { select: { label: true, icon: true } },
      author: { select: { member: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
  })
  const posts = []
  for (const p of waiting) {
    const mine = p.groupId ? (getPostAccess(session, p.id).then((a) => a.isModerator)) : canModeratePost(session, p)
    if (await mine) posts.push(p)
    if (posts.length >= 50) break
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" /> Moderation
        </h1>
        <p className="text-gray-500 text-sm">
          Posts stay hidden until approved here. {posts.length} waiting.
        </p>
      </div>
      <PostModerationQueue posts={posts as any} />
      <ReportedContentQueue />
    </div>
  )
}
