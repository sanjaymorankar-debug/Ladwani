'use client'
import { BASE_PATH } from '@/lib/api-path'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Heart, Search, Loader2 } from 'lucide-react'

export default function SpouseLink({ memberId, onDone }: { memberId: string; onDone?: () => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [externalName, setExternalName] = useState('')
  // F23: marriage date; a spouse not on the site can be added as a person (for their side of the tree).
  const [marriageDate, setMarriageDate] = useState('')
  const [asPerson, setAsPerson] = useState(false)
  const [spouseGender, setSpouseGender] = useState('')
  const [spouseDob, setSpouseDob] = useState('')
  const [busy, setBusy] = useState(false)

  const search = async () => {
    if (!query.trim()) return
    const res = await fetch(`${BASE_PATH}/api/search?q=${encodeURIComponent(query)}`)
    const data = await res.json()
    setResults(data.members ?? [])
  }

  const submit = async (base: { spouseMemberId?: string; externalSpouseName?: string }) => {
    const payload: Record<string, unknown> = { ...base, ...(marriageDate ? { marriageDate } : {}) }
    if (base.externalSpouseName && asPerson) {
      const [firstName, ...rest] = base.externalSpouseName.trim().split(/\s+/)
      delete payload.externalSpouseName
      payload.newSpouse = { firstName, lastName: rest.join(' ') || null, gender: spouseGender, dateOfBirth: spouseDob || null }
    }
    setBusy(true)
    try {
      const res = await fetch(`${BASE_PATH}/api/members/${memberId}/spouse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? 'Failed')
      toast.success(json.message)
      setOpen(false)
      onDone?.()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary text-sm flex items-center gap-1.5">
        <Heart className="w-4 h-4 text-pink-500" /> Record Marriage / Link Spouse
      </button>
    )
  }

  return (
    <div className="card space-y-3 border-2 border-pink-100">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
        <Heart className="w-4 h-4 text-pink-500" /> Link Spouse
      </h3>
      <p className="text-xs text-gray-500">Sensitive changes like this may require Operator/Admin review before they take effect. Once recorded, the spouse&apos;s family Karta is asked to add them to that family too; nobody leaves their birth family.</p>
      <label className="form-label">Marriage date
        <input type="date" className="form-input text-sm" max={new Date().toISOString().slice(0, 10)} value={marriageDate} onChange={(e) => setMarriageDate(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), search())}
          className="form-input text-sm flex-1" placeholder="Search spouse by name..." />
        <button type="button" onClick={search} className="btn-secondary px-3"><Search className="w-4 h-4" /></button>
      </div>
      {results.length > 0 && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {results.map((m: any) => (
            <button key={m.id} type="button" disabled={busy} onClick={() => submit({ spouseMemberId: m.id })}
              className="w-full text-left p-2 bg-gray-50 hover:bg-pink-50 rounded-lg text-sm disabled:opacity-60">
              {m.firstName} {m.lastName ?? ''} {m.currentCity && <span className="text-gray-400">· {m.currentCity}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="border-t border-gray-100 pt-3">
        <label className="form-label">Spouse not on the platform?</label>
        <div className="flex gap-2">
          <input value={externalName} onChange={(e) => setExternalName(e.target.value)}
            className="form-input text-sm flex-1" placeholder="Spouse's full name" />
          <button type="button" disabled={busy || !externalName.trim() || (asPerson && !spouseGender)}
            onClick={() => submit({ externalSpouseName: externalName })}
            className="btn-primary text-sm px-3 disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record'}
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-600 mt-2">
          <input type="checkbox" checked={asPerson} onChange={(e) => setAsPerson(e.target.checked)} /> Add them as a person, so their side of the family tree can be built
        </label>
        {asPerson && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <select className="form-input text-sm" value={spouseGender} onChange={(e) => setSpouseGender(e.target.value)}>
              <option value="">Gender…</option><option value="MALE">Male</option><option value="FEMALE">Female</option>
            </select>
            <input type="date" className="form-input text-sm" title="Date of birth (optional)" value={spouseDob} onChange={(e) => setSpouseDob(e.target.value)} />
          </div>
        )}
      </div>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
    </div>
  )
}
