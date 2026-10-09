'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Users, Search, BellOff, Bell } from 'lucide-react'

interface MyGroup { id: string; name: string; description: string | null; memberCount: number; notifyMode: string; isMuted: boolean; parentGroupId: string | null; district: string | null }
interface DirGroup { id: string; name: string; description: string | null; category: string; memberCount: number; subGroupCount: number }

export default function InterestGroupsPage() {
  const [tab, setTab] = useState<'mine' | 'browse'>('mine')
  const [mine, setMine] = useState<MyGroup[]>([])
  const [all, setAll] = useState<DirGroup[]>([])
  const [q, setQ] = useState('')

  const loadMine = () => fetch('/api/interest-groups?mine=true').then((r) => r.json()).then((d) => setMine(d.groups ?? []))
  const loadAll = () => fetch(`/api/interest-groups${q ? `?q=${encodeURIComponent(q)}` : ''}`).then((r) => r.json()).then((d) => setAll(d.groups ?? []))
  useEffect(() => { loadMine(); loadAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const call = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    const json = await res.json()
    toast[res.ok ? 'success' : 'error'](json.message)
    await Promise.all([loadMine(), loadAll()])
  }
  const myIds = new Set(mine.map((g) => g.id))
  const byCategory = all.reduce<Record<string, DirGroup[]>>((acc, g) => ((acc[g.category] ??= []).push(g), acc), {})

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2"><Users className="w-5 h-5" /> Interest Groups</h1>
        <p className="text-sm text-gray-500">Groups made from members’ hobbies and interests. Only your name, photo, city and hobby level are visible inside a group.</p>
      </div>
      <div className="flex gap-2">
        {(['mine', 'browse'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-full text-sm ${tab === t ? 'bg-saffron-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
            {t === 'mine' ? `My groups (${mine.length})` : 'Browse all'}
          </button>
        ))}
      </div>

      {tab === 'mine' && (
        <div className="space-y-3">
          {mine.length === 0 && (
            <div className="card text-sm text-gray-600">
              You are not in any interest group yet. Add hobbies in <Link className="underline" href="/profile">Additional Details</Link> and you’ll be added automatically, or browse and join.
            </div>
          )}
          {mine.map((g) => (
            <div key={g.id} className="card flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div>
                <Link href={`/interest-groups/${g.id}`} className="font-semibold text-gray-900 hover:text-saffron-700">{g.name}</Link>
                <p className="text-xs text-gray-500">{g.memberCount} member{g.memberCount === 1 ? '' : 's'}{g.district ? ` · ${g.district}` : ''}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label className="sr-only" htmlFor={`n-${g.id}`}>Notifications</label>
                <select id={`n-${g.id}`} className="form-input py-1 text-sm w-auto" value={g.notifyMode} disabled={g.isMuted}
                  onChange={(e) => call(`/api/interest-groups/${g.id}/membership`, 'PATCH', { notifyMode: e.target.value })}>
                  <option value="DAILY_DIGEST">Daily digest</option>
                  <option value="EVERY_POST">Every post</option>
                </select>
                <button className="btn-ghost text-sm flex items-center gap-1" onClick={() => call(`/api/interest-groups/${g.id}/membership`, 'PATCH', { isMuted: !g.isMuted })}>
                  {g.isMuted ? <><Bell className="w-4 h-4" /> Unmute</> : <><BellOff className="w-4 h-4" /> Mute</>}
                </button>
                <button className="btn-ghost text-sm text-red-600" onClick={() => confirm(`Leave ${g.name}? You won't be added back automatically.`) && call(`/api/interest-groups/${g.id}/membership`, 'DELETE')}>Leave</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'browse' && (
        <div className="space-y-4">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); loadAll() }}>
            <input className="form-input" placeholder="Search groups" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search groups" />
            <button className="btn-secondary flex items-center gap-1"><Search className="w-4 h-4" /> Search</button>
          </form>
          {Object.entries(byCategory).map(([cat, groups]) => (
            <div key={cat}>
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">{cat}</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {groups.map((g) => (
                  <div key={g.id} className="card flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/interest-groups/${g.id}`} className="font-medium text-gray-900 hover:text-saffron-700">{g.name}</Link>
                      <p className="text-xs text-gray-500">{g.memberCount} member{g.memberCount === 1 ? '' : 's'}{g.subGroupCount ? ` · ${g.subGroupCount} district groups` : ''}</p>
                    </div>
                    {myIds.has(g.id)
                      ? <span className="badge-green text-xs">Joined</span>
                      : <button className="btn-secondary text-sm" onClick={() => call(`/api/interest-groups/${g.id}/membership`, 'POST')}>Join</button>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {all.length === 0 && <p className="text-sm text-gray-500">No groups yet — they appear as members add hobbies.</p>}
        </div>
      )}
    </div>
  )
}
