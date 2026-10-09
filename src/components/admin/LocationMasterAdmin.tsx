'use client'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, ChevronRight, ChevronDown } from 'lucide-react'

interface Area {
  id: string
  name: string
  type: string
  code: string | null
  parentId: string | null
  isActive: boolean
}

// What may be added under each level (mirrors LOCATION_PARENT in src/lib/scope.ts;
// the API enforces it).
const CHILD_TYPES: Record<string, string[]> = {
  ROOT: ['COUNTRY', 'STATE'],
  COUNTRY: ['STATE'],
  STATE: ['DISTRICT', 'CITY'],
  DISTRICT: ['TALUKA', 'CITY'],
  TALUKA: ['VILLAGE', 'CITY'],
}

/** P0 location master (State > District > Taluka > Village). */
export default function LocationMasterAdmin() {
  const [areas, setAreas] = useState<Area[]>([])
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [adding, setAdding] = useState<{ parentId: string | null; type: string } | null>(null)
  const [name, setName] = useState('')

  const load = () => fetch('/api/admin/areas').then((r) => r.json()).then((d) => setAreas(d.areas ?? []))
  useEffect(() => { load() }, [])

  const children = useMemo(() => {
    const map = new Map<string | null, Area[]>()
    for (const a of areas) map.set(a.parentId, [...(map.get(a.parentId) ?? []), a])
    return map
  }, [areas])

  const call = async (url: string, init: RequestInit, ok: string) => {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(json.message ?? 'Failed'); return false }
    toast.success(ok)
    await load()
    return true
  }

  const add = async () => {
    if (!adding) return
    const ok = await call('/api/admin/areas', {
      method: 'POST',
      body: JSON.stringify({ name, type: adding.type, parentId: adding.parentId }),
    }, `${adding.type.toLowerCase()} added`)
    if (ok) {
      if (adding.parentId) setOpen((o) => ({ ...o, [adding.parentId!]: true }))
      setAdding(null); setName('')
    }
  }

  const rename = (a: Area) => {
    const next = window.prompt(`Rename ${a.type.toLowerCase()}`, a.name)
    if (next && next.trim() !== a.name) call(`/api/admin/areas/${a.id}`, { method: 'PATCH', body: JSON.stringify({ name: next }) }, 'Renamed')
  }

  const addForm = (parentId: string | null, parentType: string) => {
    const types = CHILD_TYPES[parentType] ?? []
    if (!types.length) return null
    if (adding && adding.parentId === parentId) {
      return (
        <div className="flex gap-2 py-1.5 pl-6">
          <select value={adding.type} onChange={(e) => setAdding({ parentId, type: e.target.value })} className="form-input text-sm w-32">
            {types.map((t) => <option key={t} value={t}>{t.toLowerCase()}</option>)}
          </select>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="form-input text-sm flex-1" placeholder="Name" />
          <button type="button" onClick={add} className="btn-primary text-sm">Add</button>
          <button type="button" onClick={() => { setAdding(null); setName('') }} className="btn-ghost text-sm">Cancel</button>
        </div>
      )
    }
    return (
      <button type="button" onClick={() => { setAdding({ parentId, type: types[0] }); setName('') }}
        className="flex items-center gap-1 py-1 pl-6 text-xs text-saffron-600 hover:text-saffron-700">
        <Plus className="w-3.5 h-3.5" /> Add {types.map((t) => t.toLowerCase()).join(' / ')}
      </button>
    )
  }

  const renderLevel = (parentId: string | null, depth: number): JSX.Element[] =>
    (children.get(parentId) ?? []).map((a) => {
      const kids = children.get(a.id) ?? []
      const isOpen = open[a.id] ?? depth < 2
      return (
        <div key={a.id} style={{ marginLeft: depth ? 16 : 0 }}>
          <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <button type="button" className="flex items-center gap-1 min-w-0 text-left"
              onClick={() => setOpen((o) => ({ ...o, [a.id]: !isOpen }))}>
              {kids.length || CHILD_TYPES[a.type] ? (isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />) : <span className="w-4" />}
              <span className={a.isActive ? 'text-gray-900' : 'text-gray-400 line-through'}>{a.name}</span>
              <span className="text-xs text-gray-400 ml-1">{a.type.toLowerCase()}</span>
            </button>
            <div className="flex gap-3 text-xs flex-shrink-0">
              <button type="button" onClick={() => rename(a)} className="text-gray-600 hover:text-gray-900">Rename</button>
              <button type="button" onClick={() => call(`/api/admin/areas/${a.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !a.isActive }) }, a.isActive ? 'Deactivated' : 'Reactivated')}
                className={a.isActive ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}>
                {a.isActive ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          </div>
          {isOpen && (
            <>
              {renderLevel(a.id, depth + 1)}
              {addForm(a.id, a.type)}
            </>
          )}
        </div>
      )
    })

  return (
    <div className="card">
      {areas.length === 0 && <p className="text-sm text-gray-500 pb-2">No locations yet.</p>}
      {renderLevel(null, 0)}
      {addForm(null, 'ROOT')}
    </div>
  )
}
