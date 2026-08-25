'use client'

import { useState } from 'react'
import Link from 'next/link'
import { api } from '../../../lib/api-client'
import { errorMessage } from '../../../lib/auth-context'
import { RequireAuth, TopBar, Shell, ErrorBanner, Avatar } from '../../../components/ui'

interface SearchResult {
  memberId: string
  firstName: string
  gender: string
  age: number | null
  currentCity: string | null
}

export default function MatrimonySearchPage() {
  const [filters, setFilters] = useState({ minAge: '', maxAge: '', gender: '', city: '' })
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function search(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.minAge) params.set('minAge', filters.minAge)
      if (filters.maxAge) params.set('maxAge', filters.maxAge)
      if (filters.gender) params.set('gender', filters.gender)
      if (filters.city) params.set('city', filters.city)
      const found = await api.get<SearchResult[]>(`/matrimony/search?${params.toString()}`)
      setResults(found)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <RequireAuth>
      <TopBar />
      <Shell>
        <h1>Search matrimonial profiles</h1>
        <form onSubmit={search} className="card row" style={{ marginTop: 16, flexWrap: 'wrap' }}>
          <input placeholder="Min age" type="number" value={filters.minAge} onChange={(e) => setFilters({ ...filters, minAge: e.target.value })} style={{ width: 100 }} />
          <input placeholder="Max age" type="number" value={filters.maxAge} onChange={(e) => setFilters({ ...filters, maxAge: e.target.value })} style={{ width: 100 }} />
          <select value={filters.gender} onChange={(e) => setFilters({ ...filters, gender: e.target.value })}>
            <option value="">Any gender</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
          <input placeholder="City" value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} style={{ flex: 1 }} />
          <button className="btn btn-primary" type="submit">
            Search
          </button>
        </form>

        <ErrorBanner message={error} />

        <div className="stack" style={{ marginTop: 20 }}>
          {results?.length === 0 && <p className="muted">No matching profiles.</p>}
          {results?.map((r) => (
            <Link key={r.memberId} href={`/matrimony/${r.memberId}`} className="card row" style={{ justifyContent: 'space-between', textDecoration: 'none', color: 'inherit' }}>
              <div className="row">
                <Avatar name={r.firstName} />
                <div>
                  <div style={{ fontWeight: 600 }}>{r.firstName}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {r.age ? `${r.age} yrs` : ''} {r.currentCity ? `· ${r.currentCity}` : ''}
                  </div>
                </div>
              </div>
              <span className="btn btn-outline">View</span>
            </Link>
          ))}
        </div>
      </Shell>
    </RequireAuth>
  )
}
