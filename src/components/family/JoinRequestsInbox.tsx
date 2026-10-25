'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { UserPlus, Check, X, UserCheck } from 'lucide-react'
import RelationshipSelect from './RelationshipSelect'

interface JoinRequest {
  id: string
  relationshipTypeCode: string | null
  origin?: string
  relatedToMemberId: string | null
  member: {
    id: string
    firstName: string
    lastName: string | null
    mobilePrimary: string | null
    email: string | null
    currentCity: string | null
  }
}
interface Claim {
  id: string
  claimant: { firstName: string; lastName: string | null; mobilePrimary: string | null } | null
  target: { firstName: string; lastName: string | null; dateOfBirth: string | null } | null
}

/**
 * F15 — the Karta's inbox: join requests (accept, optionally correcting the
 * claimed role, or reject) and F17 profile claims (confirm → the records merge).
 */
export default function JoinRequestsInbox({ familyId }: { familyId: string }) {
  const [requests, setRequests] = useState<JoinRequest[] | null>(null)
  const [claims, setClaims] = useState<Claim[]>([])
  const [roles, setRoles] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    const res = await fetch(`/api/families/${familyId}/join-requests`)
    if (res.ok) {
      const data = await res.json()
      setRequests(data.requests ?? [])
      setClaims(data.claims ?? [])
    }
  }

  useEffect(() => {
    load()
  }, [familyId])

  const respond = async (r: JoinRequest, decision: 'APPROVE' | 'REJECT') => {
    // F15: a rejection carries a reason for the requester.
    const note = decision === 'REJECT' ? window.prompt('Reason for rejecting (shown to the requester)')?.trim() : undefined
    if (decision === 'REJECT' && !note) return
    setBusyId(r.id)
    try {
      const corrected = roles[r.id] && roles[r.id] !== r.relationshipTypeCode
      const res = await fetch(`/api/families/${familyId}/join-requests/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note, ...(decision === 'APPROVE' && corrected ? { relationshipTypeCode: roles[r.id] } : {}) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? 'Failed')
      toast.success(json.message)
      setRequests((prev) => (prev ?? []).filter((x) => x.id !== r.id))
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const decideClaim = async (id: string, decision: 'CONFIRM' | 'REJECT') => {
    const note = decision === 'REJECT' ? window.prompt('Reason for rejecting (shown to the person)')?.trim() : undefined
    if (decision === 'REJECT' && !note) return
    setBusyId(id)
    const res = await fetch(`/api/claims/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, note }) })
    const json = await res.json()
    setBusyId(null)
    if (!res.ok) return toast.error(json.message)
    toast.success(json.message)
    setClaims((prev) => prev.filter((c) => c.id !== id))
  }

  if ((!requests || requests.length === 0) && claims.length === 0) return null

  return (
    <div className="card space-y-4">
      {requests && requests.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-saffron-600" /> Join Requests ({requests.length})
          </h2>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border border-gray-100 rounded-xl">
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {r.member.firstName} {r.member.lastName ?? ''}
                    {r.origin === 'MARRIAGE' && <span className="ml-2 badge-orange text-xs">Marriage</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    {[r.member.mobilePrimary, r.member.email, r.member.currentCity].filter(Boolean).join(' · ')}
                  </p>
                  <div className="mt-1 w-56">
                    <RelationshipSelect value={roles[r.id] ?? r.relationshipTypeCode ?? ''} onChange={(v) => setRoles((x) => ({ ...x, [r.id]: v }))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => respond(r, 'APPROVE')}
                    disabled={busyId === r.id}
                    className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1 disabled:opacity-60"
                  >
                    <Check className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => respond(r, 'REJECT')}
                    disabled={busyId === r.id}
                    className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 disabled:opacity-60"
                  >
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {claims.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-saffron-600" /> Profile claims ({claims.length})
          </h2>
          {claims.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 p-3 border border-gray-100 rounded-xl text-sm">
              <span>
                <strong>{c.claimant?.firstName} {c.claimant?.lastName ?? ''}</strong> ({c.claimant?.mobilePrimary ?? 'no mobile'}) says they are
                {' '}<strong>{c.target?.firstName} {c.target?.lastName ?? ''}</strong>. Confirming merges the two records into one.
              </span>
              <span className="flex gap-2 flex-shrink-0">
                <button className="btn-primary text-xs" disabled={busyId === c.id} onClick={() => decideClaim(c.id, 'CONFIRM')}>Confirm</button>
                <button className="btn-secondary text-xs" disabled={busyId === c.id} onClick={() => decideClaim(c.id, 'REJECT')}>Reject</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
