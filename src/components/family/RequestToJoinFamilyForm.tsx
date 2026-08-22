'use client'
import { useState, useEffect } from 'react'
import { Users2, Loader2, Send } from 'lucide-react'
import toast from 'react-hot-toast'

export default function RequestToJoinFamilyForm({ relatedToMemberId, relatedToName }: { relatedToMemberId: string; relatedToName: string }) {
  const [open, setOpen] = useState(false)
  const [relTypes, setRelTypes] = useState<any[]>([])
  const [relationshipTypeCode, setRelationshipTypeCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (open && relTypes.length === 0) {
      fetch('/api/relationship-types').then((r) => r.json()).then((d) => setRelTypes(d?.types ?? []))
    }
  }, [open, relTypes.length])

  const submit = async () => {
    if (!relationshipTypeCode) {
      toast.error('Select your relationship first')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relatedToMemberId, relationshipTypeCode }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to send request')
      setSent(true)
      toast.success('Request sent to the family Karta for approval.')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (sent) {
    return <p className="text-sm text-green-600 font-medium">Join request sent — waiting for the Karta&apos;s approval.</p>
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost text-sm flex items-center gap-1.5">
        <Users2 className="w-4 h-4" /> Request to Join Their Family
      </button>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2 max-w-sm">
      <label className="form-label">I am {relatedToName}&apos;s...</label>
      <select value={relationshipTypeCode} onChange={(e) => setRelationshipTypeCode(e.target.value)} className="form-input">
        <option value="">Select relationship</option>
        {relTypes.map((rt: any) => (
          <option key={rt.code} value={rt.code}>{rt.label}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <button onClick={submit} disabled={isSubmitting}
          className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5 disabled:opacity-70">
          {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Send Request
        </button>
        <button onClick={() => setOpen(false)} className="btn-secondary text-sm py-2 px-4">Cancel</button>
      </div>
    </div>
  )
}
