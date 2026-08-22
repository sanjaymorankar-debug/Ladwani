'use client'
import { useState } from 'react'
import { Heart, Loader2, Check } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SendInterestButton({ toMemberId, className }: { toMemberId: string; className?: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const sendInterest = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/matrimony/interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toMemberId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to send interest')
      setSent(true)
      toast.success('Interest sent!')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (sent) {
    return (
      <button disabled className={className ?? 'flex-1 btn-secondary text-sm py-2 flex items-center justify-center gap-1'}>
        <Check className="w-3.5 h-3.5" /> Interest Sent
      </button>
    )
  }

  return (
    <button onClick={sendInterest} disabled={isLoading}
      className={className ?? 'flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-1 disabled:opacity-70'}>
      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Heart className="w-3.5 h-3.5" />}
      {isLoading ? 'Sending...' : 'Send Interest'}
    </button>
  )
}
