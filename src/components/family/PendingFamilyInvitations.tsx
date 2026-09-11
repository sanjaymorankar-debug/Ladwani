'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Users, Loader2, Check, X } from 'lucide-react'

interface Invitation {
  id: string
  familyId: string
  family: { id: string; name: string; registrationNumber: string | null; nativeVillage: string | null }
}

/**
 * Invitations from a Karta asking this person to join their family (§11,
 * §49). Only the invited person can answer — the Karta cannot add an existing
 * account-holder without this consent — so this is where that consent is
 * given or withheld.
 */
export default function PendingFamilyInvitations() {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () =>
    fetch('/api/my/family-invitations')
      .then((r) => (r.ok ? r.json() : { invitations: [] }))
      .then((d) => setInvitations(d.invitations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const respond = async (inv: Invitation, decision: 'APPROVE' | 'REJECT') => {
    setBusyId(inv.id)
    try {
      const res = await fetch(`/api/families/${inv.familyId}/join-requests/${inv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      toast.success(json.message)
      await load()
      if (decision === 'APPROVE') location.reload()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusyId(null)
    }
  }

  if (loading || invitations.length === 0) return null

  return (
    <div className="card border-2 border-saffron-200 space-y-3">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2">
        <Users className="w-4 h-4 text-saffron-600" />
        {invitations.length === 1 ? 'A family has invited you' : 'Families have invited you'}
      </h2>

      {invitations.map((inv) => (
        <div key={inv.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm">
            <p className="font-medium text-gray-900">{inv.family.name} family</p>
            <p className="text-gray-500 text-xs">
              {[inv.family.registrationNumber, inv.family.nativeVillage].filter(Boolean).join(' · ') ||
                'Invitation to join'}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => respond(inv, 'APPROVE')} disabled={busyId === inv.id}
              className="btn-primary text-xs flex items-center gap-1 disabled:opacity-60">
              {busyId === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Accept
            </button>
            <button onClick={() => respond(inv, 'REJECT')} disabled={busyId === inv.id}
              className="btn-secondary text-xs flex items-center gap-1 disabled:opacity-60">
              <X className="w-3.5 h-3.5" /> Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
