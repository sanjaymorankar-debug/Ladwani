'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Heart, MessageSquare, Share2, MoreHorizontal, Pin, Flag } from 'lucide-react'
import { timeAgo, getInitials } from '@/lib/utils'
import toast from 'react-hot-toast'

interface PostCardProps {
  post: any
  viewerUserId: string
}

export default function PostCard({ post, viewerUserId }: PostCardProps) {
  const [liked, setLiked] = useState(false)
  const [reactionCount, setReactionCount] = useState(post._count?.reactions ?? 0)
  const [commentCount] = useState(post._count?.comments ?? 0)

  const authorName = post.author?.member
    ? `${post.author.member.firstName} ${post.author.member.lastName ?? ''}`
    : post.author?.email ?? 'Community Member'

  const toggleLike = async () => {
    const newLiked = !liked
    setLiked(newLiked)
    setReactionCount((c: number) => newLiked ? c + 1 : c - 1)
    try {
      await fetch(`/api/posts/${post.id}/reactions`, {
        method: newLiked ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactionType: 'LIKE' }),
      })
    } catch {
      setLiked(liked)
      setReactionCount((c: number) => newLiked ? c - 1 : c + 1)
    }
  }

  return (
    <div className={`card ${post.isPinned ? 'border-l-4 border-l-saffron-400' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-saffron-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            {getInitials(authorName)}
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm leading-tight">{authorName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {post.isPinned && <Pin className="w-3 h-3 text-saffron-500" />}
              <span className="text-xs text-gray-400">{timeAgo(post.createdAt)}</span>
              {post.postType && (
                <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                  {post.postType.icon} {post.postType.label}
                </span>
              )}
            </div>
          </div>
        </div>
        <button className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      {post.title && (
        <h3 className="font-semibold text-gray-900 mb-2">{post.title}</h3>
      )}
      {post.content && (
        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
          {post.content.length > 300 ? (
            <>
              {post.content.slice(0, 300)}...
              <Link href={`/community/${post.id}`} className="text-saffron-600 font-medium ml-1">Read more</Link>
            </>
          ) : post.content}
        </p>
      )}

      {/* Event date */}
      {post.eventDate && (
        <div className="mt-2 bg-saffron-50 rounded-lg px-3 py-2 text-sm text-saffron-800 font-medium">
          📅 Event: {new Date(post.eventDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 mt-4 pt-3 border-t border-gray-50">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            liked ? 'text-red-500 bg-red-50' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
          }`}
        >
          <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
          {reactionCount > 0 && reactionCount}
        </button>
        <Link
          href={`/community/${post.id}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          {commentCount > 0 && commentCount}
        </Link>
        <button
          onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/community/${post.id}`)
            toast.success('Link copied!')
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          <Share2 className="w-4 h-4" />
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-50 hover:text-red-500 transition-colors ml-auto">
          <Flag className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
