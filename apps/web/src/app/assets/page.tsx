'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '../../lib/api-client'
import { errorMessage } from '../../lib/auth-context'
import { RequireAuth, TopBar, Shell, ErrorBanner } from '../../components/ui'

interface AssetSummary {
  id: string
  name: string
  city: string | null
  capacity: number | null
  category: { label: string }
  photos: { url: string }[]
  pricing: { amount: string }[]
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetSummary[] | null>(null)
  const [city, setCity] = useState('')
  const [error, setError] = useState<string | null>(null)

  function load(cityFilter?: string) {
    const params = new URLSearchParams()
    if (cityFilter) params.set('city', cityFilter)
    api
      .get<AssetSummary[]>(`/assets/search?${params.toString()}`)
      .then(setAssets)
      .catch((err) => setError(errorMessage(err)))
  }

  useEffect(() => load(), [])

  return (
    <RequireAuth>
      <TopBar />
      <Shell>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h1>Community Services</h1>
          <Link href="/assets/new" className="btn btn-accent">
            List a service
          </Link>
        </div>

        <form
          className="row"
          style={{ marginTop: 16 }}
          onSubmit={(e) => {
            e.preventDefault()
            load(city)
          }}
        >
          <input placeholder="Filter by city…" value={city} onChange={(e) => setCity(e.target.value)} style={{ flex: 1 }} />
          <button className="btn btn-primary" type="submit">
            Search
          </button>
        </form>

        <ErrorBanner message={error} />

        <div className="stack" style={{ marginTop: 20 }}>
          {assets?.length === 0 && <p className="muted">No services found.</p>}
          {assets?.map((a) => (
            <Link key={a.id} href={`/assets/${a.id}`} className="card row" style={{ justifyContent: 'space-between', textDecoration: 'none', color: 'inherit' }}>
              <div>
                <h3 style={{ marginBottom: 4 }}>{a.name}</h3>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  {a.category.label} {a.city && `· ${a.city}`} {a.capacity && `· up to ${a.capacity} guests`}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                {a.pricing[0] && <div className="mono" style={{ fontWeight: 600 }}>₹{Number(a.pricing[0].amount).toLocaleString('en-IN')}</div>}
                <span className="btn btn-outline" style={{ marginTop: 6 }}>
                  View
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Shell>
    </RequireAuth>
  )
}
