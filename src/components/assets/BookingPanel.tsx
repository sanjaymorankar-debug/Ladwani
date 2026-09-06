'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Loader2, CalendarCheck, CreditCard } from 'lucide-react'

interface Props {
  assetId: string
  bookingMode: string
  ratePerDay: number | null
  ratePerHour: number | null
  capacity: number | null
}

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

export default function BookingPanel({ assetId, bookingMode, ratePerDay, ratePerHour, capacity }: Props) {
  const router = useRouter()
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [guestCount, setGuestCount] = useState('')
  const [busy, setBusy] = useState(false)
  const [held, setHeld] = useState<{ bookingRef: string; paymentId: string; amountPaise: number } | null>(null)

  const inputType = bookingMode === 'HOURLY' ? 'datetime-local' : 'date'

  const book = async () => {
    if (!startAt || !endAt) return toast.error('Choose a start and end')
    setBusy(true)
    try {
      const res = await fetch(`/api/assets/${assetId}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          guestCount: guestCount || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? 'Could not create booking')
      setHeld({ bookingRef: json.booking.reference, paymentId: json.payment.id, amountPaise: json.payment.amountPaise })
      toast.success('Slot held — complete payment to confirm.')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const pay = async () => {
    if (!held) return
    setBusy(true)
    try {
      // In MOCK mode this stands in for the gateway's hosted checkout page.
      // With a live gateway this is where its SDK would run instead; either
      // way the server verifies the result before anything is confirmed.
      const credsRes = await fetch(`/api/payments/${held.paymentId}/settle`)
      if (!credsRes.ok) throw new Error('Payment gateway is not available')
      const creds = await credsRes.json()

      const res = await fetch(`/api/payments/${held.paymentId}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gatewayPaymentId: creds.gatewayPaymentId, signature: creds.signature }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? 'Payment failed')

      toast.success(json.message)
      setHeld(null)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (held) {
    return (
      <div className="card space-y-3 border-2 border-saffron-200">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-saffron-600" /> Slot held
        </h3>
        <p className="text-sm text-gray-600">
          Booking <span className="font-mono text-xs">{held.bookingRef}</span> is held for you. It is confirmed
          only once payment succeeds.
        </p>
        <div className="text-2xl font-bold text-gray-900">{rupees(held.amountPaise)}</div>
        <button onClick={pay} disabled={busy}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-70">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
          {busy ? 'Processing...' : 'Pay now'}
        </button>
      </div>
    )
  }

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-gray-900">Book this asset</h3>
      <div className="text-sm text-gray-500">
        {bookingMode === 'HOURLY'
          ? `${rupees(ratePerHour ?? 0)} per hour`
          : `${rupees(ratePerDay ?? 0)} per day`}
      </div>

      <div>
        <label className="form-label">From</label>
        <input type={inputType} value={startAt} onChange={(e) => setStartAt(e.target.value)} className="form-input" />
      </div>
      <div>
        <label className="form-label">To</label>
        <input type={inputType} value={endAt} onChange={(e) => setEndAt(e.target.value)} className="form-input" />
      </div>
      {capacity && (
        <div>
          <label className="form-label">Number of guests (max {capacity})</label>
          <input type="number" value={guestCount} onChange={(e) => setGuestCount(e.target.value)}
            max={capacity} className="form-input" placeholder="50" />
        </div>
      )}

      <button onClick={book} disabled={busy}
        className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-70">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />}
        {busy ? 'Checking availability...' : 'Check availability & book'}
      </button>
      <p className="text-xs text-gray-400">
        The slot is held only after availability is confirmed, and the booking is confirmed only after payment.
      </p>
    </div>
  )
}
