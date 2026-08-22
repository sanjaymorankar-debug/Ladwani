'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { XCircle, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function JoinRequestRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState<'reject' | 'delete' | null>(null)

  const reject = async () => {
    setIsLoading('reject')
    try {
      const res = await fetch(`/api/admin/join-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DECLINED' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to reject')
      toast.success('Request rejected')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsLoading(null)
    }
  }

  const remove = async () => {
    if (!confirm('Permanently delete this join request?')) return
    setIsLoading('delete')
    try {
      const res = await fetch(`/api/admin/join-requests/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to delete')
      toast.success('Request deleted')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsLoading(null)
    }
  }

  return (
    <div className="flex gap-1.5 justify-end">
      {status === 'PENDING' && (
        <button onClick={reject} disabled={isLoading !== null}
          className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1 disabled:opacity-60">
          {isLoading === 'reject' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
          Reject
        </button>
      )}
      <button onClick={remove} disabled={isLoading !== null}
        className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center gap-1 disabled:opacity-60">
        {isLoading === 'delete' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        Delete
      </button>
    </div>
  )
}
