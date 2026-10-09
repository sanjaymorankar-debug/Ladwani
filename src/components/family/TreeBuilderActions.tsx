'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

type Person = { id: string; firstName: string; generation: number; maritalStatus?: string | null; role?: string | null }
const post = async (url: string, body: unknown) => {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { res, json: await res.json().catch(() => ({})) }
}

/** One person in a pair or a sibling: name, birth date or year, alive / expired. */
function PersonFields({ label, value, onChange, withGender }: { label: string; value: any; onChange: (v: any) => void; withGender?: boolean }) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v })
  return (
    <fieldset className="space-y-1.5 border border-gray-100 rounded-lg p-2">
      <legend className="text-xs font-semibold text-gray-600 px-1">{label}</legend>
      <input className="form-input text-sm" placeholder="First name" value={value.firstName ?? ''} onChange={(e) => set('firstName', e.target.value)} />
      <input className="form-input text-sm" placeholder="Surname (optional)" value={value.lastName ?? ''} onChange={(e) => set('lastName', e.target.value)} />
      {withGender && (
        <select className="form-input text-sm" value={value.gender ?? ''} onChange={(e) => set('gender', e.target.value)}>
          <option value="">Gender…</option><option value="MALE">Male</option><option value="FEMALE">Female</option>
        </select>
      )}
      <input className="form-input text-sm" type="number" placeholder="Birth year (or leave blank)" value={value.birthYear ?? ''} onChange={(e) => set('birthYear', e.target.value)} />
      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input type="checkbox" checked={value.alive === false} onChange={(e) => set('alive', !e.target.checked)} /> Expired
      </label>
      {value.alive === false && (
        <input className="form-input text-sm" type="date" title="Date of death (optional)" value={value.deceasedAt ?? ''} onChange={(e) => set('deceasedAt', e.target.value)} />
      )}
    </fieldset>
  )
}

/**
 * Tree builder from a person's card: add parents (F19 ancestors, F20 spouse
 * side), add a sibling (F21), link to the same person in another family (F22).
 */
