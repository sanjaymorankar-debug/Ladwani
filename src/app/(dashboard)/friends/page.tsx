'use client'
import { BASE_PATH } from '@/lib/api-path'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { UserPlus, Users } from 'lucide-react'

/** F35 — find members, friend requests, friends and named lists. */
export default function FriendsPage() {
  const [data, setData] = useState<any>(null)
  const [q, setQ] = useState({ q: '', gotra: '', mulGaon: '', district: '' })
  const [found, setFound] = useState<any[]>([])
  const [listName, setListName] = useState('')
  const load = () => fetch(`${BASE_PATH}/api/friends`).then((r) => r.json()).then(setData)
  useEffect(() => { load() }, [])
  const call = async (url: string, method: string, body?: object) => {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    const json = await res.json()
    if (!res.ok) { toast.error(json.message); return false }
    toast.success(json.message); load(); return true
  }
  const search = async () => {
    const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])
    setFound((await (await fetch(`${BASE_PATH}/api/friends/search?${qs}`)).json()).people ?? [])
  }
  if (!data) return null
  const friendIds = new Set(data.friends.map((f: any) => f.memberId))

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Users className="w-5 h-5 text-saffron-600" /> Friends</h1>

      <div className="card space-y-2">
        <h2 className="font-semibold text-gray-900">Find members</h2>
        <div className="grid sm:grid-cols-4 gap-2">
          {(['q', 'gotra', 'mulGaon', 'district'] as const).map((k) => (
            <input key={k} className="form-input text-sm" placeholder={{ q: 'Name', gotra: 'Gotra', mulGaon: 'Mul Gaon', district: 'District' }[k]}
              value={q[k]} onChange={(e) => setQ({ ...q, [k]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && search()} />
          ))}
        </div>
        <button className="btn-secondary text-sm" onClick={search}>Search</button>
        {found.map((p) => (
          <div key={p.memberId} className="flex items-center justify-between text-sm py-1 border-b border-gray-50">
            <span><strong>{p.name}</strong> <span className="text-gray-500">· {[p.mulGaon, p.district, p.gotra && `Gotra ${p.gotra}`, p.families.join(', ')].filter(Boolean).join(' · ')}</span></span>
            {!friendIds.has(p.memberId) && <button className="text-saffron-700 text-xs flex items-center gap-1" onClick={() => call(`${BASE_PATH}/api/friends`, 'POST', { memberId: p.memberId })}><UserPlus className="w-3.5 h-3.5" /> Add friend</button>}
          </div>
        ))}
      </div>

      {(data.incoming.length > 0 || data.outgoing.length > 0) && (
        <div className="card space-y-1 text-sm">
          <h2 className="font-semibold text-gray-900">Requests</h2>
          {data.incoming.map((r: any) => (
            <div key={r.friendshipId} className="flex items-center justify-between">
              <span>{r.name} wants to be friends</span>
              <span className="flex gap-2 text-xs">
                <button className="text-green-700" onClick={() => call(`${BASE_PATH}/api/friends/${r.friendshipId}`, 'POST', { action: 'accept' })}>Accept</button>
                <button className="text-gray-500" onClick={() => call(`${BASE_PATH}/api/friends/${r.friendshipId}`, 'POST', { action: 'decline' })}>Decline</button>
              </span>
            </div>
          ))}
          {data.outgoing.map((r: any) => (
            <div key={r.friendshipId} className="flex items-center justify-between text-gray-500">
              <span>Sent to {r.name}</span>
              <button className="text-xs" onClick={() => call(`${BASE_PATH}/api/friends/${r.friendshipId}`, 'POST', { action: 'cancel' })}>Cancel</button>
            </div>
          ))}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-5">
        <div className="card space-y-1 text-sm">
          <h2 className="font-semibold text-gray-900">My friends ({data.friends.length})</h2>
          {data.friends.map((f: any) => (
            <div key={f.friendshipId} className="flex items-center justify-between">
              <span>{f.name}</span>
              <span className="flex items-center gap-2">
                {data.lists.length > 0 && (
                  <select className="border rounded text-xs" value="" onChange={(e) => e.target.value && call(`${BASE_PATH}/api/friend-lists/${e.target.value}/members`, 'POST', { memberId: f.memberId })}>
                    <option value="">Add to list…</option>
                    {data.lists.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                )}
                <button className="text-xs text-red-600" onClick={() => window.confirm(`Remove ${f.name}? They leave all your lists.`) && call(`${BASE_PATH}/api/friends/${f.friendshipId}`, 'POST', { action: 'remove' })}>Remove</button>
              </span>
            </div>
          ))}
        </div>
        <div className="card space-y-2 text-sm">
          <h2 className="font-semibold text-gray-900">Friend lists</h2>
          <div className="flex gap-2">
            <input className="form-input text-sm flex-1" placeholder="e.g. School friends" value={listName} onChange={(e) => setListName(e.target.value)} />
            <button className="btn-secondary text-xs" onClick={async () => { if (await call(`${BASE_PATH}/api/friend-lists`, 'POST', { name: listName })) setListName('') }}>Create</button>
          </div>
          {data.lists.map((l: any) => (
            <div key={l.id} className="border-t border-gray-50 pt-1">
              <div className="flex items-center justify-between">
                <strong>{l.name}</strong>
                <button className="text-xs text-gray-500" onClick={() => window.confirm('Delete this list?') && call(`${BASE_PATH}/api/friend-lists/${l.id}`, 'DELETE')}>Delete</button>
              </div>
              {l.members.map((m: any) => m && (
                <div key={m.memberId} className="flex items-center justify-between pl-2 text-gray-600">
                  <span>{m.name}</span>
                  <button className="text-xs" onClick={() => call(`${BASE_PATH}/api/friend-lists/${l.id}/members?memberId=${m.memberId}`, 'DELETE')}>×</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
