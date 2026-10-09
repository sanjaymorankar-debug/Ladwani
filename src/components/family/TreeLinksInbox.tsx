'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Link2 } from 'lucide-react'

const FIELD: Record<string, string> = { firstName: 'First name', lastName: 'Surname', gender: 'Gender', dateOfBirth: 'Date of birth' }
const person = (p: any) => (p ? `${p.late ? 'Late ' : ''}${p.firstName} ${p.lastName ?? ''}${p.dateOfBirth ? ` · ${p.dateOfBirth}` : ''}` : '—')

/**
 * F22 — link requests. With `familyId`: the Karta's incoming requests (side
 * by side, choose the right value for each difference), sent ones and
 * placeholders. Without: the Operator's queue of disagreements to resolve.
 */
export default function TreeLinksInbox({ familyId }: { familyId?: string }) {
  const [data, setData] = useState<{ incoming: any[]; outgoing: any[]; review: any[] } | null>(null)
  const [choice, setChoice] = useState<Record<string, Record<string, string>>>({})
  const load = useCallback(() => {
    fetch(`/api/tree-links${familyId ? `?familyId=${familyId}` : ''}`).then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => {})
  }, [familyId])
  useEffect(() => { load() }, [load])

  const act = async (id: string, body: object) => {
    const res = await fetch(`/api/tree-links/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json()
    if (!res.ok) return toast.error(json.message)
    toast.success(json.message); load()
  }
  const reject = (id: string) => {
    const reason = window.prompt('Reason for rejecting')?.trim()
    if (reason) act(id, { action: 'reject', reason })
  }

  if (!data) return null
  const incoming = familyId ? data.incoming : []
  const review = familyId ? [] : data.review
  const outgoing = familyId ? data.outgoing : []
  if (!incoming.length && !review.length && !outgoing.length) return null

  const SideBySide = ({ l, decide }: { l: any; decide: boolean }) => (
    <div className="p-3 border border-gray-100 rounded-xl space-y-2 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <div><p className="text-xs text-gray-500">{l.from.family.name} family says</p><p className="font-medium">{person(l.from.person)}</p></div>
        <div><p className="text-xs text-gray-500">{l.to.family.name} family has</p><p className="font-medium">{person(l.to.person)}</p></div>
      </div>
      {l.note && <p className="text-xs text-gray-500">“{l.note}”</p>}
      {l.conflicts.map((c: any) => (
        <div key={c.field} className="bg-amber-50 rounded p-2">
          <p className="text-xs font-semibold text-amber-800">{FIELD[c.field] ?? c.field} differs</p>
          {(['from', 'to'] as const).map((side) => (
            <label key={side} className="flex items-center gap-2 text-xs">
              {decide && <input type="radio" name={`${l.id}-${c.field}`} checked={choice[l.id]?.[c.field] === side}
                onChange={() => setChoice({ ...choice, [l.id]: { ...(choice[l.id] ?? {}), [c.field]: side } })} />}
              {side === 'from' ? l.from.family.name : l.to.family.name}: {String(c[side])}
              {l.proposedResolution?.[c.field] === side && <span className="text-gray-400">(requester&apos;s choice)</span>}
              {l.status === 'OPERATOR_REVIEW' && l.resolution?.[c.field] === side && <span className="text-gray-400">(other Karta&apos;s choice)</span>}
            </label>
          ))}
        </div>
      ))}
      {decide && (
        <div className="flex gap-2">
          <button type="button" className="btn-primary text-xs"
            onClick={() => act(l.id, familyId ? { action: 'accept', resolution: choice[l.id] ?? {} } : { action: 'resolve', resolution: choice[l.id] ?? {} })}>
            {familyId ? 'Accept and merge' : 'Resolve and merge'}
          </button>
          <button type="button" className="btn-secondary text-xs" onClick={() => reject(l.id)}>Reject</button>
        </div>
      )}
    </div>
  )

  return (
    <div className="card space-y-3">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <Link2 className="w-5 h-5 text-indigo-600" /> {familyId ? 'Tree links' : 'Tree links to resolve'}
      </h2>
      {incoming.map((l) => (
        <div key={l.id}>
          {l.status === 'OPERATOR_REVIEW'
            ? <p className="text-xs text-blue-700 mb-1">Waiting for an Operator — the two Kartas chose differently.</p>
            : <p className="text-xs text-gray-500 mb-1">Is this the same person? Accepting merges the two records into one, shown in both trees.</p>}
          <SideBySide l={l} decide={l.status === 'PENDING'} />
        </div>
      ))}
      {review.map((l) => <SideBySide key={l.id} l={l} decide />)}
      {outgoing.map((l) => (
        <div key={l.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-2">
          <span>
            {person(l.from.person)} → {l.to.family.name} family{' '}
            <span className="text-xs text-gray-500">
              {l.status === 'PLACEHOLDER' ? '(choose the matching person: open them in the tree → Link to another family)' : l.status === 'OPERATOR_REVIEW' ? '(with an Operator)' : '(waiting for their Karta)'}
            </span>
          </span>
          <span className="flex gap-2">
            {l.status === 'PLACEHOLDER' && <Link href={`/family/${familyId}/tree`} className="text-xs text-indigo-700">Open tree</Link>}
            {['PLACEHOLDER', 'PENDING'].includes(l.status) && <button type="button" className="text-xs text-gray-500" onClick={() => act(l.id, { action: 'cancel' })}>Cancel</button>}
          </span>
        </div>
      ))}
    </div>
  )
}
