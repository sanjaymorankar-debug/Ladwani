'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Heart, Check, Loader2 } from 'lucide-react'

export default function SendInterestButton({ toMemberId }: { toMemberId: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')

  const send = async () => {
    setStatus('sending')
    try {
      const res = await fetch('/api/matrimony/interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toMemberId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? 'Failed to send interest')
      toast.success('Interest sent!')
      setStatus('sent')
    } catch (e: any) {
      toast.error(e.message)
      setStatus('idle')
    }
  }

  if (status === 'sent') {
    return (
      <button disabled className="flex-1 btn-secondary text-sm py-2 flex items-center justify-center gap-1 opacity-70">
        <Check className="w-3.5 h-3.5" /> Sent
      </button>
    )
  }

  return (
    <button onClick={send} disabled={status === 'sending'}
      className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-1 disabled:opacity-70">
      {status === 'sending' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Heart className="w-3.5 h-3.5" />}
      Send Interest
    </button>
  )
}
