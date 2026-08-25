'use client'

import { useState } from 'react'
import Link from 'next/link'
import { api } from '../../../lib/api-client'
import { errorMessage } from '../../../lib/auth-context'
import { RequireAuth, TopBar, Shell, ErrorBanner, Avatar, StatusPill } from '../../../components/ui'

interface MemberResult {
  id: string
  firstName: string
  lastName: string | null
  status: string
  currentCity?: string
}

export default function MemberSearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MemberResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function search(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const found = await api.get<MemberResult[]>(`/members/search?q=${encodeURIComponent(query)}`)
      setResults(found)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <RequireAuth>
      <TopBar />
      <Shell>
        <h1>Community directory</h1>
        <form onSubmit={search} className="row" style={{ marginTop: 16 }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name…" style={{ flex: 1 }} autoFocus />
          <button className="btn btn-primary" type="submit">
            Search
          </button>
        </form>

        <ErrorBanner message={error} />

        <div className="stack" style={{ marginTop: 20 }}>
          {results?.length === 0 && <p className="muted">No members found.</p>}
          {results?.map((m) => (
            <Link key={m.id} href={`/members/${m.id}`} className="card row" style={{ justifyContent: 'space-between', textDecoration: 'none', color: 'inherit' }}>
              <div className="row">
                <Avatar name={`${m.firstName} ${m.lastName ?? ''}`} deceased={m.status === 'DECEASED'} />
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {m.firstName} {m.lastName ?? ''}
                  </div>
                  {m.currentCity && <div className="muted" style={{ fontSize: 13 }}>{m.currentCity}</div>}
                </div>
              </div>
              <StatusPill status={m.status} />
            </Link>
          ))}
        </div>
      </Shell>
    </RequireAuth>
  )
}
