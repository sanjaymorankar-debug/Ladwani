'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, MapPin, GraduationCap, Briefcase } from 'lucide-react'
import AreaCascadePicker from '@/components/shared/AreaCascadePicker'
import SendInterestButton from './SendInterestButton'

const INCOME: Record<string, string> = { BELOW_2L: 'Below ₹2 L', '2L_5L': '₹2–5 L', '5L_10L': '₹5–10 L', '10L_25L': '₹10–25 L', '25L_50L': '₹25–50 L', ABOVE_50L: 'Above ₹50 L', NOT_SAY: 'Not stated' }

/** F38 search: age, education, occupation, district, Gotra. Limited cards; same-Gotra flagged. */
export default function BureauBrowser() {
  const [f, setF] = useState({ gender: '', minAge: '', maxAge: '', education: '', occupation: '', gotra: '', district: '' })
  const [profiles, setProfiles] = useState<any[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }))
  const search = useCallback(async (filters = f) => {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][])
    const res = await fetch(`/api/matrimony/profiles?${qs}`)
    const json = await res.json()
    if (!res.ok) { setError(json.message); setProfiles([]); return }
    setError(null); setProfiles(json.profiles)
  }, [f])
  useEffect(() => { search() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="card grid sm:grid-cols-4 gap-2 text-sm">
        <select className="form-input" value={f.gender} onChange={(e) => set('gender', e.target.value)}>
          <option value="">Bride or groom</option><option value="FEMALE">Bride</option><option value="MALE">Groom</option>
        </select>
        <input className="form-input" type="number" placeholder="Min age" value={f.minAge} onChange={(e) => set('minAge', e.target.value)} />
        <input className="form-input" type="number" placeholder="Max age" value={f.maxAge} onChange={(e) => set('maxAge', e.target.value)} />
        <select className="form-input" value={f.education} onChange={(e) => set('education', e.target.value)}>
          <option value="">Any education</option>
          {[['SCHOOL', 'School'], ['DIPLOMA', 'Diploma'], ['ITI', 'ITI'], ['UG', 'Graduate'], ['PG', 'Post-graduate'], ['DOCTORATE', 'Doctorate'], ['PROFESSIONAL', 'Professional']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input className="form-input" placeholder="Occupation" value={f.occupation} onChange={(e) => set('occupation', e.target.value)} />
        <input className="form-input" placeholder="Gotra" value={f.gotra} onChange={(e) => set('gotra', e.target.value)} />
        <div className="sm:col-span-2"><AreaCascadePicker upTo="DISTRICT" idPrefix="bureau-district" onChange={(id) => set('district', id)} /></div>
        <button type="button" className="btn-primary sm:col-span-4" onClick={() => search()}>Search</button>
      </div>
      {error && <div className="card text-sm text-amber-800 bg-amber-50">{error}</div>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(profiles ?? []).map((p) => (
          <div key={p.id} className="card space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <Link href={`/matrimony/${p.id}`} className="font-semibold text-gray-900 hover:text-saffron-700">{p.name}</Link>
              <span className="text-gray-500">{p.age ? `${p.age} yrs` : ''}{p.heightCm ? ` · ${p.heightCm} cm` : ''}</span>
            </div>
            {p.sameGotra && <p className="flex items-center gap-1 text-xs text-red-700 bg-red-50 rounded px-2 py-1"><AlertTriangle className="w-3.5 h-3.5" /> Same Gotra ({p.gotra})</p>}
            {(p.mulGaon || p.district) && <p className="flex items-center gap-1 text-gray-500"><MapPin className="w-3.5 h-3.5" />{[p.mulGaon, p.district].filter(Boolean).join(', ')}{p.gotra && !p.sameGotra ? ` · Gotra ${p.gotra}` : ''}</p>}
            {p.education && <p className="flex items-center gap-1 text-gray-500"><GraduationCap className="w-3.5 h-3.5" />{p.education.qualification ?? p.education.level}</p>}
            {(p.occupation || p.incomeBand) && <p className="flex items-center gap-1 text-gray-500"><Briefcase className="w-3.5 h-3.5" />{[p.occupation, p.incomeBand ? INCOME[p.incomeBand] ?? p.incomeBand : null].filter(Boolean).join(' · ')}</p>}
            {p.about && <p className="text-gray-600 line-clamp-2">{p.about}</p>}
            <div className="flex pt-1"><SendInterestButton toMemberId={p.memberId} /></div>
          </div>
        ))}
        {profiles && !profiles.length && !error && <p className="text-sm text-gray-500">No profiles match.</p>}
      </div>
    </div>
  )
}