export default function TreeBuilderActions({ familyId, person, canEdit, onChanged }: {
  familyId: string; person: Person; canEdit: boolean; onChanged: () => void
}) {
  const [open, setOpen] = useState<'parents' | 'sibling' | 'link' | null>(null)
  const [father, setFather] = useState<any>({ alive: true })
  const [mother, setMother] = useState<any>({ alive: true })
  const [sib, setSib] = useState<any>({ alive: true })
  const [busy, setBusy] = useState(false)
  // F21 "has own family on site" / F22 target search.
  const [famQ, setFamQ] = useState('')
  const [families, setFamilies] = useState<any[]>([])
  const [target, setTarget] = useState<any>(null)
  const [people, setPeople] = useState<any[]>([])
  const [conflicts, setConflicts] = useState<any[] | null>(null)
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [toMemberId, setToMemberId] = useState('')

  const searchFamilies = async () => {
    const r = await fetch(`/api/families?q=${encodeURIComponent(famQ)}`)
    const j = await r.json()
    setFamilies((j.families ?? []).filter((f: any) => f.id !== familyId))
  }
  const pickFamily = async (f: any) => {
    setTarget(f); setFamilies([])
    if (open === 'link') {
      const r = await fetch(`/api/tree-links/candidates?familyId=${f.id}&q=${encodeURIComponent(person.firstName)}`)
      setPeople((await r.json()).people ?? [])
    }
  }

  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn() } finally { setBusy(false) } }

  const saveParents = () => run(async () => {
    const { res, json } = await post(`/api/families/${familyId}/tree/parents`, { childMemberId: person.id, father, mother })
    if (!res.ok) return void toast.error(json.message)
    toast.success(json.message); setOpen(null); onChanged()
  })
  const saveSibling = () => run(async () => {
    const { res, json } = await post(`/api/families/${familyId}/tree/siblings`, { ofMemberId: person.id, ...sib, linkFamilyId: target?.id })
    if (!res.ok) return void toast.error(json.message)
    toast.success(json.linkPlaceholder ? 'Sibling added. Link them to the person in the other family from your requests.' : json.message)
    setOpen(null); onChanged()
  })
  const sendLink = () => run(async () => {
    const { res, json } = await post('/api/tree-links', {
      fromFamilyId: familyId, fromMemberId: person.id, toFamilyId: target?.id, toMemberId,
      ...(conflicts ? { proposedResolution: choice } : {}),
    })
    if (res.status === 422) { setConflicts(json.conflicts); return void toast('The two records differ — choose the correct value for each') }
    if (!res.ok) return void toast.error(json.message)
    toast.success(json.message); setOpen(null)
  })

  return (
    <div className="border-t border-gray-100 pt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary text-xs" onClick={() => setOpen(open === 'parents' ? null : 'parents')}>Add parents</button>
        <button type="button" className="btn-secondary text-xs" onClick={() => setOpen(open === 'sibling' ? null : 'sibling')}>Add sibling</button>
        {canEdit && <button type="button" className="btn-secondary text-xs" onClick={() => { setOpen(open === 'link' ? null : 'link'); setTarget(null); setConflicts(null) }}>Link to another family</button>}
      </div>

      {open === 'parents' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Parents of {person.firstName}, entered as a husband and wife pair.</p>
          <PersonFields label="Father" value={father} onChange={setFather} />
          <PersonFields label="Mother" value={mother} onChange={setMother} />
          <button type="button" disabled={busy} className="btn-primary text-sm w-full" onClick={saveParents}>Save parents</button>
        </div>
      )}

      {open === 'sibling' && (
        <div className="space-y-2">
          <PersonFields label={`Brother or sister of ${person.firstName}`} value={sib} onChange={setSib} withGender />
          <select className="form-input text-sm" value={sib.maritalStatus ?? ''} onChange={(e) => setSib({ ...sib, maritalStatus: e.target.value })}>
            <option value="">Marital status…</option><option value="UNMARRIED">Unmarried</option><option value="MARRIED">Married</option>
            <option value="WIDOWED">Widowed</option><option value="DIVORCED">Divorced</option>
          </select>
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-600">Has own family on the site?</summary>
            <div className="flex gap-1 mt-1">
              <input className="form-input text-sm flex-1" placeholder="Family name" value={famQ} onChange={(e) => setFamQ(e.target.value)} />
              <button type="button" className="btn-secondary text-xs" onClick={searchFamilies}>Find</button>
            </div>
            {families.map((f) => <button key={f.id} type="button" className="block text-left text-sm text-indigo-700 mt-1" onClick={() => pickFamily(f)}>{f.name} {f.nativeVillage ? `· ${f.nativeVillage}` : ''}</button>)}
            {target && <p className="text-xs text-green-700 mt-1">Will be linked to the {target.name} family.</p>}
          </details>
          <button type="button" disabled={busy} className="btn-primary text-sm w-full" onClick={saveSibling}>Save sibling</button>
        </div>
      )}

      {open === 'link' && (
        <div className="space-y-2 text-sm">
          <p className="text-xs text-gray-500">Is {person.firstName} the same person as someone in another family&apos;s tree? Their Karta must accept.</p>
          {!target ? (
            <>
              <div className="flex gap-1">
                <input className="form-input text-sm flex-1" placeholder="Search family" value={famQ} onChange={(e) => setFamQ(e.target.value)} />
                <button type="button" className="btn-secondary text-xs" onClick={searchFamilies}>Find</button>
              </div>
              {families.map((f) => <button key={f.id} type="button" className="block text-left text-indigo-700" onClick={() => pickFamily(f)}>{f.name} {f.karta ? `· Karta ${f.karta.firstName} ${f.karta.lastName ?? ''}` : ''}</button>)}
            </>
          ) : (
            <>
              <p className="font-medium">{target.name} family</p>
              <select className="form-input text-sm" value={toMemberId} onChange={(e) => { setToMemberId(e.target.value); setConflicts(null) }}>
                <option value="">Choose the matching person…</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.late ? 'Late ' : ''}{p.name}{p.birthYear ? ` (b. ${p.birthYear})` : ''}</option>)}
              </select>
              {conflicts && conflicts.map((c) => (
                <div key={c.field} className="bg-amber-50 rounded p-2">
                  <p className="text-xs font-semibold text-amber-800">{c.field}</p>
                  {(['from', 'to'] as const).map((side) => (
                    <label key={side} className="flex items-center gap-2 text-xs">
                      <input type="radio" name={c.field} checked={choice[c.field] === side} onChange={() => setChoice({ ...choice, [c.field]: side })} />
                      {side === 'from' ? 'Ours' : 'Theirs'}: {String(c[side])}
                    </label>
                  ))}
                </div>
              ))}
              <button type="button" disabled={busy || !toMemberId} className="btn-primary text-sm w-full" onClick={sendLink}>Send link request</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
