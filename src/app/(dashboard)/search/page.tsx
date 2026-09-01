'use client'
import { useState, useTransition } from 'react'
import { Search, Filter, MapPin, GraduationCap, Users, Loader2, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { calculateAge, genderLabel, maritalLabel } from '@/lib/utils'

type SearchResult = {
  id: string; firstName: string; lastName?: string; gender: string;
  maritalStatus: string; dateOfBirth?: string; currentCity?: string;
  currentState?: string; nativeVillage?: string;
  education: Array<{ level?: string; qualification?: string }>
  families: Array<{ family: { name: string } }>
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [gender, setGender] = useState('')
  const [marital, setMarital] = useState('')
  const [city, setCity] = useState('')
  const [minAge, setMinAge] = useState('')
  const [maxAge, setMaxAge] = useState('')
  const [education, setEducation] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searched, setSearched] = useState(false)
  const [total, setTotal] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [isPending, startTransition] = useTransition()

  const doSearch = () => {
    startTransition(async () => {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (gender) params.set('gender', gender)
      if (marital) params.set('maritalStatus', marital)
      if (city) params.set('city', city)
      if (minAge) params.set('minAge', minAge)
      if (maxAge) params.set('maxAge', maxAge)
      if (education) params.set('education', education)

      const res = await fetch(`/api/search?${params}`)
      const data = await res.json()
      setResults(data.members ?? [])
      setTotal(data.total ?? 0)
      setSearched(true)
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
          <Search className="w-5 h-5 text-saffron-600" /> Advanced Search
        </h1>
        <p className="text-gray-500 text-sm">Search the Ladwani Samaj member directory</p>
      </div>

      {/* Search bar */}
      <div className="card space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doSearch()}
              className="form-input pl-9"
              placeholder="Name, family, native village, occupation..."
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-ghost flex items-center gap-2 text-sm ${showFilters ? 'bg-gray-100' : ''}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </button>
          <button onClick={doSearch} disabled={isPending}
            className="btn-primary flex items-center gap-2 text-sm px-6">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
            <div>
              <label className="form-label text-xs">Gender</label>
              <select value={gender} onChange={(e) => setGender(e.target.value)} className="form-input text-sm">
                <option value="">Any</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>
            <div>
              <label className="form-label text-xs">Marital Status</label>
              <select value={marital} onChange={(e) => setMarital(e.target.value)} className="form-input text-sm">
                <option value="">Any</option>
                <option value="UNMARRIED">Unmarried</option>
                <option value="MARRIED">Married</option>
                <option value="WIDOWED">Widowed</option>
              </select>
            </div>
            <div>
              <label className="form-label text-xs">City</label>
              <input value={city} onChange={(e) => setCity(e.target.value)}
                className="form-input text-sm" placeholder="Mumbai, Pune..." />
            </div>
            <div>
              <label className="form-label text-xs">Min Age</label>
              <input value={minAge} onChange={(e) => setMinAge(e.target.value)}
                type="number" className="form-input text-sm" placeholder="18" min="0" max="120" />
            </div>
            <div>
              <label className="form-label text-xs">Max Age</label>
              <input value={maxAge} onChange={(e) => setMaxAge(e.target.value)}
                type="number" className="form-input text-sm" placeholder="60" min="0" max="120" />
            </div>
            <div>
              <label className="form-label text-xs">Education Level</label>
              <select value={education} onChange={(e) => setEducation(e.target.value)} className="form-input text-sm">
                <option value="">Any</option>
                {['SCHOOL', 'DIPLOMA', 'UNDERGRADUATE', 'POSTGRADUATE', 'DOCTORATE'].map((l) => (
                  <option key={l} value={l}>{l.charAt(0) + l.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {searched && (
        <div>
          <p className="text-sm text-gray-500 mb-3">
            {isPending ? 'Searching...' : `${total} result${total !== 1 ? 's' : ''} found`}
          </p>

          {results.length === 0 && !isPending ? (
            <div className="card text-center py-10">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No members found matching your criteria.</p>
              <p className="text-gray-400 text-sm mt-1">Try broadening your search filters.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((m) => {
                const age = calculateAge(m.dateOfBirth)
                const edu = m.education?.[0]
                const family = m.families?.[0]?.family

                return (
                  <Link key={m.id} href={`/members/${m.id}`} className="card-hover block">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-sm font-bold bg-gradient-to-br ${
                        m.gender === 'MALE' ? 'from-blue-400 to-blue-600' :
                        m.gender === 'FEMALE' ? 'from-pink-400 to-pink-600' :
                        'from-gray-400 to-gray-500'
                      }`}>
                        {m.firstName[0]}{m.lastName?.[0] ?? ''}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          {m.firstName} {m.lastName ?? ''}
                        </p>
                        {family && <p className="text-xs text-saffron-600 font-medium">{family.name} Family</p>}
                        <div className="text-xs text-gray-500 space-y-0.5 mt-1">
                          <div>{genderLabel(m.gender as string)} {age ? `· ${age} yrs` : ''}</div>
                          <div>{maritalLabel(m.maritalStatus as string)}</div>
                          {m.currentCity && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {m.currentCity}
                            </div>
                          )}
                          {edu && (
                            <div className="flex items-center gap-1">
                              <GraduationCap className="w-3 h-3" /> {edu.qualification ?? edu.level}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {!searched && (
        <div className="card text-center py-12 border-2 border-dashed border-gray-200">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Enter search criteria above and click Search</p>
          <p className="text-gray-400 text-sm mt-1">You can search by name, city, native village, education, or use filters</p>
        </div>
      )}
    </div>
  )
}
