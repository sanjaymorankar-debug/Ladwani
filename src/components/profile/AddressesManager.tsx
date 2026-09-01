'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { MapPin, Save, Loader2 } from 'lucide-react'

interface AddressForm {
  line1: string
  line2: string
  city: string
  district: string
  state: string
  pincode: string
  country: string
}

const EMPTY: AddressForm = { line1: '', line2: '', city: '', district: '', state: '', pincode: '', country: 'India' }

export default function AddressesManager({ memberId }: { memberId: string }) {
  const [current, setCurrent] = useState<AddressForm>({ ...EMPTY })
  const [native, setNative] = useState<AddressForm>({ ...EMPTY })
  const [savingCurrent, setSavingCurrent] = useState(false)
  const [savingNative, setSavingNative] = useState(false)

  useEffect(() => {
    fetch(`/api/members/${memberId}/addresses`)
      .then((r) => r.json())
      .then((d) => {
        const addrs = d.addresses ?? []
        const c = addrs.find((a: any) => a.addressType === 'CURRENT')
        const n = addrs.find((a: any) => a.addressType === 'NATIVE')
        if (c) setCurrent({ line1: c.line1 ?? '', line2: c.line2 ?? '', city: c.city ?? '', district: c.district ?? '', state: c.state ?? '', pincode: c.pincode ?? '', country: c.country ?? 'India' })
        if (n) setNative({ line1: n.line1 ?? '', line2: n.line2 ?? '', city: n.city ?? '', district: n.district ?? '', state: n.state ?? '', pincode: n.pincode ?? '', country: n.country ?? 'India' })
      })
  }, [memberId])

  const save = async (addressType: 'CURRENT' | 'NATIVE', data: AddressForm, setSaving: (b: boolean) => void) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/members/${memberId}/addresses`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressType, ...data }),
      })
      if (!res.ok) throw new Error((await res.json()).message)
      toast.success(`${addressType === 'CURRENT' ? 'Current' : 'Native'} address saved`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const Fields = ({ data, setData }: { data: AddressForm; setData: (d: AddressForm) => void }) => (
    <div className="grid grid-cols-2 gap-2">
      <input value={data.line1} onChange={(e) => setData({ ...data, line1: e.target.value })} className="form-input text-sm col-span-2" placeholder="Address line 1" />
      <input value={data.city} onChange={(e) => setData({ ...data, city: e.target.value })} className="form-input text-sm" placeholder="City / Village" />
      <input value={data.district} onChange={(e) => setData({ ...data, district: e.target.value })} className="form-input text-sm" placeholder="District" />
      <input value={data.state} onChange={(e) => setData({ ...data, state: e.target.value })} className="form-input text-sm" placeholder="State" />
      <input value={data.pincode} onChange={(e) => setData({ ...data, pincode: e.target.value })} className="form-input text-sm" placeholder="PIN code" />
    </div>
  )

  return (
    <div className="card space-y-5">
      <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
        <MapPin className="w-4 h-4 text-saffron-600" /> Addresses
      </h3>
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-600">Current Residence</p>
        <Fields data={current} setData={setCurrent} />
        <button type="button" onClick={() => save('CURRENT', current, setSavingCurrent)} disabled={savingCurrent}
          className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-60">
          {savingCurrent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Current Address
        </button>
      </div>
      <div className="space-y-2 border-t border-gray-100 pt-4">
        <p className="text-sm font-medium text-gray-600">Native / Original Residence</p>
        <Fields data={native} setData={setNative} />
        <button type="button" onClick={() => save('NATIVE', native, setSavingNative)} disabled={savingNative}
          className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-60">
          {savingNative ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Native Address
        </button>
      </div>
    </div>
  )
}
