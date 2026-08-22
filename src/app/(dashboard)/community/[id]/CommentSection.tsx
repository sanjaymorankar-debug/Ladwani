'use client'
import { useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { timeAgo, getInitials } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Comment {
  id: string
  content: string
  createdAt: string
  author: { member?: { firstName: string; lastName?: string } | null }
  replies?: Comment[]
}

interface Props {
  postId: string
  comments: Comment[]
  viewerUserId: string
}

export default function CommentSection({ postId, comments, viewerUserId }: Props) {
  const [allComments, setAllComments] = useState<Comment[]>(comments)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [isSending, setIsSending] = useState(false)

  const authorName = (comment: Comment) =>
    comment.author?.member
      ? `${comment.author.member.firstName} ${comment.author.member.lastName ?? ''}`
      : 'Member'

  const submit = async (content: string, parentId?: string) => {
    if (!content.trim()) return
    setIsSending(true)
    try {
      const res = await fetch(`/ladwani/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, parentId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)

      const newComment: Comment = {
        id: json.commentId,
        content,
        createdAt: new Date().toISOString(),
        author: { member: null },
        replies: [],
      }

      if (parentId) {
        setAllComments((prev) =>
          prev.map((c) =>
            c.id === parentId ? { ...c, replies: [...(c.replies ?? []), newComment] } : c
          )
        )
        setReplyTo(null); setReplyText('')
      } else {
        setAllComments((prev) => [...prev, newComment])
        setText('')
      }
      toast.success('Comment posted!')
    } catch (e: any) { toast.error(e.message) }
    finally { setIsSending(false) }
  }

  return (
    <div className="card space-y-4">
      <h2 className="font-semibold text-gray-900 text-sm">
        {allComments.length} Comment{allComments.length !== 1 ? 's' : ''}
      </h2>

      {/* Add comment */}
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="form-input flex-1 min-h-[60px] resize-none"
          placeholder="Write a comment..."
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(text) }}
        />
        <button onClick={() => submit(text)} disabled={isSending || !text.trim()}
          className="btn-primary px-3 flex-shrink-0 self-end disabled:opacity-60">
          {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>

      {allComments.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-4">
          {allComments.map((comment) => (
            <div key={comment.id} className="space-y-2">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {getInitials(authorName(comment))}
                </div>
                <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 text-sm">{authorName(comment)}</span>
                    <span className="text-xs text-gray-400">{timeAgo(comment.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{comment.content}</p>
                  <button
                    onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                    className="text-xs text-saffron-600 hover:text-saffron-700 mt-1"
                  >
                    Reply
                  </button>
                </div>
              </div>

              {/* Reply input */}
              {replyTo === comment.id && (
                <div className="ml-10 flex gap-2">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="form-input flex-1 text-sm"
                    placeholder={`Reply to ${authorName(comment)}...`}
                    onKeyDown={(e) => e.key === 'Enter' && submit(replyText, comment.id)}
                  />
                  <button onClick={() => submit(replyText, comment.id)} disabled={isSending || !replyText.trim()}
                    className="btn-primary text-xs px-2 disabled:opacity-60">
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="ml-10 space-y-2">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="flex items-start gap-2.5">
                      <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {getInitials(authorName(reply))}
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium text-gray-900 text-xs">{authorName(reply)}</span>
                          <span className="text-xs text-gray-400">{timeAgo(reply.createdAt)}</span>
                        </div>
                        <p className="text-xs text-gray-700">{reply.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
