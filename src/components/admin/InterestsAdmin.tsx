'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { INTEREST_CATEGORIES } from '@/lib/interest-master'
import { BASE_PATH } from '@/lib/api-path'

export default function InterestsAdmin() {
  const [items, setItems] = useState<any[]>([])
  const [mergeTarget, setMergeTarget] = useState<Record<string, string>>({})
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState(INTEREST_CATEGORIES[0])
  const load = () => fetch(`${BASE_PATH}/api/admin/interests`).then((r) => r.json()).then((d) => setItems(d.interests ?? []))
  useEffect(() => { load() }, [])

  const patch = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`${BASE_PATH}/api/admin/interests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    toast[res.ok ? 'success' : 'error']((await res.json()).message)
    load()
  }
  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch(`${BASE_PATH}/api/admin/interests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName, category: newCategory }) })
    const body = await res.json()
    toast[res.ok ? 'success' : 'error'](res.ok ? 'Added' : body.message)
    if (res.ok) setNewName('')
    load()
  }
  const pending = items.filter((i) => i.status === 'PENDING')
  const approved = items.filter((i) => i.status === 'APPROVED')

  return (
    <div className="space-y-5">
      <div className="card space-y-3">
        <h2 className="font-semibold">Waiting for approval ({pending.length})</h2>
        {pending.length === 0 && <p className="text-sm text-gray-500">Nothing waiting.</p>}
        {pending.map((i) => (
          <div key={i.id} className="flex flex-wrap items-center gap-2 text-sm border-b border-gray-50 pb-2">
            <span className="font-medium flex-1 min-w-[8rem]">{i.name} <span className="text-gray-400">({i._count.hobbies} members)</span></span>
            <button className="btn-primary text-xs" onClick={() => patch(i.id, { action: 'approve' })}>Approve</button>
            <select className="form-input py-1 text-xs w-auto" value={mergeTarget[i.id] ?? ''} onChange={(e) => setMergeTarget({ ...mergeTarget, [i.id]: e.target.value })} aria-label={`Merge ${i.name} into`}>
              <option value="">Merge into…</option>
              {approved.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button className="btn-secondary text-xs" disabled={!mergeTarget[i.id]} onClick={() => patch(i.id, { action: 'merge', mergeIntoId: mergeTarget[i.id] })}>Merge</button>
            <button className="btn-ghost text-xs text-red-600" onClick={() => patch(i.id, { action: 'reject' })}>Reject</button>
          </div>
        ))}
      </div>

      <form onSubmit={add} className="card flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[10rem]"><label className="form-label" htmlFor="nn">Add a hobby</label><input id="nn" className="form-input" value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
        <div><label className="form-label" htmlFor="nc">Category</label>
          <select id="nc" className="form-input" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>{INTEREST_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        <button className="btn-primary">Add</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500"><th className="py-1">Hobby</th><th>Category</th><th>Members</th><th>Sport</th><th>Child-safe</th><th>Active</th></tr></thead>
          <tbody>
            {approved.map((i) => (
              <tr key={i.id} className="border-t border-gray-50">
                <td className="py-1.5">{i.name}</td>
                <td>{i.category}</td>
                <td>{i._count.hobbies + i._count.sports}</td>
                <td><input type="checkbox" checked={!!i.isSport} onChange={(e) => patch(i.id, { action: 'update', isSport: e.target.checked })} aria-label={`${i.name} is a sport`} /></td>
                <td><input type="checkbox" checked={!!i.isChildSafe} onChange={(e) => patch(i.id, { action: 'update', isChildSafe: e.target.checked })} aria-label={`${i.name} is child-safe`} /></td>
                <td><input type="checkbox" checked={i.isActive !== false} onChange={(e) => patch(i.id, { action: 'update', isActive: e.target.checked })} aria-label={`${i.name} is active`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
