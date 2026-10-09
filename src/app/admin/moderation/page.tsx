'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

/** F34 / F36 — items reported for abuse; hidden ones (past the threshold) first. */
export default function ModerationPage() {
  const [items, setItems] = useState<any[] | null>(null)
  const load = () => fetch('/api/reports').then(async (r) => setItems(r.ok ? (await r.json()).items : []))
  useEffect(() => { load() }, [])
  const review = async (type: string, id: string, action: string) => {
    const note = action === 'remove' ? window.prompt('Note to the author (optional)') ?? undefined : undefined
    const res = await fetch('/api/reports/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, id, action, note }) })
    const json = await res.json()
    res.ok ? toast.success(json.message) : toast.error(json.message)
    load()
  }
  const link = (i: any) => (i.type === 'post' ? `/community/${i.id}` : i.type === 'photo' ? `/api/photos/${i.id}/file` : null)
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Reported content</h1>
      {items?.length === 0 && <p className="text-sm text-gray-500">Nothing reported.</p>}
      {(items ?? []).map((i) => (
        <div key={`${i.type}:${i.id}`} className="card text-sm flex items-center justify-between gap-3">
          <div>
            <p><strong>{i.type}</strong> · {i.count} report{i.count > 1 ? 's' : ''} {i.hidden && <span className="badge-orange text-xs">hidden</span>}</p>
            <p className="text-gray-500">{Array.from(new Set(i.reasons)).join(' · ')}</p>
            {link(i) && <Link href={link(i)!} target="_blank" className="text-saffron-600 text-xs">Open</Link>}
          </div>
          <span className="flex gap-2">
            <button className="btn-secondary text-xs" onClick={() => review(i.type, i.id, 'restore')}>Restore</button>
            <button className="btn-primary text-xs" onClick={() => review(i.type, i.id, 'remove')}>Remove</button>
          </span>
        </div>
      ))}
    </div>
  )
}
