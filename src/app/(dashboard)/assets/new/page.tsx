'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ArrowLeft, Loader2, Building2 } from 'lucide-react'

const ASSET_TYPES = ['HALL', 'GUESTHOUSE', 'LAWN', 'EQUIPMENT', 'VEHICLE', 'OTHER']
const FACILITY_OPTIONS = ['Parking', 'Kitchen', 'Air Conditioning', 'Stage', 'Sound System', 'Generator', 'Lift', 'Rooms']

export default function NewAssetPage() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: '', assetType: 'HALL', description: '',
    addressLine: '', city: '', district: '', state: '', pincode: '',
    capacity: '', bookingMode: 'DAILY', ratePerDay: '', ratePerHour: '',
  })
  const [facilities, setFacilities] = useState<string[]>([])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const toggleFacility = (f: string) =>
    setFacilities((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]))

  const submit = async () => {
    if (!form.name.trim()) return toast.error('Give the asset a name')
    setBusy(true)
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, facilities }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? 'Could not register the asset')
      toast.success(json.message)
      router.push('/assets')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/assets" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-saffron-600" /> Register an Asset
        </h1>
      </div>

      <div className="space-y-4">
        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Asset details</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Name *</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)}
                className="form-input" placeholder="Samaj Community Hall" />
            </div>
            <div>
              <label className="form-label">Type *</label>
              <select value={form.assetType} onChange={(e) => set('assetType', e.target.value)} className="form-input">
                {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
              className="form-input min-h-[80px]" placeholder="What is it, and what is it suitable for?" />
          </div>
          <div>
            <label className="form-label">Capacity</label>
            <input type="number" value={form.capacity} onChange={(e) => set('capacity', e.target.value)}
              className="form-input" placeholder="200" />
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Location</h2>
          <input value={form.addressLine} onChange={(e) => set('addressLine', e.target.value)}
            className="form-input" placeholder="Address line" />
          <div className="grid grid-cols-2 gap-3">
            <input value={form.city} onChange={(e) => set('city', e.target.value)} className="form-input" placeholder="City" />
            <input value={form.district} onChange={(e) => set('district', e.target.value)} className="form-input" placeholder="District" />
            <input value={form.state} onChange={(e) => set('state', e.target.value)} className="form-input" placeholder="State" />
            <input value={form.pincode} onChange={(e) => set('pincode', e.target.value)} className="form-input" placeholder="PIN code" />
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Booking & rate</h2>
          <div>
            <label className="form-label">Booked by</label>
            <select value={form.bookingMode} onChange={(e) => set('bookingMode', e.target.value)} className="form-input">
              <option value="DAILY">Day</option>
              <option value="HOURLY">Hour</option>
            </select>
          </div>
          {form.bookingMode === 'DAILY' ? (
            <div>
              <label className="form-label">Rate per day (₹) *</label>
              <input type="number" value={form.ratePerDay} onChange={(e) => set('ratePerDay', e.target.value)}
                className="form-input" placeholder="5000" />
            </div>
          ) : (
            <div>
              <label className="form-label">Rate per hour (₹) *</label>
              <input type="number" value={form.ratePerHour} onChange={(e) => set('ratePerHour', e.target.value)}
                className="form-input" placeholder="500" />
            </div>
          )}
          <div>
            <label className="form-label">Facilities</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {FACILITY_OPTIONS.map((f) => (
                <button key={f} type="button" onClick={() => toggleFacility(f)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    facilities.includes(f)
                      ? 'bg-saffron-50 border-saffron-300 text-saffron-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
          Your asset is reviewed by a community operator before it appears for booking.
        </div>

        <button onClick={submit} disabled={busy}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-70">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {busy ? 'Submitting...' : 'Submit for approval'}
        </button>
      </div>
    </div>
  )
}
