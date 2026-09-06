'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Check, X, EyeOff } from 'lucide-react'

interface PendingPost {
  id: string
  title: string | null
  content: string | null
  createdAt: string | Date
  postType: { label: string; icon: string | null }
  author: { member: { firstName: string; lastName: string | null } | null }
}

export default function PostModerationQueue({ posts }: { posts: PendingPost[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [resolved, setResolved] = useState<string[]>([])

  const act = async (id: string, action: 'approve' | 'reject' | 'hide') => {
    setBusyId(id)
    try {
      const note = action === 'reject' ? window.prompt('Reason for rejecting (shown to the author):') ?? undefined : undefined
      const res = await fetch(`/api/posts/${id}/moderate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? 'Failed')
      toast.success(json.message)
      setResolved((r) => [...r, id])
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const remaining = posts.filter((p) => !resolved.includes(p.id))

  if (remaining.length === 0) {
    return (
      <div className="card text-center py-10 text-gray-500 text-sm">
        Nothing waiting for moderation.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {remaining.map((p) => (
        <div key={p.id} className="card">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-saffron-100 rounded-lg flex items-center justify-center flex-shrink-0 text-sm">
              {p.postType.icon ?? '📌'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="badge-orange text-xs">{p.postType.label}</span>
                <span className="text-xs text-gray-400">
                  by {p.author.member ? `${p.author.member.firstName} ${p.author.member.lastName ?? ''}` : 'Unknown'}
                </span>
              </div>
              {p.title && <p className="font-medium text-gray-900 text-sm">{p.title}</p>}
              {p.content && <p className="text-gray-600 text-sm mt-0.5 whitespace-pre-wrap">{p.content}</p>}

              <div className="flex gap-2 mt-3">
                <button onClick={() => act(p.id, 'approve')} disabled={busyId === p.id}
                  className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1 disabled:opacity-60">
                  <Check className="w-3.5 h-3.5" /> Approve
                </button>
                <button onClick={() => act(p.id, 'reject')} disabled={busyId === p.id}
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 disabled:opacity-60">
                  <X className="w-3.5 h-3.5" /> Reject
                </button>
                <button onClick={() => act(p.id, 'hide')} disabled={busyId === p.id}
                  className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1 disabled:opacity-60">
                  <EyeOff className="w-3.5 h-3.5" /> Hide
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
