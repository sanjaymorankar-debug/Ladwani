'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Crown } from 'lucide-react'

interface Candidate { id: string; name: string }

/** Request to hand the Karta role to another adult account-holder (§28). Reviewed by an Admin. */
export default function ChangeKartaPanel({ familyId, candidates }: { familyId: string; candidates: Candidate[] }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [target, setTarget] = useState('')
  const [reason, setReason] = useState('')

  const submit = async () => {
    if (!target) return toast.error('Choose the new Karta')
    setBusy(true)
    try {
      const res = await fetch(`/api/families/${familyId}/karta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newKartaMemberId: target, reason }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      toast.success(json.message)
      setOpen(false)
      setTarget('')
      setReason('')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <button type="button" onClick={() => setOpen(!open)} className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2">
        <Crown className="w-4 h-4" /> Change Karta
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {candidates.length === 0 ? (
            <p className="text-sm text-gray-500">
              The new Karta must be an adult family member with their own login. Invite a member first.
            </p>
          ) : (
            <>
              <select value={target} onChange={(e) => setTarget(e.target.value)} className="form-input text-sm">
                <option value="">Select new Karta…</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="form-input text-sm" rows={2}
                placeholder="Reason for the change (shown to the reviewing Admin)" />
              <button type="button" onClick={submit} disabled={busy} className="btn-primary text-sm disabled:opacity-60">
                Submit for Admin review
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
