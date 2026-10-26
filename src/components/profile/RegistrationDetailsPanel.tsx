'use client'
import { BASE_PATH } from '@/lib/api-path'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { MapPin } from 'lucide-react'
import AreaCascadePicker from '@/components/shared/AreaCascadePicker'

/**
 * F02: the location-master parts of the profile — Mul Gaon (sensitive: once
 * verified, a change goes to two operators), the village / city of the
 * current address, and the permanent address with its "same as current" tick.
 */
export default function RegistrationDetailsPanel({ memberId }: { memberId: string }) {
  const [addresses, setAddresses] = useState<any[]>([])
  const [mulGaon, setMulGaon] = useState<{ village?: string; district?: string; state?: string } | null>(null)
  const [mulGaonPick, setMulGaonPick] = useState('')
  const [currentPick, setCurrentPick] = useState('')
  const [permPick, setPermPick] = useState('')
  const [permLine, setPermLine] = useState('')
  const [permPin, setPermPin] = useState('')
  const [sameAsCurrent, setSameAsCurrent] = useState(false)

  const load = useCallback(() => {
    fetch(`${BASE_PATH}/api/members/${memberId}/addresses`).then((r) => r.json()).then((d) => {
      setAddresses(d.addresses ?? [])
      const perm = (d.addresses ?? []).find((a: any) => a.addressType === 'PERMANENT')
      setSameAsCurrent(!!perm?.sameAsCurrent)
    })
    fetch(`${BASE_PATH}/api/members/${memberId}`).then((r) => r.json()).then((m) => {
      if (m.nativeVillage) setMulGaon({ village: m.nativeVillage, district: m.nativeDistrict, state: m.nativeState })
    })
  }, [memberId])
  useEffect(() => { load() }, [load])

  const send = async (url: string, method: string, body: object, ok: string) => {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return toast.error(json.message ?? 'Failed')
    if (res.status === 202) toast(json.message, { icon: '🕓' }); else toast.success(ok)
    load()
  }

  const current = addresses.find((a) => a.addressType === 'CURRENT')
  const permanent = addresses.find((a) => a.addressType === 'PERMANENT')
  const place = (a: any) => (a ? [a.line1, a.city, a.taluka, a.district, a.state, a.pincode].filter(Boolean).join(', ') : 'Not set')

  return (
    <div className="card space-y-5">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2"><MapPin className="w-4 h-4" /> Mul Gaon and addresses</h3>

      <section className="space-y-2">
        <p className="text-sm"><span className="font-medium">Mul Gaon:</span> {mulGaon ? [mulGaon.village, mulGaon.district, mulGaon.state].filter(Boolean).join(', ') : 'Not set'}</p>
        <AreaCascadePicker idPrefix="mulgaon" onChange={setMulGaonPick} />
        <button type="button" className="btn-secondary text-sm" disabled={!mulGaonPick}
          onClick={() => send(`${BASE_PATH}/api/members/${memberId}/mul-gaon`, 'PUT', { areaId: mulGaonPick }, 'Mul Gaon saved')}>Save Mul Gaon</button>
        <p className="text-xs text-gray-400">Once your account is verified, a Mul Gaon change is checked again by two operators.</p>
      </section>

      <section className="space-y-2 border-t border-gray-100 pt-4">
        <p className="text-sm"><span className="font-medium">Current address:</span> {place(current)}</p>
        <AreaCascadePicker idPrefix="current" onChange={setCurrentPick} />
        <button type="button" className="btn-secondary text-sm" disabled={!currentPick}
          onClick={() => send(`${BASE_PATH}/api/members/${memberId}/addresses`, 'PUT', {
            addressType: 'CURRENT', areaId: currentPick, line1: current?.line1, line2: current?.line2, pincode: current?.pincode,
          }, 'Current address village / city saved')}>Set current village / city</button>
        <p className="text-xs text-gray-400">House and street are edited in the address section above.</p>
      </section>

      <section className="space-y-2 border-t border-gray-100 pt-4">
        <p className="text-sm"><span className="font-medium">Permanent address:</span> {place(permanent)}</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-saffron-600" checked={sameAsCurrent} onChange={(e) => setSameAsCurrent(e.target.checked)} />
          Same as current address
        </label>
        {!sameAsCurrent && (
          <>
            <AreaCascadePicker idPrefix="permanent" onChange={setPermPick} />
            <div className="grid grid-cols-2 gap-2">
              <input className="form-input text-sm" placeholder="House / street" value={permLine} onChange={(e) => setPermLine(e.target.value)} />
              <input className="form-input text-sm" placeholder="PIN code" value={permPin} onChange={(e) => setPermPin(e.target.value)} />
            </div>
          </>
        )}
        <button type="button" className="btn-secondary text-sm" disabled={!sameAsCurrent && !permPick}
          onClick={() => send(`${BASE_PATH}/api/members/${memberId}/addresses`, 'PUT', sameAsCurrent
            ? { addressType: 'PERMANENT', sameAsCurrent: true }
            : { addressType: 'PERMANENT', areaId: permPick, line1: permLine, pincode: permPin }, 'Permanent address saved')}>
          Save permanent address
        </button>
      </section>
    </div>
  )
}
