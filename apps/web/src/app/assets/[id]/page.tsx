'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '../../../lib/api-client'
import { errorMessage } from '../../../lib/auth-context'
import { RequireAuth, TopBar, Shell, ErrorBanner, StatusPill } from '../../../components/ui'

interface AssetDetail {
  id: string
  name: string
  description: string | null
  city: string | null
  capacity: number | null
  category: { label: string }
  facilities: { facilityCode: string }[]
  services: { code: string; label: string; pricing: { amount: string } | null }[]
  averageRating: number | null
  reviewCount: number
  reviews: { id: string; overallScore: number; comment: string | null; createdAt: string }[]
}

interface AvailabilityDay {
  date: string
  status: string
}

interface Quote {
  basePrice: number
  serviceLines: { code: string; label: string; amount: number }[]
  subtotal: number
  discount: number
  tax: number
  total: number
}

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [asset, setAsset] = useState<AssetDetail | null>(null)
  const [availability, setAvailability] = useState<AvailabilityDay[]>([])
  const [date, setDate] = useState('')
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [quote, setQuote] = useState<Quote | null>(null)
  const [guestName, setGuestName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.get<AssetDetail>(`/assets/${id}`).then(setAsset).catch((err) => setError(errorMessage(err)))
    api.get<AvailabilityDay[]>(`/assets/${id}/availability`).then(setAvailability).catch(() => undefined)
  }, [id])

  async function getQuote() {
    if (!date) return
    setError(null)
    try {
      const params = new URLSearchParams({ date })
      if (selectedServices.length) params.set('services', selectedServices.join(','))
      const q = await api.get<Quote>(`/assets/${id}/quote?${params.toString()}`)
      setQuote(q)
    } catch (err) {
      setQuote(null)
      setError(errorMessage(err))
    }
  }

  function toggleService(code: string) {
    setSelectedServices((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))
    setQuote(null)
  }

  async function bookNow() {
    if (!date) {
      setError('Choose a date first.')
      return
    }
    setError(null)
    setNotice(null)
    setSubmitting(true)
    try {
      const booking = await api.post<{ id: string }>('/bookings', {
        assetId: id,
        date,
        serviceCodes: selectedServices,
        guests: guestName ? [{ name: guestName }] : undefined,
      })
      router.push(`/bookings/${booking.id}`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const dateAvailability = availability.find((d) => d.date === date)

  return (
    <RequireAuth>
      <TopBar />
      <Shell>
        <ErrorBanner message={error} />
        {notice && <div className="card" style={{ borderColor: 'var(--success)', color: 'var(--success)', marginBottom: 16 }}>{notice}</div>}

        {asset && (
          <>
            <h1>{asset.name}</h1>
            <p className="muted">
              {asset.category.label} {asset.city && `· ${asset.city}`} {asset.capacity && `· up to ${asset.capacity} guests`}
              {asset.averageRating != null && ` · ★ ${asset.averageRating.toFixed(1)} (${asset.reviewCount})`}
            </p>
            {asset.description && <p>{asset.description}</p>}

            {asset.facilities.length > 0 && (
              <div className="row" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
                {asset.facilities.map((f) => (
                  <span key={f.facilityCode} className="pill pill-neutral">
                    {f.facilityCode.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}

            <div className="card stack" style={{ marginBottom: 20 }}>
              <h3>Book this service</h3>
              <div className="field">
                <label htmlFor="date">Date</label>
                <input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value)
                    setQuote(null)
                  }}
                />
                {date && dateAvailability && <StatusPill status={dateAvailability.status} />}
              </div>

              {asset.services.length > 0 && (
                <div className="field">
                  <label>Add-on services</label>
                  {asset.services.map((s) => (
                    <label key={s.code} className="row" style={{ gap: 8 }}>
                      <input type="checkbox" checked={selectedServices.includes(s.code)} onChange={() => toggleService(s.code)} />
                      {s.label} {s.pricing && `(₹${Number(s.pricing.amount).toLocaleString('en-IN')})`}
                    </label>
                  ))}
                </div>
              )}

              <div className="field">
                <label htmlFor="guestName">Primary guest name (optional)</label>
                <input id="guestName" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
              </div>

              <button className="btn btn-outline" type="button" onClick={getQuote} disabled={!date} style={{ alignSelf: 'flex-start' }}>
                Get quote
              </button>

              {quote && (
                <div className="card" style={{ background: 'var(--bg)' }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="muted">Base price</span>
                    <span className="mono">₹{quote.basePrice.toLocaleString('en-IN')}</span>
                  </div>
                  {quote.serviceLines.map((l) => (
                    <div key={l.code} className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="muted">{l.label}</span>
                      <span className="mono">₹{l.amount.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  {quote.discount > 0 && (
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="muted">Discount</span>
                      <span className="mono">-₹{quote.discount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {quote.tax > 0 && (
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="muted">Tax</span>
                      <span className="mono">₹{quote.tax.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="row" style={{ justifyContent: 'space-between', fontWeight: 600, marginTop: 8 }}>
                    <span>Total</span>
                    <span className="mono">₹{quote.total.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}

              <button className="btn btn-accent" onClick={bookNow} disabled={submitting || !date} style={{ alignSelf: 'flex-start' }}>
                {submitting ? 'Booking…' : 'Book Now'}
              </button>
            </div>

            <h3>Reviews {asset.reviewCount > 0 && `(${asset.reviewCount})`}</h3>
            <div className="stack">
              {asset.reviews.length === 0 && <p className="muted">No reviews yet.</p>}
              {asset.reviews.map((r) => (
                <div key={r.id} className="card">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <strong>★ {r.overallScore}/5</strong>
                    <span className="muted mono" style={{ fontSize: 12 }}>
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {r.comment && <p style={{ margin: '4px 0 0' }}>{r.comment}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </Shell>
    </RequireAuth>
  )
}
