'use client'
import { BASE_PATH } from '@/lib/api-path'
import { useEffect, useState } from 'react'

interface RelType { code: string; label: string; localName: string | null; genderApplicable: string | null }

let cache: RelType[] | null = null

/** The relationship master (workbook "Relationships" sheet) as a dropdown, filtered by gender when known. */
export default function RelationshipSelect({ value, onChange, gender, id }: {
  value: string; onChange: (code: string) => void; gender?: string | null; id?: string
}) {
  const [types, setTypes] = useState<RelType[]>(cache ?? [])
  useEffect(() => {
    if (cache) return
    fetch(`${BASE_PATH}/api/relationship-types`).then((r) => r.json()).then((d) => { cache = d.types ?? []; setTypes(cache!) })
  }, [])
  const shown = types.filter((t) => !gender || !['MALE', 'FEMALE'].includes(gender) || !t.genderApplicable || ['ANY', gender].includes(t.genderApplicable))
  return (
    <select id={id} className="form-input text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Relationship…</option>
      {shown.map((t) => <option key={t.code} value={t.code}>{t.label}{t.localName ? ` (${t.localName})` : ''}</option>)}
    </select>
  )
}
