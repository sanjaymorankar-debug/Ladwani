'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { UserPlus, Check, X } from 'lucide-react'

interface JoinRequest {
  id: string
  member: {
    id: string
    firstName: string
    lastName: string | null
    mobilePrimary: string | null
    email: string | null
    currentCity: string | null
  }
}

export default function JoinRequestsInbox({ familyId }: { familyId: string }) {
  const [requests, setRequests] = useState<JoinRequest[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    const res = await fetch(`/api/families/${familyId}/join-requests`)
    if (res.ok) {
      const data = await res.json()
      setRequests(data.requests ?? [])
    }
  }

  useEffect(() => {
    load()
  }, [familyId])

  const respond = async (reqId: string, decision: 'APPROVE' | 'REJECT') => {
    setBusyId(reqId)
    try {
      const res = await fetch(`/api/families/${familyId}/join-requests/${reqId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? 'Failed')
      toast.success(json.message)
      setRequests((prev) => (prev ?? []).filter((r) => r.id !== reqId))
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusyId(null)
    }
  }

  if (!requests || requests.length === 0) return null

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-saffron-600" /> Join Requests ({requests.length})
      </h2>
      <div className="space-y-2">
        {requests.map((r) => (
          <div key={r.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl">
            <div>
              <p className="font-medium text-gray-900 text-sm">{r.member.firstName} {r.member.lastName ?? ''}</p>
              <p className="text-xs text-gray-500">
                {[r.member.mobilePrimary, r.member.email, r.member.currentCity].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => respond(r.id, 'APPROVE')}
                disabled={busyId === r.id}
                className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1 disabled:opacity-60"
              >
                <Check className="w-3.5 h-3.5" /> Approve
              </button>
              <button
                onClick={() => respond(r.id, 'REJECT')}
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
  )
}
