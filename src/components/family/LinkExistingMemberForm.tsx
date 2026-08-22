'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2, UserPlus, Check } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LinkExistingMemberForm({ familyId }: { familyId: string }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [relTypes, setRelTypes] = useState<any[]>([])
  const [familyMembers, setFamilyMembers] = useState<any[]>([])
  const [relatedToMemberId, setRelatedToMemberId] = useState('')
  const [relationshipTypeCode, setRelationshipTypeCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/relationship-types').then((r) => r.json()),
      fetch(`/api/families/${familyId}/members`).then((r) => r.json()),
    ]).then(([rels, members]) => {
      setRelTypes(rels?.types ?? [])
      setFamilyMembers(members?.members ?? [])
    })
  }, [familyId])

  const existingMemberIds = new Set(familyMembers.map((m: any) => m.id))

  const search = async () => {
    if (!query.trim()) return
    setIsSearching(true)
    setSelected(null)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      const json = await res.json()
      setResults((json.members ?? []).filter((m: any) => !existingMemberIds.has(m.id)))
    } catch {
      toast.error('Search failed')
    } finally {
      setIsSearching(false)
    }
  }

  const sendRequest = async () => {
    if (!selected || !relationshipTypeCode) {
      toast.error('Select a relationship before sending the request')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/families/${familyId}/join-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: selected.id,
          relatedToMemberId: relatedToMemberId || undefined,
          relationshipTypeCode,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to send request')
      toast.success('Join request sent — they need to approve it before joining.')
      router.push(`/family/${familyId}`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="card space-y-4">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-saffron-600" /> Find an Existing Member
      </h2>
      <p className="text-sm text-gray-500">
        Search for someone who already has an account on the platform. They&apos;ll receive a request and must approve it before joining your family.
      </p>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), search())}
          className="form-input flex-1"
          placeholder="Search by name, city..."
        />
        <button type="button" onClick={search} disabled={isSearching} className="btn-primary px-4 flex items-center gap-1.5">
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </button>
      </div>

      {results.length > 0 && !selected && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {results.map((m: any) => (
            <button key={m.id} type="button" onClick={() => setSelected(m)}
              className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-saffron-300 hover:bg-saffron-50 transition-colors">
              <p className="font-medium text-gray-900 text-sm">{m.firstName} {m.lastName ?? ''}</p>
              <p className="text-xs text-gray-500">
                {m.currentCity ?? 'City not set'}{m.families?.[0]?.family ? ` · ${m.families[0].family.name} Family` : ''}
              </p>
            </button>
          ))}
        </div>
      )}

      {query && !isSearching && results.length === 0 && (
        <p className="text-sm text-gray-400">No matching members found.</p>
      )}

      {selected && (
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-green-600" />
              <span className="font-medium text-gray-900">{selected.firstName} {selected.lastName ?? ''}</span> selected
            </div>
            <button type="button" onClick={() => setSelected(null)} className="text-xs text-gray-500 hover:text-gray-700">Change</button>
          </div>

          <div>
            <label className="form-label">Relationship to (select existing member)</label>
            <select value={relatedToMemberId} onChange={(e) => setRelatedToMemberId(e.target.value)} className="form-input">
              <option value="">No existing member to link</option>
              {familyMembers.map((m: any) => (
                <option key={m.id} value={m.id}>{m.firstName} {m.lastName ?? ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">{selected.firstName} is the... *</label>
            <select value={relationshipTypeCode} onChange={(e) => setRelationshipTypeCode(e.target.value)} className="form-input">
              <option value="">Select relationship</option>
              {relTypes.map((rt: any) => (
                <option key={rt.code} value={rt.code}>{rt.label}</option>
              ))}
            </select>
          </div>

          <button type="button" onClick={sendRequest} disabled={isSubmitting}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-70">
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isSubmitting ? 'Sending...' : 'Send Join Request'}
          </button>
        </div>
      )}
    </div>
  )
}
