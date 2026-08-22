'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function JoinRequestActions({ joinRequestId }: { joinRequestId: string }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState<'APPROVE' | 'DECLINE' | null>(null)
  const [resolved, setResolved] = useState<'APPROVE' | 'DECLINE' | null>(null)

  const respond = async (action: 'APPROVE' | 'DECLINE') => {
    setIsLoading(action)
    try {
      const res = await fetch(`/api/join-requests/${joinRequestId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to respond')
      setResolved(action)
      toast.success(action === 'APPROVE' ? 'You joined the family!' : 'Request declined')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsLoading(null)
    }
  }

  if (resolved) {
    return (
      <p className="text-xs font-medium text-gray-500 mt-2">
        {resolved === 'APPROVE' ? 'Joined family' : 'Request declined'}
      </p>
    )
  }

  return (
    <div className="flex gap-2 mt-2">
      <button onClick={() => respond('APPROVE')} disabled={isLoading !== null}
        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 flex items-center gap-1 disabled:opacity-60">
        {isLoading === 'APPROVE' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        Approve
      </button>
      <button onClick={() => respond('DECLINE')} disabled={isLoading !== null}
        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1 disabled:opacity-60">
        {isLoading === 'DECLINE' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
        Decline
      </button>
    </div>
  )
}
