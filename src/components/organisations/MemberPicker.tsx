'use client'
import { useState } from 'react'

/** Search registered members by name (the redacted directory search) and pick one. */
export default function MemberPicker({ label, value, onPick }: { label: string; value: { id: string; name: string } | null; onPick: (m: { id: string; name: string } | null) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<any[]>([])
  const search = async () => {
    if (!q.trim()) return
    const d = await (await fetch(`/api/search?q=${encodeURIComponent(q)}`)).json()
    setResults(d.members ?? [])
  }
  return (
    <div>
      <label className="form-label">{label}</label>
      {value ? (
        <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
          <span>{value.name}</span>
          <button type="button" className="text-xs text-gray-500" onClick={() => onPick(null)}>Change</button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input className="form-input text-sm flex-1" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), search())} />
            <button type="button" className="btn-secondary text-xs" onClick={search}>Find</button>
          </div>
          {results.map((m) => (
            <button key={m.id} type="button" className="block w-full text-left text-sm px-2 py-1 hover:bg-saffron-50 rounded"
              onClick={() => { onPick({ id: m.id, name: `${m.firstName} ${m.lastName ?? ''}`.trim() }); setResults([]) }}>
              {m.firstName} {m.lastName ?? ''} {m.memberNumber ? <span className="text-gray-400">· {m.memberNumber}</span> : null}
            </button>
          ))}
        </>
      )}
    </div>
  )
}
