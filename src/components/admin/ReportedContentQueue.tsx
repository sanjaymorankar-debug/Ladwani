'use client'
import { BASE_PATH } from '@/lib/api-path'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

/** F34 / F36 — items reported for abuse; hidden ones (past the threshold) first. */
export default function ReportedContentQueue() {
  const [items, setItems] = useState<any[] | null>(null)
  const load = () => fetch(`${BASE_PATH}/api/reports`).then(async (r) => setItems(r.ok ? (await r.json()).items : []))
  useEffect(() => { load() }, [])
  const review = async (type: string, id: string, action: string) => {
    const note = action === 'remove' ? window.prompt('Note to the author (optional)') ?? undefined : undefined
    const res = await fetch(`${BASE_PATH}/api/reports/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, id, action, note }) })
    const json = await res.json()
    res.ok ? toast.success(json.message) : toast.error(json.message)
    load()
  }
  // Posts open in the app (next/link adds the base path); photo files are plain URLs, so they carry it themselves.
  const link = (i: any) => (i.type === 'post' ? { href: `/community/${i.id}`, app: true } : i.type === 'photo' ? { href: `${BASE_PATH}/api/photos/${i.id}/file`, app: false } : null)
  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-gray-900">Reported content</h2>
      {items?.length === 0 && <p className="text-sm text-gray-500">Nothing reported.</p>}
      {(items ?? []).map((i) => {
        const l = link(i)
        return (
          <div key={`${i.type}:${i.id}`} className="card text-sm flex items-center justify-between gap-3">
            <div>
              <p><strong>{i.type}</strong> · {i.count} report{i.count > 1 ? 's' : ''} {i.hidden && <span className="badge-orange text-xs">hidden</span>}</p>
              <p className="text-gray-500">{Array.from(new Set(i.reasons)).join(' · ')}</p>
              {l && (l.app
                ? <Link href={l.href} target="_blank" className="text-saffron-600 text-xs">Open</Link>
                : <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-saffron-600 text-xs">Open</a>)}
            </div>
            <span className="flex gap-2">
              <button className="btn-secondary text-xs" onClick={() => review(i.type, i.id, 'restore')}>Restore</button>
              <button className="btn-primary text-xs" onClick={() => review(i.type, i.id, 'remove')}>Remove</button>
            </span>
          </div>
        )
      })}
    </div>
  )
}
