'use client'
import { BASE_PATH } from '@/lib/api-path'
import { useState } from 'react'
import toast from 'react-hot-toast'
import RelationshipSelect from './RelationshipSelect'

/** F14 — a non-member asks to join, stating their relationship to the Karta. */
export default function JoinFamilyPanel({ familyId, kartaMemberId, kartaName, gender }: {
  familyId: string; kartaMemberId: string | null; kartaName: string | null; gender: string | null
}) {
  const [role, setRole] = useState('')
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)
  const send = async () => {
    const res = await fetch(`${BASE_PATH}/api/families/${familyId}/join-requests`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relationshipTypeCode: role || undefined, relatedToMemberId: role ? kartaMemberId : undefined, note }),
    })
    const json = await res.json()
    if (!res.ok) return toast.error(json.message)
    toast.success(json.message); setSent(true)
  }
  if (sent) return <div className="card text-sm text-green-700">Request sent. The Karta will decide.</div>
  return (
    <div className="card space-y-2">
      <h2 className="font-semibold text-gray-900">Request to join this family</h2>
      <p className="text-sm text-gray-500">Only a summary is shown until the Karta accepts you.</p>
      <div className="grid sm:grid-cols-2 gap-2">
        <RelationshipSelect value={role} onChange={setRole} gender={gender} />
        <span className="text-sm text-gray-600 self-center">{kartaName ? `of ${kartaName} (Karta)` : ''}</span>
      </div>
      <textarea className="form-input text-sm" rows={2} placeholder="Note for the Karta (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="button" className="btn-primary text-sm" onClick={send}>Send request</button>
    </div>
  )
}
