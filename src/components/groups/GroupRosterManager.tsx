'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { UsersRound, UserMinus, Loader2, Search, CheckCircle2 } from 'lucide-react'

interface RosterEntry {
  id: string
  memberId: string
  roleInGroup: string
  joinedAt: string
  member: { id: string; firstName: string; lastName: string | null; mobilePrimary: string | null }
}

interface SearchHit {
  id: string
  firstName: string
  lastName: string | null
  currentCity: string | null
}

export default function GroupRosterManager({
  groupId,
  canManage,
  maxMembers,
  reviewDue,
}: {
  groupId: string
  canManage: boolean
  maxMembers: number | null
  reviewDue: boolean
}) {
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [busy, setBusy] = useState(false)

  const load = () =>
    fetch(`/api/groups/${groupId}/members`)
      .then((r) => r.json())
      .then((d) => setRoster(d.roster ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))

  useEffect(() => { load() }, [groupId])

  useEffect(() => {
    if (!query.trim()) { setHits([]); return }
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => setHits((d.members ?? []).filter((m: SearchHit) => !roster.some((r) => r.memberId === m.id))))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [query, roster])

  const addMember = async (memberId: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      toast.success('Added to roster')
      setQuery('')
      setHits([])
      await load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const removeMember = async (memberId: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/members?memberId=${memberId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).message)
      setRoster((r) => r.filter((x) => x.memberId !== memberId))
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const confirmRoster = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/roster-review`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).message)
      toast.success('Roster marked as current')
      location.reload()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const atCapacity = !!maxMembers && roster.length >= maxMembers

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <UsersRound className="w-4 h-4 text-saffron-600" /> Roster
          <span className="text-xs text-gray-400 font-normal">
            {roster.length}{maxMembers ? ` / ${maxMembers}` : ''}
          </span>
        </h2>
        {canManage && reviewDue && (
          <button onClick={confirmRoster} disabled={busy}
            className="btn-secondary text-xs flex items-center gap-1.5 disabled:opacity-60">
            <CheckCircle2 className="w-3.5 h-3.5" /> Confirm roster is current
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading roster...</p>
      ) : roster.length === 0 ? (
        <p className="text-sm text-gray-500">No members on the roster yet.</p>
      ) : (
        <div className="space-y-1.5">
          {roster.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg text-sm">
              <div>
                <span className="text-gray-800 font-medium">{r.member.firstName} {r.member.lastName ?? ''}</span>
                {r.roleInGroup !== 'MEMBER' && (
                  <span className="badge bg-saffron-50 text-saffron-700 text-xs ml-2">{r.roleInGroup}</span>
                )}
              </div>
              {canManage && (
                <button onClick={() => removeMember(r.memberId)} disabled={busy}
                  className="text-gray-400 hover:text-red-500 disabled:opacity-50" title="Remove from roster">
                  <UserMinus className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="pt-3 border-t border-gray-100 space-y-2">
          {atCapacity ? (
            <p className="text-xs text-amber-700">Roster is at its target size ({maxMembers}). Raise the limit in group settings to add more.</p>
          ) : (
            <>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={query} onChange={(e) => setQuery(e.target.value)}
                  className="form-input pl-9" placeholder="Search members to add..." />
              </div>
              {hits.length > 0 && (
                <div className="border border-gray-100 rounded-lg divide-y divide-gray-50 max-h-56 overflow-y-auto">
                  {hits.map((m) => (
                    <button key={m.id} onClick={() => addMember(m.id)} disabled={busy}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between disabled:opacity-50">
                      <span>{m.firstName} {m.lastName ?? ''}</span>
                      <span className="text-xs text-gray-400">{m.currentCity ?? ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
