'use client'
import { BASE_PATH } from '@/lib/api-path'
import { useEffect, useState } from 'react'

interface AreaOption { id: string; name: string; type: string }

/**
 * F01/F02: State › District › Taluka › Village (or City) from the location
 * master. Calls onChange with the chosen village / city id (or '' while the
 * chain is incomplete). Reads the public /api/areas endpoint, so it works on
 * the registration page before sign-in.
 */
const LEVELS = [
  { label: 'State', types: ['STATE'] },
  { label: 'District', types: ['DISTRICT', 'CITY'] },
  { label: 'Taluka', types: ['TALUKA', 'CITY'] },
  { label: 'Village / City', types: ['VILLAGE', 'CITY'] },
]

export default function AreaCascadePicker({ onChange, idPrefix = 'area', upTo }: {
  onChange: (areaId: string) => void; idPrefix?: string
  /** Stop early: at the district (State › District), or at the taluka (F26 local organisations: State › District › Taluka). */
  upTo?: 'DISTRICT' | 'TALUKA'
}) {
  const levels = upTo === 'DISTRICT' ? LEVELS.slice(0, 2).map((l, i) => (i === 1 ? { ...l, types: ['DISTRICT'] } : l))
    : upTo === 'TALUKA' ? LEVELS.slice(0, 3).map((l, i) => (i === 1 ? { ...l, types: ['DISTRICT'] } : l))
    : LEVELS
  const [options, setOptions] = useState<AreaOption[][]>([[], [], [], []])
  const [chosen, setChosen] = useState<string[]>(['', '', '', ''])

  const load = (level: number, parentId?: string) =>
    fetch(parentId ? `${BASE_PATH}/api/areas?parentId=${parentId}` : `${BASE_PATH}/api/areas`)
      .then((r) => r.json())
      .then((d) => setOptions((prev) => {
        const next = [...prev]
        next[level] = (d.areas ?? []).filter((a: AreaOption) => levels[level].types.includes(a.type))
        for (let i = level + 1; i < next.length; i++) next[i] = []
        return next
      }))

  useEffect(() => { load(0) }, [])

  const pick = (level: number, id: string) => {
    const next = chosen.map((v, i) => (i < level ? v : i === level ? id : ''))
    setChosen(next)
    const picked = options[level].find((o) => o.id === id)
    // A city can stand in for the lower levels.
    if (picked && (picked.type === 'VILLAGE' || picked.type === 'CITY' || (upTo === 'DISTRICT' && picked.type === 'DISTRICT') || (upTo === 'TALUKA' && picked.type === 'TALUKA'))) {
      onChange(id)
      setOptions((prev) => prev.map((o, i) => (i > level ? [] : o)))
      return
    }
    onChange('')
    if (id && level < levels.length - 1) load(level + 1, id)
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {levels.map((lvl, i) => (
        <div key={lvl.label}>
          <label htmlFor={`${idPrefix}-${i}`} className="form-label">{lvl.label}</label>
          <select id={`${idPrefix}-${i}`} className="form-input" value={chosen[i]} disabled={i > 0 && !options[i].length}
            onChange={(e) => pick(i, e.target.value)}>
            <option value="">{i > 0 && !options[i].length ? '—' : `Select ${lvl.label.toLowerCase()}`}</option>
            {options[i].map((o) => <option key={o.id} value={o.id}>{o.name}{o.type === 'CITY' ? ' (city)' : ''}</option>)}
          </select>
        </div>
      ))}
    </div>
  )
}
