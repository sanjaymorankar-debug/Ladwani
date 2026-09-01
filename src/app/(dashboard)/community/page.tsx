import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Plus, Newspaper } from 'lucide-react'
import { timeAgo, getInitials } from '@/lib/utils'
import PostCard from '@/components/community/PostCard'

export default async function CommunityFeedPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const [posts, postTypes] = await Promise.all([
    prisma.post.findMany({
      where: { status: 'PUBLISHED', deletedAt: null },
      include: {
        author: { include: { member: { select: { firstName: true, lastName: true } } } },
        postType: { select: { label: true, icon: true, code: true } },
        _count: { select: { comments: true, reactions: true } },
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 30,
    }),
    prisma.postType.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
  ])

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-saffron-600" /> Community Feed
          </h1>
          <p className="text-gray-500 text-sm">News, announcements and updates from Ladwani Samaj</p>
        </div>
        <Link href="/community/new-post" className="btn-primary text-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New Post
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Feed */}
        <div className="lg:col-span-2 space-y-4">
          {posts.length === 0 ? (
            <div className="card text-center py-12">
              <Newspaper className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No posts yet. Be the first to share!</p>
              <Link href="/community/new-post" className="btn-primary text-sm mt-3 inline-block">Create Post</Link>
            </div>
          ) : (
            posts.map((post: any) => (
              <PostCard
                key={post.id}
                post={post}
                viewerUserId={session.user?.id ?? ''}
              />
            ))
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Post Categories</h3>
            <div className="space-y-1">
              {postTypes.map((pt: any) => (
                <div key={pt.code} className="flex items-center gap-2 py-1.5 text-sm text-gray-600 hover:text-gray-900 cursor-pointer">
                  <span className="text-base">{pt.icon ?? '📌'}</span>
                  {pt.label}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Community Guidelines</h3>
            <ul className="text-xs text-gray-500 space-y-1.5">
              {[
                'Be respectful and kind',
                'Share relevant community content',
                'No spam or advertisements',
                'Protect privacy of members',
                'Report inappropriate content',
              ].map((g) => (
                <li key={g} className="flex items-start gap-1.5">
                  <span className="text-green-500 mt-0.5">✓</span> {g}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
