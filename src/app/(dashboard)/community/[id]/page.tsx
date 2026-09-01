import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Heart, MessageSquare, Share2, Send } from 'lucide-react'
import { timeAgo, getInitials } from '@/lib/utils'
import CommentSection from './CommentSection'

export default async function PostDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const post = await prisma.post.findUnique({
    where: { id: params.id, status: 'PUBLISHED', deletedAt: null },
    include: {
      author: { include: { member: { select: { id: true, firstName: true, lastName: true } } } },
      postType: { select: { label: true, icon: true } },
      comments: {
        where: { status: 'ACTIVE', deletedAt: null, parentId: null },
        include: {
          author: { include: { member: { select: { firstName: true, lastName: true } } } },
          replies: {
            where: { status: 'ACTIVE', deletedAt: null },
            include: {
              author: { include: { member: { select: { firstName: true, lastName: true } } } },
            },
            orderBy: { createdAt: 'asc' },
            take: 5,
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      },
      _count: { select: { reactions: true, comments: true } },
    },
  })

  if (!post) notFound()

  const authorName = post.author.member
    ? `${post.author.member.firstName} ${post.author.member.lastName ?? ''}`
    : post.author.email ?? 'Member'

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/community" className="btn-ghost p-2 -ml-2"><ArrowLeft className="w-4 h-4" /></Link>
        <span className="text-gray-400 text-sm">Community Feed</span>
      </div>

      {/* Post */}
      <div className="card">
        {/* Author */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-saffron-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {getInitials(authorName)}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{authorName}</p>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>{timeAgo(post.createdAt)}</span>
              {post.postType && (
                <span className="bg-gray-100 px-1.5 py-0.5 rounded-full">
                  {post.postType.icon} {post.postType.label}
                </span>
              )}
              {post.isPinned && <span className="text-saffron-600 font-medium">📌 Pinned</span>}
            </div>
          </div>
        </div>

        {post.title && <h1 className="text-xl font-bold text-gray-900 mb-3">{post.title}</h1>}
        {post.content && (
          <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">{post.content}</div>
        )}
        {post.eventDate && (
          <div className="mt-3 bg-saffron-50 border border-saffron-100 rounded-lg px-4 py-3 text-sm">
            <span className="font-medium text-saffron-800">📅 Event Date: </span>
            <span className="text-saffron-700">
              {new Date(post.eventDate).toLocaleDateString('en-IN', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 mt-4 pt-3 border-t border-gray-50">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-red-500 transition-colors">
            <Heart className="w-4 h-4" />
            {post._count.reactions > 0 && post._count.reactions}
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500">
            <MessageSquare className="w-4 h-4" />
            {post._count.comments} comment{post._count.comments !== 1 ? 's' : ''}
          </div>
          <button
            onClick={undefined}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors ml-auto"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
      </div>

      {/* Comments */}
      <CommentSection
        postId={params.id}
        comments={post.comments as any[]}
        viewerUserId={session.user?.id ?? ''}
      />
    </div>
  )
}
